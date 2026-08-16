# Analysis — Planned deforestation under URA Master Plan 2025

This folder holds the spatial pipeline that identifies **forest that Singapore's URA
Master Plan 2025 (MP2025) designates for development**, and sanity-checks the method
against the one site it can honestly test by name: **Maju Forest**. (Gillman Barracks —
the other announced site — has no OSM forest tag; its forest is now ingested as a
contributed polygon and measured by the same overlay, not used as a validation site.)

Everything here is reproducible from the raw inputs in `../data/`. Outputs land in
`../results/` as web-map-ready GeoJSON + JSON.

---

## 1. Prerequisites

- [`pyenv`](https://github.com/pyenv/pyenv) with **Python 3.12.11** installed
  (`pyenv install 3.12.11`). The version is pinned by `.python-version`.
- [Poetry](https://python-poetry.org/) **2.x**. If you don't have it:
  ```bash
  "$(pyenv prefix 3.12.11)/bin/python" -m pip install poetry
  ```

No system GDAL is required — `pyogrio` ships GDAL via its wheel.

## 2. Install

```bash
cd analysis
pyenv local 3.12.11                 # already set via .python-version
poetry env use "$(pyenv prefix 3.12.11)/bin/python"
poetry install                      # installs from the committed poetry.lock
```

Locked dependency versions (see `poetry.lock`): geopandas 1.1.x, pyogrio 0.13.x,
shapely 2.1.x, pyproj 3.7.x, pandas 3.0.x.

## 3. Run

```bash
poetry run python run_analysis.py
```

Runtime is ~6–13 s (the Singapore mask is cached after the first run). Expected tail:

```
Forest (SG-clipped): 833 polygons, 5,059 ha
Threatened fragments: 1,694, 2,992.8 ha
Validation overall_pass=True
  OK Maju Forest: threatened 21.69 ha (forest present 21.69 ha)
```

If `overall_pass` is **False**, Maju Forest failed to recover — investigate the OSM
tagging assumption before trusting the discovery output.

---

## 4. Inputs (read-only, from `../data/`)

| File | What it is | Source |
| --- | --- | --- |
| `MasterPlan2025LandUseLayer.geojson.gz` | URA MP2025 land-use polygons (`G_MP25_LANDUSE_PL`), WGS84. Key attrs: `LU_DESC`, `GPR`, `OBJECTID`. | [data.gov.sg dataset `d_a8c3546b26712e35021f3a681d0353ae`](https://data.gov.sg/datasets/d_a8c3546b26712e35021f3a681d0353ae/view) |
| `osm-singapore.zip` | OSM shapefiles — BBBike extract (`osmium2shape`, 8-layer schema; same fixed layer set as Geofabrik-style). We use `natural.shp` (forest polygons) and `places.shp` (locality labels). | [BBBike Singapore extract](https://download2.bbbike.org/osm/extract/planet_103.531,1.213_104.195,1.644.osm.shp.zip) |
| `gillman_forest.geojson` | Contributed (non-OSM) forest polygons for the Gillman site, whose canopy is absent from OSM. MultiPolygons, WGS84. | Contributed / hand-traced (provenance to confirm) |
| `bukit_brown.geojson` | Contributed (non-OSM) forest polygons for the Bukit Brown site (~42.5 ha). MultiPolygons, WGS84. Re-includes the Gillman polygons (byte-identical, so they dissolve together — no double count). | Contributed / hand-traced (provenance to confirm) |

## 5. Outputs (written to `../results/`)

All GeoJSON is **EPSG:4326 (lon/lat)**; areas are computed in **EPSG:3414 (SVY21, metres)**.

| File | Source | Role |
| --- | --- | --- |
| `threatened_forests.geojson` | `OSM_forest ∩ URA_MP2025` (`contributed_forest ∩ URA_MP2025` for non-OSM patches) | **Headline result** — forest on development-zoned land, one feature per forest polygon, with name/locality, area, dominant land use, plot ratio, and curated context. |
| `forest_all.geojson` | `OSM` (`contributed` for non-OSM patches) | All mapped Singapore forest (threatened or not) — context base layer. |
| `development_zones.geojson` | `URA_MP2025` | The MP2025 development polygons that overlap forest — the masterplan side, for context. |
| `deforested.geojson` | `curated ∩ URA_MP2025` | Forest **already cleared** (Tengah Forest, Dover Forest East) — the original hand-traced footprint, annotated with the MP2025 zoning that replaced it (dominant land use + plot ratio). Context only; not part of the overlay or validation. |
| `summary.json` | — | Totals, per-`LU_DESC` breakdown, ranked top sites, named forests, methodology, validation, caveats, and a `layers` manifest. |
| `validation.json` | — | Maju Forest recovery report + `overall_pass` (the sanity-check gate — Maju alone). |

## 6. Methodology (what the pipeline does)

1. **Load MP2025** → EPSG:3414, fix invalid geometry.
2. **Singapore mask** = union of all MP2025 polygons (cached to `.cache/`). The OSM
   extract bleeds into Johor, Malaysia; this mask clips forest to Singapore so totals
   are honest.
3. **Forest source** = OSM `natural='forest'` (defensively unioned with
   `landuse='forest'`, which is **empty** in this extract — confirming `natural` holds
   all the forest data), clipped to Singapore. 831 polygons, ~5,007 ha — **plus
   contributed (non-OSM) forest polygons** (see `CONTRIBUTED_FOREST_SOURCES` in
   `run_analysis.py`: `data/gillman_forest.geojson`, `data/bukit_brown.geojson`),
   normalized into the same forest frame (synthetic stable `osm_id`, `desc`→`name`) and
   run through the identical overlay below, no special-casing.
4. **Overlay** forest × MP2025 **development** zones (see `DEVELOPMENT_ZONES` in
   `run_analysis.py`), keeping each fragment's `LU_DESC` and `GPR`.
5. **Aggregate** fragments to one record per forest polygon; label by OSM `name`, else
   nearest OSM locality; attach curated context from `site_context.py`, keyed on the
   forest name (contributed polygons carry their own name, e.g. `Gillman Forest`).
6. **Validate** against Maju Forest (by name) — the one site the method can honestly
   test. No AOI/bounding-box matching (removed as unprincipled); contributed sources
   like Gillman are input data, not validation sites.

**Compute note:** cost is bounded by the small forest set (≈831 polygons), not the
113k-feature masterplan. We never run a national polygon difference; the only union is
the one-time cached Singapore mask.

### Development vs protected zones
The `DEVELOPMENT_ZONES` / `PROTECTED_ZONES` split (top of `run_analysis.py`) is an
explicit, auditable judgment — edit those sets to change the definition. `by_lu_desc`
in `summary.json` always shows the breakdown so no single number hides the mix
(e.g. RESERVE SITE dominates and is a *reserved-for-future* signal, not imminent
clearance).

## 7. Why OpenStreetMap (plus contributed polygons), and caveats

**Why OSM `natural=forest`, not official data.** There is no authoritative *vector*
dataset of Singapore's secondary forests, which is what makes OSM the practical choice:

- **Official data maps only gazetted spaces.** NParks / data.gov.sg vector layers cover
  statutorily protected or managed areas (Central Catchment, Bukit Timah, Sungei Buloh,
  managed parks) — not the non-gazetted secondary growth that Clementi/Dover/Tengah-type
  patches represent.
- **The Master Plan tracks zoning *intent*, not ground cover.** A `RESERVE SITE` polygon
  might currently be a 50-year-old secondary forest or a flat patch of grass — URA
  classifies both identically by future administrative intent, so official data alone is
  blind to what actually grows inside a development zone.
- **OSM is a vector of physical reality.** Contributors trace high-resolution satellite
  imagery (Sentinel, Maxar) into `natural=forest` polygons — a pre-vectorized map of
  physical canopy that aligns directly with the URA vector layer.
- **The only authoritative alternative is raster.** ESA WorldCover (10 m), Google Dynamic
  World and Hansen Global Forest Change are scientifically validated but ship as pixel
  grids, needing raster→vector conversion and heavy cleanup (10 m pixels routinely
  misclassify urban shadows, rooftops and roadside planting as "forest").

So OSM is the most frictionless pre-vectorized canopy source for this vector overlay.
It isn't complete, though: a spike confirmed Gillman Forest's canopy is **0.00 ha**
overlap with OSM `natural=forest` — genuinely untagged, not a labeling bug. For a
polygon like that, the pipeline accepts a **contributed (non-OSM) forest polygon**
(`data/gillman_forest.geojson`) as an equally-valid canopy source, normalized into the
same frame and run through the identical MP2025 overlay — no special-casing, no assumed
outcome. On MP2025's zoning it reports as a ~12.65 ha vulnerable patch (RESIDENTIAL, GPR
`SDP`, ~97.9% of the polygon on development-zoned land); a different zoning would have
reported near-zero, with no different treatment either way.

Used with these caveats:

- OSM crowd-sourced canopy is not an authoritative land-cover survey; some mapped
  "forest" may already be cleared, and currency varies.
- Development zoning ≠ guaranteed clearance; EIA and retained-green frameworks may
  spare parts of a site.
- This is the **planned footprint under MP2025**, *not* a measured increase vs MP2019.

## 8. Files in this folder

```
pyproject.toml / poetry.lock  Locked environment
.python-version               pyenv pin (3.12.11)
run_analysis.py               The pipeline (single entry point)
site_context.py               Curated site context + forest-name overrides (keyed on name)
.cache/                       Decompressed inputs + Singapore mask (gitignored, regenerated)
```
