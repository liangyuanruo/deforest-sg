"""Unit tests for ingesting contributed forest polygons alongside OSM.

Contributed sources (e.g. `data/gillman_forest.geojson`) are provenance-uncertain
hand-traced polygons that must flow through the *same* overlay as OSM forest with no
special-casing. These tests pin the two helpers that normalize such a source into the
forest-frame shape the OSM path produces (columns [osm_id, name, source_layer,
geometry] in EPSG:3414), keyed on a synthetic, stable, JS-safe osm_id.
"""
from __future__ import annotations

import json
import numbers

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, box

from run_analysis import (
    AREA_CRS,
    CONTRIBUTED_ID_BASE,
    TRACT_ID_BASE,
    aggregate_patches,
    contributed_osm_id,
    load_contributed_forest,
    tract_osm_id,
)


def test_contributed_id_is_positive_deterministic_and_in_high_band():
    a = contributed_osm_id("Gillman Forest")
    b = contributed_osm_id("Gillman Forest")
    assert isinstance(a, int)
    assert a > 0
    assert a == b  # deterministic across calls
    assert a >= CONTRIBUTED_ID_BASE  # above the real OSM id range
    assert a < 2 ** 53  # JS-safe (survives JSON.parse without precision loss)


def test_different_names_yield_different_ids():
    assert contributed_osm_id("Gillman Forest") != contributed_osm_id("Clementi Forest")


def _one_multipolygon_geojson(path, props: dict) -> None:
    fc = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": props,
            "geometry": {
                "type": "MultiPolygon",
                # Two little squares near Singapore (lon/lat, EPSG:4326).
                "coordinates": [
                    [[[103.79, 1.28], [103.791, 1.28], [103.791, 1.281], [103.79, 1.281], [103.79, 1.28]]],
                    [[[103.80, 1.28], [103.801, 1.28], [103.801, 1.281], [103.80, 1.281], [103.80, 1.28]]],
                ],
            },
        }],
    }
    path.write_text(json.dumps(fc))


def test_normalizes_named_contributed_feature(tmp_path):
    p = tmp_path / "contrib.geojson"
    _one_multipolygon_geojson(p, {"desc": "Gillman Forest"})

    frame = load_contributed_forest(p, "gillman")

    assert len(frame) == 1
    row = frame.iloc[0]
    assert list(frame.columns) == ["osm_id", "name", "source_layer", "geometry"]
    assert row["name"] == "Gillman Forest"
    # geopandas yields an integer column (numpy int64); assert the integer value.
    assert isinstance(row["osm_id"], numbers.Integral)
    assert int(row["osm_id"]) == contributed_osm_id("Gillman Forest")
    assert row["source_layer"] == "gillman"
    assert frame.crs is not None and frame.crs.to_epsg() == 3414
    assert row["geometry"].is_valid and not row["geometry"].is_empty


def test_missing_desc_yields_none_name_but_valid_row(tmp_path):
    p = tmp_path / "contrib.geojson"
    _one_multipolygon_geojson(p, {})  # no `desc` field at all

    frame = load_contributed_forest(p, "gillman")

    assert len(frame) == 1
    row = frame.iloc[0]
    assert row["name"] is None
    assert int(row["osm_id"]) == contributed_osm_id("gillman")  # collapses per-source
    assert row["geometry"].is_valid and not row["geometry"].is_empty


# --------------------------------------------------------------------------- #
# Per-zone tract split: a forest crossed by >1 MP2025 zone -> one tract per zone
# --------------------------------------------------------------------------- #
def test_tract_id_is_banded_deterministic_and_zone_specific():
    a = tract_osm_id(42, "RESERVE SITE")
    assert a == tract_osm_id(42, "RESERVE SITE")            # stable across runs
    assert a >= TRACT_ID_BASE                                # above OSM + contributed ids
    assert a < 2 ** 53                                       # JS-safe
    assert tract_osm_id(42, "RESERVE SITE") != tract_osm_id(42, "RESIDENTIAL")
    assert tract_osm_id(42, "RESERVE SITE") != tract_osm_id(99, "RESERVE SITE")


