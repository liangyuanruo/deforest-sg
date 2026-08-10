/**
 * Land-use colour + aggregation helpers, kept free of React so the compact
 * stats panel and any future surface can share one source of truth.
 *
 * Colours follow the land-use CLASS, never its rank, so a filter that changes
 * the underlying set never repaints the survivors (dataviz non-negotiable).
 */
import type { ThreatenedProperties } from "@/lib/schema";

export const LAND_USE_COLOR: Record<string, string> = {
  "RESERVE SITE": "var(--series-1)",
  RESIDENTIAL: "var(--series-2)",
  "SPECIAL USE": "var(--series-3)",
  "BUSINESS 2": "var(--series-4)",
  ROAD: "var(--series-5)",
  "EDUCATIONAL INSTITUTION": "var(--series-6)",
  UTILITY: "var(--series-7)",
};

export const OTHER_COLOR = "var(--series-other)";
export const OTHER_LABEL = "Other";

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

/** Groups any class outside LAND_USE_COLOR into a single trailing "Other" slice. */
export function toColoredSlices(byLandUse: LandUseSlice[]): LandUseSlice[] {
  const known: LandUseSlice[] = [];
  let otherHa = 0;
  for (const slice of byLandUse) {
    if (slice.luDesc in LAND_USE_COLOR) {
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

export function colorForLandUse(luDesc: string): string {
  return LAND_USE_COLOR[luDesc] ?? OTHER_COLOR;
}
