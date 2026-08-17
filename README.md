# deforest.sg

**Which of Singapore's forests does the URA Master Plan 2025 quietly earmark for
development?**

In August 2026, the government named **Maju Forest** and **Gillman Barracks** as sites
that will be developed for housing over the next decade
([Straits Times](https://www.straitstimes.com/singapore/politics/gillman-barracks-maju-forest-need-to-be-developed-to-meet-housing-needs-over-next-decade-alvin-tan)).
This project asks: **what else?** It overlays crowd-sourced forest cover
(OpenStreetMap) against the URA Master Plan 2025 land-use layer to surface every
secondary-forest patch that sits on development-designated land — with names, sizes,
intended land use, and context — so the picture can be told visually.

The method is sanity-checked by confirming it independently **recovers the two already-
announced sites** before we trust anything new it finds.

## What it finds

Of ~**5,007 ha** of forest mapped in Singapore (OSM `natural=forest`), roughly
**2,941 ha (~59%)** lies on land the Master Plan 2025 zones for development — led by
`RESERVE SITE` (~1,514 ha), `RESIDENTIAL` (~514 ha) and `SPECIAL USE` (~440 ha). See
`results/summary.json` for the ranked breakdown and caveats (reserve land is a
future, not imminent, signal).

## Why OpenStreetMap?

There is no authoritative *vector* dataset of Singapore's secondary forests. Official
NParks / data.gov.sg layers map only gazetted spaces (Central Catchment, Bukit Timah,
Sungei Buloh, managed parks); the URA Master Plan encodes zoning *intent*, not what
physically grows on the land — a `RESERVE SITE` polygon may be 50-year-old secondary
forest or bare grass. OSM contributors trace high-resolution satellite imagery
(Sentinel, Maxar) into `natural=forest` polygons — a pre-vectorized map of physical
canopy that aligns directly with the URA vector layer. The only authoritative
alternative is satellite land-cover **rasters** (ESA WorldCover, Google Dynamic World,
Hansen Global Forest Change), which would need raster→vector conversion and heavy
cleanup (10 m pixels misclassify shadows, rooftops and roadside planting). OSM is the
most frictionless source for this vector overlay — used here with its crowd-sourced
caveats stated plainly.

## Repository layout

```text
data/        Raw inputs (URA MP2025 land-use gz; OSM Singapore shapefiles). Read-only.
analysis/    Reproducible Python (Poetry) pipeline. START HERE to regenerate results.
results/     Pipeline outputs: web-map-ready GeoJSON + summary/validation JSON.
app/         Separate Next.js storytelling site that renders results/. (Its own repo/docs.)
```

## Data sources

The two read-only inputs in `data/` come from:

| Input | Source |
| --- | --- |
| `MasterPlan2025LandUseLayer.geojson.gz` | URA Master Plan 2025 Land Use Layer — [data.gov.sg dataset `d_a8c3546b26712e35021f3a681d0353ae`](https://data.gov.sg/datasets/d_a8c3546b26712e35021f3a681d0353ae/view) |
| `osm-singapore.zip` | OpenStreetMap Singapore — [BBBike shapefile extract](https://download2.bbbike.org/osm/extract/planet_103.531,1.213_104.195,1.644.osm.shp.zip) |

These URLs are also recorded in `results/summary.json` (`provenance`) so outputs are
self-documenting.

## Regenerate the results

```bash
cd analysis
poetry install
poetry run python run_analysis.py
```

See [`analysis/README.md`](analysis/README.md) for full setup, methodology, and caveats.

## The app

`app/` is an interactive **Next.js 16** dashboard (Mapbox GL + shadcn/ui) that lets
citizens search and filter the affected sites, sort by string match blended with
threatened area, see the hectares under threat, and read the motivation. It renders
`results/` directly — the three GeoJSON layers (each stamped with a `source` property:
`OSM`, `URA_MP2025`, or the intersection) plus `summary.json`. The pipeline writes
`results/`; the app build copies it into a gitignored `app/public/data/` automatically,
so `results/` stays the single source of truth (no committed duplication).

```bash
cd app && pnpm install && pnpm dev      # http://localhost:3000
```

Deployed to Vercel with **Root Directory = `app`**. Each output file and every property
is documented in [`results/README.md`](results/README.md).

| Layer | Source | Role |
| --- | --- | --- |
| `threatened_forests.geojson` | OSM ∩ URA | Planned deforestation footprint (headline) |
| `forest_all.geojson` | OSM | All mapped forest (context) |
| `development_zones.geojson` | URA MP2025 | Development polygons overlapping forest (context) |

## Caveats

OSM canopy is crowd-sourced, not an official survey; zoning for development does not
guarantee clearance; and this is the **planned footprint under MP2025**, not a measured
increase versus the previous (2019) plan. Full list in `results/summary.json`.
