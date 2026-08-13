#!/usr/bin/env python3
"""
Mapping planned deforestation under Singapore URA Master Plan 2025.

Pipeline
--------
1. Load MP2025 land-use polygons (data/MasterPlan2025LandUseLayer.geojson.gz).
2. Build (and cache) a Singapore land mask = union of all MP2025 polygons, used to
   clip OSM forest to Singapore (the OSM extract bleeds into Johor, Malaysia).
3. Load OSM forest = natural='forest' (defensively unioned with landuse='forest',
   which is empty in this extract) and clip to Singapore.
4. Overlay forest against MP2025 *development* zones, keeping per-fragment LU_DESC
   and GPR, to obtain the "planned deforestation footprint".
5. Aggregate to per-forest-polygon patches; label with OSM name or nearest locality;
   attach curated site context.
6. Validate against the two publicly-announced sites (Maju Forest, Gillman Barracks).
7. Write web-map-ready outputs (EPSG:4326) to results/.

Areas are computed in EPSG:3414 (SVY21, metric); geometries are exported in
EPSG:4326 (lon/lat) for web mapping.

Run:  poetry run python run_analysis.py
"""
from __future__ import annotations

import gzip
import json
import math
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import MultiPolygon, Polygon

from site_context import context_for_name, name_override_for_osm_id

# --------------------------------------------------------------------------- #
# Paths & config
# --------------------------------------------------------------------------- #
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"
RESULTS = ROOT / "results"
CACHE = HERE / ".cache"

MP_GZ = DATA / "MasterPlan2025LandUseLayer.geojson.gz"
OSM_ZIP = DATA / "osm-singapore.zip"

AREA_CRS = 3414   # SVY21 / Singapore National Grid — metric, for areas
WEB_CRS = 4326    # WGS84 lon/lat — for web-map export

# MP2025 LU_DESC values treated as built-form / clearing-permitted development.
DEVELOPMENT_ZONES = {
    "RESIDENTIAL", "RESIDENTIAL / INSTITUTION", "RESIDENTIAL WITH COMMERCIAL AT 1ST STOREY",
    "COMMERCIAL", "COMMERCIAL & RESIDENTIAL", "COMMERCIAL / INSTITUTION", "HOTEL", "WHITE",
    "BUSINESS 1", "BUSINESS 2", "BUSINESS PARK", "BUSINESS 1 - WHITE", "BUSINESS 2 - WHITE",
    "BUSINESS PARK - WHITE", "RESERVE SITE", "TRANSPORT FACILITIES", "MASS RAPID TRANSIT",
    "LIGHT RAPID TRANSIT", "PORT / AIRPORT", "UTILITY", "EDUCATIONAL INSTITUTION",
    "HEALTH & MEDICAL CARE", "CIVIC & COMMUNITY INSTITUTION", "SPECIAL USE", "ROAD",
}

# MP2025 LU_DESC values treated as protected / non-development green & blue.
PROTECTED_ZONES = {
    "PARK", "OPEN SPACE", "WATERBODY", "BEACH AREA", "CEMETERY",
    "AGRICULTURE", "PLACE OF WORSHIP", "SPORTS & RECREATION",
}

# Locality types (OSM places) usable as area labels for unnamed forest patches.
PLACE_LABEL_TYPES = {"town", "suburb", "neighbourhood", "quarter", "borough", "village", "locality"}

TOP_N = 40


def log(msg: str, t0: float | None = None) -> None:
    prefix = f"[{time.time()-t0:5.1f}s] " if t0 is not None else ""
    print(f"{prefix}{msg}", flush=True)


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #
def load_masterplan() -> gpd.GeoDataFrame:
    """Decompress (cached) and load MP2025 in EPSG:3414, geometry made valid."""
    CACHE.mkdir(exist_ok=True)
    mp_json = CACHE / "mp2025.geojson"
    if not mp_json.exists() or mp_json.stat().st_mtime < MP_GZ.stat().st_mtime:
        with gzip.open(MP_GZ, "rb") as fin, open(mp_json, "wb") as fout:
            shutil.copyfileobj(fin, fout)
    mp = gpd.read_file(mp_json, columns=["OBJECTID", "LU_DESC", "GPR"], engine="pyogrio")
    mp = mp.to_crs(AREA_CRS)
    mp["geometry"] = mp.geometry.make_valid()
    mp = mp[mp.geometry.notna() & ~mp.geometry.is_empty]
    return mp


