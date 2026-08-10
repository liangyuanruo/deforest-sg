# deforest

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

## Repository layout

```text
data/        Raw inputs (URA MP2025 land-use gz; OSM Singapore shapefiles). Read-only.
analysis/    Reproducible Python (Poetry) pipeline. START HERE to regenerate results.
results/     Pipeline outputs: web-map-ready GeoJSON + summary/validation JSON.
app/         Separate Next.js storytelling site that renders results/. (Its own repo/docs.)
```

## Regenerate the results

```bash
cd analysis
poetry install
poetry run python run_analysis.py
```

See [`analysis/README.md`](analysis/README.md) for full setup, methodology, and caveats.

## How the app consumes this

`results/` contains three GeoJSON layers — each stamped with a `source` property
(`OSM`, `URA_MP2025`, or the intersection) — plus `summary.json` (which includes a
`layers` manifest) and `validation.json`. The app can render all three layers to show
the OSM forest, the URA development zones, and where they overlap. **The analysis does
not modify `app/`.**

Each output file and every property is documented in
[`results/README.md`](results/README.md).

| Layer | Source | Role |
| --- | --- | --- |
| `threatened_forests.geojson` | OSM ∩ URA | Planned deforestation footprint (headline) |
| `forest_all.geojson` | OSM | All mapped forest (context) |
| `development_zones.geojson` | URA MP2025 | Development polygons overlapping forest (context) |

## Caveats

OSM canopy is crowd-sourced, not an official survey; zoning for development does not
guarantee clearance; and this is the **planned footprint under MP2025**, not a measured
increase versus the previous (2019) plan. Full list in `results/summary.json`.
