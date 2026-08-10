# CLAUDE.md — context for future agents

Read this before working in the repo so you don't re-derive what's already settled.

## What this project is
Determine **what forest/greenery the URA Master Plan 2025 (MP2025) plans to develop**
in Singapore, name the affected areas, and **validate** the method against the two
publicly-announced sites (Maju Forest, Gillman Barracks). Outputs feed a separate
Next.js app for visual storytelling.

## Hard boundaries
- **Do not modify `app/`.** It's a separate project with its own `CLAUDE.md`/`README.md`.
  We only produce analysis (`analysis/`) and data (`results/`).
- **Treat `data/` as read-only.** Decompressed/intermediate files go to
  `analysis/.cache/` (gitignored), never into `data/` or `results/`.

## Locked methodology decisions (and why)
- **Forest source = OSM `natural='forest'`.** Verified: `landuse='forest'` is **empty**
  in this extract, and official datasets omit secondary forest. Code keeps a defensive
  union with `landuse='forest'` but `natural` is the real source. (~1,142 raw polygons;
  831 after clipping to Singapore.)
- **Scope = planned footprint under MP2025**, i.e. standing forest on development-zoned
  land. **Not** a delta vs MP2019 — the user explicitly does not want an "increase"
  claim, just what is planned.
- **CRS**: compute areas in **EPSG:3414** (SVY21, metres); export geometry in
  **EPSG:4326** (lon/lat) for web maps. (The original briefing's EPSG:3414 export was
  wrong for web rendering — corrected.)
- **Keep per-fragment `LU_DESC` + `GPR`** through the overlay (no blind dissolve) so
  each threatened patch knows its intended use and plot ratio.
- **Every affected area carries a name** (OSM `name`, else nearest OSM locality) and,
  where known, curated context from `analysis/site_context.py`.
- **Output all three geometry layers** (OSM forest, URA dev zones, intersection), each
  stamped with a `source` property — the app must be able to show the inputs, not just
  the overlap.

## Compute rules (avoid blowup)
- The forest set is tiny (~831 polygons) vs MP2025's ~113k. **Bound all cost by the
  forest set.** Never run a national polygon difference or dissolve all dev zones.
- The single expensive op is the Singapore mask (`union_all` of MP2025) — it's **cached**
  to `analysis/.cache/singapore_mask.gpkg` and reused. First run ~13s, later ~6s.
- Clip OSM forest to Singapore with that mask (the OSM extract bleeds into Johor).

## Data facts
- MP2025 (`data/MasterPlan2025LandUseLayer.geojson.gz`): 113,394 polygons, WGS84,
  `G_MP25_LANDUSE_PL`. Attrs used: `OBJECTID`, `LU_DESC`, `GPR`.
- `LU_DESC` split into `DEVELOPMENT_ZONES` vs `PROTECTED_ZONES` at the top of
  `run_analysis.py` — an explicit, configurable judgment. There is **no** "NATURE
  RESERVE" / "NATURAL OPEN SPACE" class in the data (contrary to the original briefing).
- OSM (`data/osm-singapore.zip`): `natural.shp` `type` ∈ {forest, park, water};
  `landuse.shp` has **0** forest; `places.shp` gives locality labels (mixes in Johor —
  filter to inside the Singapore mask).

## Validation gate (must stay green)
`results/validation.json` → `overall_pass` must be `true`. Maju Forest recovers by name
(~21.7 ha), Gillman Barracks by AOI (~0.8 ha). If it goes false, the tagging assumption
or an AOI in `site_context.py` is wrong — fix before trusting discovery output.

## Run
```bash
cd analysis && poetry install && poetry run python run_analysis.py
```
Env: pyenv Python 3.12.11 (pinned), Poetry 2.x, deps locked in `poetry.lock`. See
`analysis/README.md` for details.

## Key files
- `analysis/run_analysis.py` — the whole pipeline (load → mask → forest → overlay →
  aggregate → validate → write). Single entry point.
- `analysis/site_context.py` — curated site context + validation AOIs (edit freely).
- `results/*.geojson` + `summary.json` + `validation.json` — outputs; `summary.json`
  has a `layers` manifest describing each file.
