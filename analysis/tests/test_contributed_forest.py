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

from run_analysis import (
    CONTRIBUTED_ID_BASE,
    contributed_osm_id,
    load_contributed_forest,
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