def singapore_mask(mp: gpd.GeoDataFrame):
    """Union of all MP2025 polygons = Singapore planning extent. Cached to disk."""
    mask_path = CACHE / "singapore_mask.gpkg"
    if mask_path.exists() and mask_path.stat().st_mtime >= MP_GZ.stat().st_mtime:
        return gpd.read_file(mask_path, engine="pyogrio").geometry.iloc[0]
    geom = mp.geometry.union_all()
    gpd.GeoDataFrame(geometry=[geom], crs=AREA_CRS).to_file(mask_path, driver="GPKG")
    return geom


# --------------------------------------------------------------------------- #
# Geometry cleaning — OSM spike removal
# --------------------------------------------------------------------------- #
# A "spike" (needle) is an OSM digitizing artefact: a single vertex dragged far
# from the polygon body so the ring runs out and straight back, leaving a long
# zero-ish-width spur. `make_valid()` does NOT remove these (a thin triangle is
# topologically valid), so they inflate areas and render as long lines on the map.
# Real example fixed by this: osm_id 863261572 ("Unnamed forest near Malcolm") had
# one vertex ~4 km south of the rest, inflating its area by ~3.3 ha.
#
# Thresholds are deliberately conservative so genuine geometry is never trimmed:
# a tip is removed only when BOTH incident edges exceed SPIKE_MIN_SPUR_M *and* the
# out-and-back detour is more than SPIKE_MAX_RATIO times the straight gap between
# the tip's neighbours. Traced forest boundaries have vertices tens of metres apart,
# so a >500 m spur that returns to a near point is unambiguously an error, not a
# legitimate long boundary edge (those have their neighbours far apart -> low ratio).
SPIKE_MIN_SPUR_M = 500.0
SPIKE_MAX_RATIO = 8.0


def _despike_ring(coords, min_spur_m: float, max_ratio: float):
    """Drop single-vertex needle tips from one closed ring's coordinate sequence.

    A tip is a vertex whose two incident edges are both long yet return to a near
    point (the OSM mis-dragged-node artefact). Iterated, so a spike exposed by
    removing an adjacent tip is stripped too. Returns the cleaned closed ring (first
    point repeated), or ``None`` if it collapses below a triangle. Coordinates must
    be in a metric CRS (distances are treated as metres).
    """
    ring = [tuple(c) for c in coords]
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring = ring[:-1]
    changed = True
    while changed and len(ring) > 3:
        changed = False
        n = len(ring)
        drop = [False] * n
        for i in range(n):
            a, v, b = ring[(i - 1) % n], ring[i], ring[(i + 1) % n]
            spur_a, spur_b = math.dist(a, v), math.dist(v, b)
            base = math.dist(a, b)
            if (
                spur_a > min_spur_m
                and spur_b > min_spur_m
                and (spur_a + spur_b) > max_ratio * base
            ):
                drop[i] = True
                changed = True
        if changed:
            ring = [p for i, p in enumerate(ring) if not drop[i]]
    if len(ring) < 3:
        return None
    return ring + [ring[0]]