def _frag_two_zones() -> gpd.GeoDataFrame:
    """One forest polygon (osm_id 42) split by the overlay into a larger RESIDENTIAL
    fragment and a smaller RESERVE SITE fragment (metres, EPSG:3414)."""
    rows = [
        {"osm_id": 42, "name": "Testville Forest", "source_layer": "natural",
         "forest_area_ha": 5.0, "LU_DESC": "RESIDENTIAL", "GPR": "2.8",
         "area_ha": 4.0, "geometry": box(30000, 30000, 30200, 30200)},
        {"osm_id": 42, "name": "Testville Forest", "source_layer": "natural",
         "forest_area_ha": 5.0, "LU_DESC": "RESERVE SITE", "GPR": "EVA",
         "area_ha": 1.0, "geometry": box(30200, 30000, 30300, 30100)},
    ]
    return gpd.GeoDataFrame(rows, geometry="geometry", crs=AREA_CRS)


def _forest_and_localities():
    forest = gpd.GeoDataFrame(
        [{"osm_id": 42, "name": "Testville Forest", "forest_area_ha": 5.0,
          "source_layer": "natural", "geometry": box(30000, 30000, 30300, 30200)}],
        geometry="geometry", crs=AREA_CRS,
    )
    localities = gpd.GeoDataFrame(
        [{"locality": "Testville", "type": "suburb", "geometry": Point(30100, 30100)}],
        geometry="geometry", crs=AREA_CRS,
    )
    return forest, localities


def test_multi_zone_forest_splits_into_one_tract_per_zone():
    forest, localities = _forest_and_localities()
    patches = aggregate_patches(_frag_two_zones(), forest, localities)

    # One forest, two zones -> two distinct vulnerable tracts.
    assert len(patches) == 2
    by_zone = {r["dominant_lu_desc"]: r for _, r in patches.iterrows()}
    assert set(by_zone) == {"RESIDENTIAL", "RESERVE SITE"}

    # Each tract carries only its own zone + area; totals are preserved.
    assert by_zone["RESIDENTIAL"]["area_ha"] == 4.0
    assert by_zone["RESERVE SITE"]["area_ha"] == 1.0
    assert by_zone["RESIDENTIAL"]["lu_desc_breakdown"] == {"RESIDENTIAL": 4.0}

    # The largest tract keeps the bare osm_id (its share link is stable); the sibling
    # gets a synthetic banded id. Ids are unique.
    assert by_zone["RESIDENTIAL"]["id"] == 42
    assert by_zone["RESERVE SITE"]["id"] == tract_osm_id(42, "RESERVE SITE")
    assert patches["id"].is_unique


def test_subfloor_sliver_folds_into_largest_tract_preserving_area():
    forest, localities = _forest_and_localities()
    frag = _frag_two_zones()
    # A hairline ROAD sliver (0.001 ha, below FOLD_FLOOR_HA) grazing the same forest.
    sliver = gpd.GeoDataFrame(
        [{"osm_id": 42, "name": "Testville Forest", "source_layer": "natural",
          "forest_area_ha": 5.0, "LU_DESC": "ROAD", "GPR": None,
          "area_ha": 0.001, "geometry": box(30300, 30000, 30303, 30003)}],
        geometry="geometry", crs=AREA_CRS,
    )
    frag = gpd.GeoDataFrame(pd.concat([frag, sliver], ignore_index=True),
                            geometry="geometry", crs=AREA_CRS)

    patches = aggregate_patches(frag, forest, localities)

    # The ROAD sliver is folded away — no standalone ROAD tract remains.
    zones = set(patches["dominant_lu_desc"])
    assert zones == {"RESIDENTIAL", "RESERVE SITE"}
    # Its area is absorbed into the forest's largest tract (RESIDENTIAL 4.0 + 0.001),
    # so nothing is lost.
    by_zone = {r["dominant_lu_desc"]: r for _, r in patches.iterrows()}
    assert by_zone["RESIDENTIAL"]["area_ha"] == 4.001
    assert round(patches["area_ha"].sum(), 4) == 5.001
