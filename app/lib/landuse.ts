/**
 * Land-use colour + aggregation helpers, kept free of React so the map, the
 * compact stats panel, and the site-detail card share one source of truth.
 *
 * Colours are the **official URA Master Plan 2025 zoning fills** (extracted from
 * the URA SPACE legend), keyed on the land-use CLASS — never its rank — so a
 * filter that changes the underlying set never repaints the survivors (dataviz
 * non-negotiable). URA colours aren't CVD-optimized, so identity always rides on
 * the text labels next to each swatch, never colour alone.
 */
import type { ThreatenedProperties } from "@/lib/schema";

/**
 * Every zoning fill in the URA MP2025 legend, keys uppercased to match the
 * data's `LU_DESC`. Complete (not just the classes currently present) so any
 * future class is coloured correctly. URA reuses `#cc0021` across the three
 * institution types; they're distinguished by their text label.
 */
export const LAND_USE_COLOR: Record<string, string> = {
  RESIDENTIAL: "#f6bb81",
  "RESIDENTIAL WITH COMMERCIAL AT 1ST STOREY": "#e78385",
  "COMMERCIAL & RESIDENTIAL": "#36ade5",
  COMMERCIAL: "#215297",
  HOTEL: "#a79cc6",
  WHITE: "#f5f1f2",
  "BUSINESS 1": "#c8a5cf",
  "BUSINESS 1 - WHITE": "#c8a5cf",
  "BUSINESS 2": "#b10166",
  "BUSINESS 2 - WHITE": "#b10166",
  "BUSINESS PARK": "#007fa2",
  "BUSINESS PARK - WHITE": "#007fa2",
  "RESIDENTIAL / INSTITUTION": "#ef9c36",
  "COMMERCIAL / INSTITUTION": "#9ffeff",
  "HEALTH & MEDICAL CARE": "#cc0021",
  "PLACE OF WORSHIP": "#cc0021",
  "CIVIC & COMMUNITY INSTITUTION": "#cc0021",
  "EDUCATIONAL INSTITUTION": "#f4f2c1",
  "OPEN SPACE": "#abb20d",
  PARK: "#00a33a",
  "BEACH AREA": "#f9f7c6",
  "SPORTS & RECREATION": "#a3d49d",
  WATERBODY: "#bedef3",
  ROAD: "#ffffff",
  "TRANSPORT FACILITIES": "#959a9d",
  UTILITY: "#94999c",
  CEMETERY: "#9f8900",
  AGRICULTURE: "#8c875d",
  "PORT / AIRPORT": "#d0d0d0",
  "SPECIAL USE": "#516703",
  "RESERVE SITE": "#fef66d",
};

/** Defensive fallback for any `LU_DESC` not in the legend above. */
export const OTHER_COLOR = "#c9ced1";
export const OTHER_LABEL = "Other";

export function colorForLandUse(luDesc: string): string {
  return LAND_USE_COLOR[luDesc] ?? OTHER_COLOR;
}

/**
 * A Mapbox `match` expression mapping a land-use property → URA fill, with
 * `OTHER_COLOR` as the fallback. Built from `LAND_USE_COLOR` so the map fill and
 * the JS palette can never drift. Returned as a plain array (no mapbox-gl types)
 * to keep this module React/WebGL-free.
 *
 * `prop` is the feature property to read the class from — `dominant_lu_desc` for
 * the threatened forest layer, `lu_desc` for the raw URA development zones — so
 * both layers colour from the one palette.
 */
export function landUseFillExpression(prop = "dominant_lu_desc"): unknown[] {
  const cases: string[] = [];
  for (const [luDesc, color] of Object.entries(LAND_USE_COLOR)) {
    cases.push(luDesc, color);
  }
  return ["match", ["get", prop], ...cases, OTHER_COLOR];
}

export interface LandUseSlice {
  luDesc: string;
  areaHa: number;
}

/** Sum threatened area by dominant land use, largest first. */
export function aggregateByLandUse(sites: ThreatenedProperties[]): LandUseSlice[] {
  const totals = new Map<string, number>();
  for (const site of sites) {
    totals.set(
      site.dominant_lu_desc,
      (totals.get(site.dominant_lu_desc) ?? 0) + site.area_ha,
    );
  }
  return Array.from(totals.entries())
    .map(([luDesc, areaHa]) => ({ luDesc, areaHa }))
    .sort((a, b) => b.areaHa - a.areaHa);
}

/**
 * Prepares slices for the compact legends. Keeps the top `maxKnown` classes by
 * area and folds everything else — plus any class with no URA colour — into a
 * single trailing "Other" slice, so a 19-class breakdown doesn't balloon the
 * panel. Pass `maxKnown = Infinity` (the default) to keep every coloured class.
 */
export function toColoredSlices(
  byLandUse: LandUseSlice[],
  maxKnown = Infinity,
): LandUseSlice[] {
  const known: LandUseSlice[] = [];
  let otherHa = 0;
  for (const slice of byLandUse) {
    if (slice.luDesc in LAND_USE_COLOR && known.length < maxKnown) {
      known.push(slice);
    } else {
      otherHa += slice.areaHa;
    }
  }
  known.sort((a, b) => b.areaHa - a.areaHa);
  if (otherHa > 0) {
    known.push({ luDesc: OTHER_LABEL, areaHa: otherHa });
  }
  return known;
}