def despike_geometry(geom, min_spur_m: float = SPIKE_MIN_SPUR_M,
                     max_ratio: float = SPIKE_MAX_RATIO):
    """Remove needle spikes from a (Multi)Polygon, in its own (metric) CRS units.

    Non-polygonal or empty input is returned unchanged; a polygon whose exterior
    collapses is dropped (``None``). Interior rings that collapse are simply omitted.
    """
    if geom is None or geom.is_empty or geom.geom_type not in ("Polygon", "MultiPolygon"):
        return geom

    def fix_poly(poly):
        ext = _despike_ring(poly.exterior.coords, min_spur_m, max_ratio)
        if ext is None:
            return None
        holes = []
        for interior in poly.interiors:
            h = _despike_ring(interior.coords, min_spur_m, max_ratio)
            if h is not None:
                holes.append(h)
        cleaned = Polygon(ext, holes)
        return cleaned if cleaned.is_valid else cleaned.buffer(0)

    if geom.geom_type == "Polygon":
        return fix_poly(geom)
    parts = [fix_poly(p) for p in geom.geoms]
    parts = [p for p in parts if p is not None and not p.is_empty]
    if not parts:
        return None
    return parts[0] if len(parts) == 1 else MultiPolygon(parts)


def load_forest(mask) -> gpd.GeoDataFrame:
    """OSM natural='forest' (+ landuse='forest' if any), clipped to Singapore, EPSG:3414."""
    frames = []
    nat = gpd.read_file(f"/vsizip/{OSM_ZIP}/natural.shp", engine="pyogrio")
    frames.append(nat[nat["type"] == "forest"].assign(source_layer="natural"))
    lu = gpd.read_file(f"/vsizip/{OSM_ZIP}/landuse.shp", engine="pyogrio")
    lu_forest = lu[lu["type"] == "forest"]
    if len(lu_forest):
        frames.append(lu_forest.assign(source_layer="landuse"))
    forest = pd.concat(frames, ignore_index=True)
    forest = gpd.GeoDataFrame(forest, geometry="geometry", crs=nat.crs).to_crs(AREA_CRS)
    forest["geometry"] = forest.geometry.make_valid()
    # Strip OSM digitizing spikes (needle vertices placed far from the polygon body)
    # before they inflate areas and render as long spurs. Runs in metric EPSG:3414.
    forest["geometry"] = forest.geometry.apply(despike_geometry)
    forest = forest[forest.geometry.notna() & ~forest.geometry.is_empty].copy()
    forest["geometry"] = forest.geometry.make_valid()
    forest = gpd.clip(forest, mask)
    forest = forest[forest.geometry.notna() & ~forest.geometry.is_empty].copy()
    # Keep polygonal parts only (clip can yield lines/points at borders).
    forest = forest.explode(index_parts=False)
    forest = forest[forest.geometry.geom_type.isin(["Polygon", "MultiPolygon"])].copy()
    forest = forest.dissolve(by="osm_id", aggfunc={"name": "first", "source_layer": "first"}).reset_index()
    forest["forest_area_ha"] = forest.geometry.area / 1e4
    # Apply curated display names to polygons OSM never named (exact osm_id, not a
    # bbox; see site_context.FOREST_NAME_OVERRIDES). Only fills where OSM is blank,
    # so real OSM names (incl. the validated "Maju Forest") are never overwritten.
    forest["name"] = forest.apply(
        lambda r: r["name"]
        if isinstance(r["name"], str) and r["name"].strip()
        else name_override_for_osm_id(r["osm_id"]),
        axis=1,
    )
    return forest


def load_localities(mask) -> gpd.GeoDataFrame:
    """OSM place points inside Singapore, for labelling unnamed forest patches."""
    places = gpd.read_file(f"/vsizip/{OSM_ZIP}/places.shp", engine="pyogrio").to_crs(AREA_CRS)
    places = places[places["type"].isin(PLACE_LABEL_TYPES)].copy()
    places = places[places.within(mask)].copy()
    return places[["name", "type", "geometry"]].rename(columns={"name": "locality"})


