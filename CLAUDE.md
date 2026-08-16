# CLAUDE.md — context for future agents

Read this before working in the repo so you don't re-derive what's already settled.

## What this project is
Determine **what forest/greenery the URA Master Plan 2025 (MP2025) plans to develop**
in Singapore, name the affected areas, and **sanity-check** the method against the one
publicly-announced site it can honestly test by name: **Maju Forest** (a *named*
secondary forest recovered by OSM name; see the validation note below — this gate is
Maju alone). The other announced site, **Gillman Barracks**, is mostly historic
barracks buildings, not forest — but its forested portion (absent from OSM) is now
ingested as a **contributed (non-OSM) forest polygon**
(`data/gillman_forest.geojson`) and runs through the identical MP2025 overlay as every
other patch, no special-casing: it reports as a ~12.65 ha vulnerable patch
(RESIDENTIAL, GPR `SDP`). Outputs feed a separate Next.js app for visual storytelling.

## Hard boundaries
- **`app/` is the built dashboard, now folded into this repo** (Aug 2026). The earlier
  "don't modify `app/`" boundary was lifted by the user to build it: a Next.js 16 +
  Tailwind v4 + shadcn/ui map app. `app/AGENTS.md` still governs *how* to work inside it —
  it's a newer Next than your training data, so read `node_modules/next/dist/docs/` first.
  The app **consumes `results/`**: the pipeline writes `results/`, and the app build copies
  those files into a **gitignored** `app/public/data/` automatically (via
  `app/scripts/sync-results.mjs`, run from the `dev`/`build` scripts). The single source of
  truth stays in `results/` — never duplicated in git.
- **Treat `data/` as read-only.** Decompressed/intermediate files go to
  `analysis/.cache/` (gitignored), never into `data/` or `results/`.

## Locked methodology decisions (and why)
- **Forest source = OSM `natural='forest'` ∪ contributed (non-OSM) forest polygons**
  (`CONTRIBUTED_FOREST_SOURCES` in `run_analysis.py`: `data/gillman_forest.geojson`,
  `data/bukit_brown.geojson`) — normalized into the same forest frame (synthetic
  `osm_id`, `desc`→`name`) and run through the identical MP2025 overlay, no
  special-casing. Same-named parts across files dissolve by `osm_id`, so a file may
  safely repeat a patch another carries (`bukit_brown.geojson` re-includes Gillman
  byte-identically → unions, no double count). `landuse='forest'` is verified
  **empty** in this extract; `natural` is the real OSM source. (~1,142 raw OSM
  polygons; 831 after clipping to Singapore, plus Gillman + Bukit Brown → 833
  total.) Gillman's forest is **0.00 ha** overlap with OSM `natural=forest` —
  genuinely absent, not a tagging bug — hence the contributed source. **Why OSM,
  not official data:** no authoritative vector dataset of secondary forest exists;
  official layers map only gazetted spaces and URA zoning encodes *intent*, not
  ground cover. Full rationale in `analysis/README.md §7` and the app's About dialog.
- **Scope = planned footprint under MP2025**, i.e. standing forest on development-zoned
  land. **Not** a delta vs MP2019 — the user explicitly does not want an "increase"
  claim, just what is planned.
- **CRS**: compute areas in **EPSG:3414** (SVY21, metres); export geometry in
  **EPSG:4326** (lon/lat) for web maps. (The original briefing's EPSG:3414 export was
  wrong for web rendering — corrected.)