# --------------------------------------------------------------------------- #
# Core analysis
# --------------------------------------------------------------------------- #
def compute_threatened(forest: gpd.GeoDataFrame, dev: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Overlay forest x development zones -> per-fragment threatened geometry."""
    # Overlay is bounded by the tiny forest set; geopandas uses a spatial index internally.
    frag = gpd.overlay(
        forest[["osm_id", "name", "source_layer", "forest_area_ha", "geometry"]],
        dev[["OBJECTID", "LU_DESC", "GPR", "geometry"]],
        how="intersection",
        keep_geom_type=True,
    )
    frag = frag[frag.geometry.notna() & ~frag.geometry.is_empty].copy()
    frag["area_ha"] = frag.geometry.area / 1e4
    frag = frag[frag["area_ha"] > 0]
    return frag


def involved_development_zones(forest: gpd.GeoDataFrame, dev: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """The URA MP2025 development polygons that actually overlap forest (full, unclipped
    geometry) — the masterplan side of the analysis, for context display in the app."""
    hit = gpd.sjoin(dev, forest[["osm_id", "geometry"]], predicate="intersects", how="inner")
    ids = hit["OBJECTID"].unique()
    zones = dev[dev["OBJECTID"].isin(ids)].copy()
    zones["area_ha"] = (zones.geometry.area / 1e4).round(4)
    zones["source"] = "URA_MP2025"
    return zones


def forest_label(name, locality) -> str:
    """Display label for a forest polygon: the OSM name if present, else
    "Forest near <nearest locality>". Shared by the threatened patches and the
    all-forest context layer so an unnamed patch reads identically in both."""
    nm = (name or "").strip() if isinstance(name, str) else ""
    if nm:
        return nm
    loc = locality if isinstance(locality, str) and locality else "unknown area"
    return f"Forest near {loc}"


def attach_nearest_locality(gdf: gpd.GeoDataFrame,
                            localities: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Merge a `locality` column: the name of the nearest OSM place point to each
    polygon's representative point. Keyed on osm_id; used to label unnamed forest."""
    cent = gdf[["osm_id", "geometry"]].copy()
    cent["geometry"] = cent.geometry.representative_point()
    cent = gpd.sjoin_nearest(cent, localities, how="left")
    cent = cent.drop_duplicates("osm_id").set_index("osm_id")["locality"]
    return gdf.merge(cent.rename("locality"), on="osm_id", how="left")


def aggregate_patches(frag: gpd.GeoDataFrame, forest: gpd.GeoDataFrame,
                      localities: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Aggregate threatened fragments to one record per forest polygon (osm_id)."""
    # Geometry: union of threatened fragments per forest polygon.
    geom = frag.dissolve(by="osm_id")[["geometry"]]

    # Per-osm_id attribute aggregates.
    rows = []
    for osm_id, grp in frag.groupby("osm_id"):
        by_lu = grp.groupby("LU_DESC")["area_ha"].sum().sort_values(ascending=False)
        gprs = sorted({str(g) for g in grp["GPR"].dropna().unique() if str(g).strip()})
        rows.append({
            "osm_id": osm_id,
            "area_ha": round(float(grp["area_ha"].sum()), 4),
            "dominant_lu_desc": by_lu.index[0],
            "lu_desc_breakdown": {k: round(float(v), 4) for k, v in by_lu.items()},
            "gpr": ", ".join(gprs) if gprs else None,
        })
    agg = pd.DataFrame(rows).set_index("osm_id")

    patches = geom.join(agg)
    patches = gpd.GeoDataFrame(patches, geometry="geometry", crs=AREA_CRS).reset_index()

    # Attach forest name + full forest area.
    fmeta = forest.set_index("osm_id")[["name", "forest_area_ha", "source_layer"]]
    patches = patches.merge(fmeta, on="osm_id", how="left")
    patches["forest_area_ha"] = patches["forest_area_ha"].round(4)
    patches["threatened_fraction"] = (patches["area_ha"] / patches["forest_area_ha"]).clip(upper=1.0).round(4)

    # Nearest locality label (computed on threatened geometry centroids).
    patches = attach_nearest_locality(patches, localities)

    # Human label + curated context.
    patches["label"] = patches.apply(
        lambda r: forest_label(r["name"], r["locality"]), axis=1
    )
    ctx = patches["name"].apply(context_for_name)
    patches["context"] = ctx.apply(lambda c: c["context"] if c else None)
    patches["wildlife"] = ctx.apply(lambda c: c.get("wildlife") if c else None)
    patches["status"] = ctx.apply(lambda c: c.get("status") if c else None)

    # Context comes only from a matched OSM forest *name* (above). We deliberately
    # do NOT relabel unnamed patches by a location bounding box: a lon/lat box
    # aligns to nothing on the ground, mislabels neighbouring slivers of the same
    # forest, and would let us claim named sites the data doesn't actually name.

    # Representative point in lon/lat.
    rp = patches.to_crs(WEB_CRS).geometry.representative_point()
    patches["centroid_lon"] = rp.x.round(6)
    patches["centroid_lat"] = rp.y.round(6)

    patches = patches.sort_values("area_ha", ascending=False).reset_index(drop=True)
    patches["rank"] = patches.index + 1
    return patches


def annotate_deforested(deforested: gpd.GeoDataFrame, mp: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Annotate each already-cleared forest with its URA MP2025 zoning.

    The two hand-traced polygons (Tengah Forest, Dover Forest East) are secondary
    forest that has *already* been cleared for development. Unlike the threatened
    overlay, we keep the original cleared footprint as geometry and only *read* the
    masterplan beneath it: overlay against MP2025 to get the area-weighted dominant
    land-use (LU_DESC) and the set of plot ratios (GPR) — the same attribute logic
    aggregate_patches uses for threatened patches. Cost is bounded by these 2
    polygons: an sjoin first narrows MP2025 to the handful of parcels they touch
    (same pattern as involved_development_zones), then overlay runs on that subset.
    """
    d = deforested.copy()
    # The curated input carries an OSM-style `@id` — a stable UUID per cleared
    # forest. Keep it as `uid`: it's the share/deep-link identifier the app routes
    # on (`/forest/<uid>`), disjoint from the threatened layer's numeric OSM ids.
    if "@id" in d.columns:
        d = d.rename(columns={"@id": "uid"})
    d["id"] = range(len(d))
    d["area_ha"] = (d.geometry.area / 1e4).round(4)

    # Narrow MP2025 to the parcels the cleared areas actually touch, then overlay.
    hit = gpd.sjoin(mp, d[["id", "geometry"]], predicate="intersects", how="inner")
    mp_cand = mp[mp["OBJECTID"].isin(hit["OBJECTID"].unique())]
    frag = gpd.overlay(
        d[["id", "geometry"]],
        mp_cand[["OBJECTID", "LU_DESC", "GPR", "geometry"]],
        how="intersection",
        keep_geom_type=True,
    )
    frag = frag[frag.geometry.notna() & ~frag.geometry.is_empty].copy()
    frag["frag_area_ha"] = frag.geometry.area / 1e4

    # Per cleared area: dominant (area-weighted) zoning + the set of plot ratios.
    rows = []
    for fid, grp in frag.groupby("id"):
        by_lu = grp.groupby("LU_DESC")["frag_area_ha"].sum().sort_values(ascending=False)
        gprs = sorted({str(g) for g in grp["GPR"].dropna().unique() if str(g).strip()})
        rows.append({
            "id": fid,
            "dominant_lu_desc": by_lu.index[0] if len(by_lu) else None,
            "lu_desc_breakdown": {k: round(float(v), 4) for k, v in by_lu.items()},
            "gpr": ", ".join(gprs) if gprs else None,
        })
    agg = pd.DataFrame(rows, columns=["id", "dominant_lu_desc", "lu_desc_breakdown", "gpr"])
    d = d.merge(agg, on="id", how="left")

    d["source"] = "curated ∩ URA_MP2025"
    rp = d.to_crs(WEB_CRS).geometry.representative_point()
    d["centroid_lon"] = rp.x.round(6)
    d["centroid_lat"] = rp.y.round(6)
    return d


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #
def validate(frag: gpd.GeoDataFrame, forest: gpd.GeoDataFrame) -> dict:
    """Sanity-check the method against the one publicly-announced site it can
    actually test: Maju Forest, a *named* secondary forest that the pipeline must
    recover by its OSM name. (Gillman Barracks — the other announced site — is
    excluded: it is mostly redevelopment of the historic barracks, not forest
    clearance, so a forest overlay can't honestly claim to recover it.)"""
    sites = []

    # Maju Forest — recover by OSM name (a named forest polygon exists).
    maju_present = float(forest.loc[forest["name"] == "Maju Forest", "forest_area_ha"].sum())
    maju_threat = float(frag.loc[frag["name"] == "Maju Forest", "area_ha"].sum())
    sites.append({
        "site": "Maju Forest",
        "method": "name match (natural=forest, name='Maju Forest')",
        "forest_present_ha": round(maju_present, 2),
        "threatened_ha": round(maju_threat, 2),
        "recovered": maju_threat > 1.0,
    })

    overall = all(s["recovered"] for s in sites)
    return {"overall_pass": overall, "sites": sites}


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #
def build_summary(patches: gpd.GeoDataFrame, forest: gpd.GeoDataFrame,
                  frag: gpd.GeoDataFrame, validation: dict) -> dict:
    by_lu = (frag.groupby("LU_DESC")["area_ha"].agg(["sum", "count"])
             .sort_values("sum", ascending=False))
    by_lu_list = [{"lu_desc": k, "area_ha": round(float(r["sum"]), 2), "n_fragments": int(r["count"])}
                  for k, r in by_lu.iterrows()]

    # Named forests aggregated by name.
    named = patches[patches["name"].notna() & (patches["name"].astype(str).str.len() > 0)]
    named_list = [
        {"name": n, "threatened_ha": round(float(g["area_ha"].sum()), 2)}
        for n, g in named.groupby("name")
    ]
    named_list.sort(key=lambda x: -x["threatened_ha"])

    top = patches.head(TOP_N)
    top_sites = [{
        "rank": int(r["rank"]),
        "label": r["label"],
        "name": r["name"] if isinstance(r["name"], str) and r["name"] else None,
        "locality": r["locality"] if isinstance(r["locality"], str) and r["locality"] else None,
        "area_ha": round(float(r["area_ha"]), 2),
        "forest_area_ha": round(float(r["forest_area_ha"]), 2),
        "threatened_fraction": round(float(r["threatened_fraction"]), 3),
        "dominant_lu_desc": r["dominant_lu_desc"],
        "gpr": r["gpr"],
        "centroid": [float(r["centroid_lon"]), float(r["centroid_lat"])],
        "context": r["context"],
        "wildlife": r["wildlife"],
        "status": r["status"],
    } for _, r in top.iterrows()]

    total_forest = float(forest["forest_area_ha"].sum())
    total_threat = float(patches["area_ha"].sum())
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provenance": {
            "masterplan": "URA Master Plan 2025 Land Use Layer (data.gov.sg, dataset d_a8c3546b26712e35021f3a681d0353ae) — G_MP25_LANDUSE_PL",
            "masterplan_url": "https://data.gov.sg/datasets/d_a8c3546b26712e35021f3a681d0353ae/view",
            "forest_source": "OpenStreetMap natural=forest (BBBike Singapore extract, osmium2shape)",
            "forest_source_url": "https://download2.bbbike.org/osm/extract/planet_103.531,1.213_104.195,1.644.osm.shp.zip",
            "area_crs": f"EPSG:{AREA_CRS} (SVY21)",
            "export_crs": f"EPSG:{WEB_CRS} (WGS84)",
        },
        "totals": {
            "total_forest_ha_sg": round(total_forest, 1),
            "total_threatened_ha": round(total_threat, 1),
            "threatened_fraction_of_mapped_forest": round(total_threat / total_forest, 3),
            "n_forest_polygons_sg": int(len(forest)),
            "n_threatened_patches": int(len(patches)),
        },
        "by_lu_desc": by_lu_list,
        "named_forests_threatened": named_list,
        "top_sites": top_sites,
        "methodology": {
            "summary": (
                "Currently-standing OSM forest that MP2025 designates for development "
                "(forest polygons intersected with development-zoned land)."
            ),
            "development_zones": sorted(DEVELOPMENT_ZONES),
            "protected_zones_excluded": sorted(PROTECTED_ZONES),
            "note_scope": "Planned footprint under MP2025 — NOT a measured increase vs MP2019.",
        },
        "validation": validation,
        "caveats": [
            "OSM crowd-sourced canopy is not an authoritative land-cover survey; currency varies and some mapped 'forest' may already be cleared.",
            "Development zoning does not guarantee clearance; EIA and retained-green frameworks may spare parts of a site.",
            "RESERVE SITE is land held for future use — a strong but not immediate development signal; SPECIAL USE may include land that stays forested (e.g. training areas). See by_lu_desc for the breakdown.",
            "The development-zone inclusion list is an explicit, configurable judgment (see methodology.development_zones).",
        ],
    }