- **Split each forest into one tract per zone type.** Fragments group by `(forest
  polygon × LU_DESC)`, not dissolved to one patch per forest — a forest crossed by
  several MP2025 zones yields several tracts (e.g. Bukit Brown → RESIDENTIAL +
  RESERVE SITE + ROAD), each with its own zoning, geometry, and id. Zone tracts
  below `FOLD_FLOOR_HA` (0.05 ha) fold into their forest's largest tract
  (`fold_slivers`) so hairline strips/artifacts don't become their own features —
  area moves into the keeper, totals conserved (relabel only, no geometry work). A
  sliver-only forest keeps its lone tract. Ids: the largest tract keeps the bare
  `osm_id` (stable share links); siblings get a banded synthetic id (`tract_osm_id`).
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
- **Source downloads** (the two raw inputs in `data/`, treated read-only):
  - MP2025 land use → data.gov.sg dataset `d_a8c3546b26712e35021f3a681d0353ae`:
    https://data.gov.sg/datasets/d_a8c3546b26712e35021f3a681d0353ae/view
  - OSM Singapore → BBBike extract (`osmium2shape`, 8-layer schema — same fixed layer set
    as Geofabrik-style, *not* Geofabrik):
    https://download2.bbbike.org/osm/extract/planet_103.531,1.213_104.195,1.644.osm.shp.zip
- MP2025 (`data/MasterPlan2025LandUseLayer.geojson.gz`): 113,394 polygons, WGS84,
  `G_MP25_LANDUSE_PL`. Attrs used: `OBJECTID`, `LU_DESC`, `GPR`.
- `LU_DESC` split into `DEVELOPMENT_ZONES` vs `PROTECTED_ZONES` at the top of
  `run_analysis.py` — an explicit, configurable judgment. There is **no** "NATURE
  RESERVE" / "NATURAL OPEN SPACE" class in the data (contrary to the original briefing).
- OSM (`data/osm-singapore.zip`): `natural.shp` `type` ∈ {forest, park, water};
  `landuse.shp` has **0** forest; `places.shp` gives locality labels (mixes in Johor —
  filter to inside the Singapore mask).

## Validation gate (must stay green)
`results/validation.json` → `overall_pass` must be `true`. Rests on a **single
site**: Maju Forest recovers by OSM name (~21.7 ha on dev-zoned land). If false,
the tagging assumption is wrong — fix before trusting discovery output. **No AOI /
bounding-box site matching** — an earlier "Gillman Barracks by bbox" check was
removed as unprincipled (a lon/lat box aligns to nothing on the ground and
mislabels neighbouring slivers) and stays removed. Ingesting Gillman's actual
forest polygon as a **contributed data source** is a separate, later change: it
runs through the same overlay (~12.65 ha vulnerable, RESIDENTIAL) with no special
assertion and **no change to this gate** — Gillman is input data, not a validation site.

## Run
```bash
cd analysis && poetry install && poetry run python run_analysis.py
```
Env: pyenv Python 3.12.11 (pinned), Poetry 2.x, deps locked in `poetry.lock`. See
`analysis/README.md` for details.

The app (after regenerating `results/`):
```bash
cd app && pnpm install && pnpm dev     # build/dev auto-syncs results/ -> public/data/
```
**Deploy:** Vercel project on `liangyuanruo/deforest` with **Root Directory = `app`**,
Build Command `pnpm build`, *Include files outside the Root Directory* on (so `../results`
is present at build). Mapbox creds ship as env-overridable in-code defaults in
`app/lib/mapbox.ts` (`NEXT_PUBLIC_MAPBOX_TOKEN` / `NEXT_PUBLIC_MAPBOX_STYLE`).

## Key files
- `analysis/run_analysis.py` — the whole pipeline (load → mask → forest → overlay →
  aggregate → validate → write). Single entry point.
- `analysis/site_context.py` — curated per-name site context, keyed on OSM forest name
  (edit freely). No AOI/bbox matching — removed (see validation gate).
- `results/*.geojson` + `summary.json` + `validation.json` — outputs; `summary.json`
  has a `layers` manifest describing each file.
- `app/` — Next.js dashboard. `components/Explorer.tsx` (state + composition),
  `MapView.tsx` (mapbox-gl), `Sidebar.tsx`, `StatsBar.tsx`, `AboutModal.tsx`;
  `lib/schema.ts` (Zod), `lib/scoring.ts` (search/sort/filter), `lib/data.ts`.