def _json_safe(obj):
    """Recursively replace non-finite floats (NaN/Inf) with None.

    pandas/numpy leave NaN in optional fields (e.g. unnamed sites' context/wildlife/
    status). A bare ``NaN`` token is not valid JSON and breaks strict consumers such as
    browsers' ``JSON.parse`` (the web app fetches these files), so emit ``null`` instead.
    """
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    return obj


def write_json(obj, path: Path) -> None:
    path.write_text(json.dumps(_json_safe(obj), indent=2))


def write_geojson(gdf: gpd.GeoDataFrame, path: Path) -> None:
    gdf.to_crs(WEB_CRS).to_file(path, driver="GeoJSON")


def main() -> None:
    t0 = time.time()
    RESULTS.mkdir(exist_ok=True)

    mp = load_masterplan()
    log(f"MP2025 loaded: {len(mp):,} polygons", t0)

    mask = singapore_mask(mp)
    log(f"Singapore mask ready ({mask.area/1e4:,.0f} ha)", t0)

    forest = load_forest(mask)
    log(f"Forest (SG-clipped): {len(forest):,} polygons, {forest['forest_area_ha'].sum():,.0f} ha", t0)

    localities = load_localities(mask)
    log(f"Localities for labelling: {len(localities):,}", t0)

    deforested = gpd.read_file(DATA / "deforested.geojson", engine="pyogrio").to_crs(AREA_CRS)
    deforested["geometry"] = deforested.geometry.make_valid()
    log(f"Already-cleared forests loaded: {len(deforested):,}", t0)

    dev = mp[mp["LU_DESC"].isin(DEVELOPMENT_ZONES)].copy()
    frag = compute_threatened(forest, dev)
    log(f"Threatened fragments: {len(frag):,}, {frag['area_ha'].sum():,.1f} ha", t0)

    dev_involved = involved_development_zones(forest, dev)
    log(f"URA development polygons overlapping forest: {len(dev_involved):,}", t0)

    patches = aggregate_patches(frag, forest, localities)
    log(f"Threatened patches: {len(patches):,}", t0)

    deforested_annot = annotate_deforested(deforested, mp)
    log(f"Already-cleared forests annotated with MP2025 zoning: {len(deforested_annot):,}", t0)

    validation = validate(frag, forest)
    log(f"Validation overall_pass={validation['overall_pass']}", t0)
    for s in validation["sites"]:
        flag = "OK " if s["recovered"] else "!! "
        log(f"  {flag}{s['site']}: threatened {s['threatened_ha']} ha "
            f"(forest present {s['forest_present_ha']} ha)", t0)
    if not validation["overall_pass"]:
        log("WARNING: Maju Forest did not recover — investigate the tagging assumption before trusting output.", t0)

    # --- write outputs ---
    # 1. Intersection result: the planned-deforestation footprint (OSM forest ∩ URA dev zones).
    threat_out = patches[[
        "osm_id", "rank", "label", "name", "locality", "area_ha", "forest_area_ha",
        "threatened_fraction", "dominant_lu_desc", "lu_desc_breakdown", "gpr",
        "centroid_lon", "centroid_lat", "source_layer", "context", "wildlife", "status",
        "geometry",
    ]].copy()
    threat_out["lu_desc_breakdown"] = threat_out["lu_desc_breakdown"].apply(json.dumps)
    threat_out["source"] = "OSM_forest ∩ URA_MP2025"
    threat_out = threat_out.rename(columns={"osm_id": "id"})
    write_geojson(threat_out, RESULTS / "threatened_forests.geojson")

    # 2. OSM source geometry: ALL Singapore forest (threatened or not), for context.
    # Carry the same human label as the threatened layer — the OSM name, else
    # "Forest near <nearest locality>" — so the map popup names an unnamed patch
    # by its area instead of a bare "Unnamed forest".
    forest_labeled = attach_nearest_locality(forest, localities)
    forest_labeled["label"] = forest_labeled.apply(
        lambda r: forest_label(r["name"], r["locality"]), axis=1
    )
    forest_out = forest_labeled[
        ["osm_id", "name", "label", "forest_area_ha", "source_layer", "geometry"]
    ].copy()
    forest_out["source"] = "OSM"
    forest_out = forest_out.rename(columns={"osm_id": "id"})
    write_geojson(forest_out, RESULTS / "forest_all.geojson")

    # 3. URA masterplan source geometry: the development polygons that overlap forest.
    zones_out = dev_involved[["OBJECTID", "LU_DESC", "GPR", "area_ha", "source", "geometry"]].copy()
    zones_out = zones_out.rename(columns={"OBJECTID": "id", "LU_DESC": "lu_desc", "GPR": "gpr"})
    write_geojson(zones_out, RESULTS / "development_zones.geojson")

    # 4. Already-cleared forests: the ORIGINAL cleared footprint, annotated with the
    #    MP2025 zoning that replaced it (dominant land-use + plot ratio). Context only —
    #    not part of the threatened overlay or the validation gate.
    deforested_out = deforested_annot[[
        "id", "uid", "name", "area_ha", "dominant_lu_desc", "lu_desc_breakdown", "gpr",
        "centroid_lon", "centroid_lat", "source", "geometry",
    ]].copy()
    deforested_out["lu_desc_breakdown"] = deforested_out["lu_desc_breakdown"].apply(
        lambda v: json.dumps(v) if isinstance(v, dict) else None
    )
    write_geojson(deforested_out, RESULTS / "deforested.geojson")

    summary = build_summary(patches, forest, frag, validation)
    summary["layers"] = [
        {"file": "threatened_forests.geojson", "source": "OSM_forest ∩ URA_MP2025",
         "geometry": "Polygon", "role": "intersection result — planned deforestation footprint",
         "features": int(len(threat_out))},
        {"file": "forest_all.geojson", "source": "OSM",
         "geometry": "Polygon", "role": "all mapped OSM natural=forest inside Singapore (context base layer)",
         "features": int(len(forest_out))},
        {"file": "development_zones.geojson", "source": "URA_MP2025",
         "geometry": "Polygon", "role": "URA development polygons overlapping forest (context)",
         "features": int(len(zones_out))},
        {"file": "deforested.geojson", "source": "curated ∩ URA_MP2025",
         "geometry": "MultiPolygon", "role": "already-cleared forest, annotated with MP2025 zoning (context)",
         "features": int(len(deforested_out))},
    ]
    write_json(summary, RESULTS / "summary.json")
    write_json(validation, RESULTS / "validation.json")

    log(f"Wrote results/ (threatened_forests.geojson, forest_all.geojson, "
        f"development_zones.geojson, deforested.geojson, summary.json, validation.json)", t0)
    log(f"DONE in {time.time()-t0:.1f}s", t0)


if __name__ == "__main__":
    main()
