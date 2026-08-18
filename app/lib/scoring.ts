/**
 * Pure search/filter/sort logic for "threatened forest" sites.
 *
 * Kept free of React/Next dependencies so it can be unit tested in isolation
 * and reused by any UI surface (search bar, filter chips, sort control).
 */
import type { ThreatenedProperties } from "@/lib/schema";

export type SortMode = "relevance" | "area" | "fraction";

export interface FilterSortOptions {
  /** Free-text search query; may be empty or whitespace-only. */
  query: string;
  sortMode: SortMode;
  /** Selected `dominant_lu_desc` values to filter by; empty = no filter. */
  landUses: string[];
}

const TEXT_MATCH_FIELDS = ["name", "label", "locality"] as const;

/**
 * Scores how well a site matches a free-text query by checking `name`,
 * `label`, and `locality` (case-insensitive, trimmed) and returning the
 * best tier found across those fields:
 *   3 = exact match, 2 = starts with, 1 = contains, 0 = no match.
 * An empty/whitespace query always scores 0 (no signal).
 */
export function textScore(
  site: ThreatenedProperties,
  query: string,
): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") return 0;

  let best = 0;
  for (const field of TEXT_MATCH_FIELDS) {
    const value = site[field];
    if (value == null) continue;
    const normalizedValue = value.trim().toLowerCase();

    let score: number;
    if (normalizedValue === normalizedQuery) {
      score = 3;
    } else if (normalizedValue.startsWith(normalizedQuery)) {
      score = 2;
    } else if (normalizedValue.includes(normalizedQuery)) {
      score = 1;
    } else {
      score = 0;
    }

    if (score > best) best = score;
    if (best === 3) break;
  }
  return best;
}

/**
 * Returns true if `site.dominant_lu_desc` passes the land-use filter.
 * An empty `landUses` array means "no filter" and always passes.
 */
export function matchesLandUse(
  site: ThreatenedProperties,
  landUses: string[],
): boolean {
  if (landUses.length === 0) return true;
  return landUses.includes(site.dominant_lu_desc);
}

/**
 * Filters `sites` by land use and (if provided) text query, then sorts the
 * result according to `sortMode`. Returns a new array; never mutates the
 * input array or its elements.
 *
 * Sort orders (all stable, all with a total tie-break so output is
 * deterministic):
 *  - "relevance": textScore DESC, then area_ha DESC, then id ASC.
 *    With an empty query, textScore is 0 for every site, so this collapses
 *    to area_ha DESC — impact-first, the desired default ordering.
 *  - "area": area_ha DESC, then id ASC.
 *  - "fraction": threatened_fraction DESC, then id ASC.
 */
export function filterAndSortSites(
  sites: ThreatenedProperties[],
  opts: FilterSortOptions,
): ThreatenedProperties[] {
  const normalizedQuery = opts.query.trim().toLowerCase();
  const hasQuery = normalizedQuery !== "";

  const filtered = sites.filter((site) => {
    if (!matchesLandUse(site, opts.landUses)) return false;
    if (hasQuery && textScore(site, opts.query) === 0) return false;
    return true;
  });

  const withScores = filtered.map((site) => ({
    site,
    score: hasQuery ? textScore(site, opts.query) : 0,
  }));

  withScores.sort((a, b) => {
    switch (opts.sortMode) {
      case "relevance": {
        if (b.score !== a.score) return b.score - a.score;
        if (b.site.area_ha !== a.site.area_ha) {
          return b.site.area_ha - a.site.area_ha;
        }
        return a.site.id - b.site.id;
      }
      case "area": {
        if (b.site.area_ha !== a.site.area_ha) {
          return b.site.area_ha - a.site.area_ha;
        }
        return a.site.id - b.site.id;
      }
      case "fraction": {
        if (b.site.threatened_fraction !== a.site.threatened_fraction) {
          return b.site.threatened_fraction - a.site.threatened_fraction;
        }
        return a.site.id - b.site.id;
      }
    }
  });

  return withScores.map((entry) => entry.site);
}

export interface LandUseOption {
  luDesc: string;
  count: number;
}

/**
 * Returns the distinct `dominant_lu_desc` values present in `sites`, each with
 * a count of how many sites carry it. Sorted alphabetically so a chip stays put
 * as the filtered set changes — a count-ranked order reshuffles under the
 * pointer.
 */
export function landUseOptions(
  sites: ThreatenedProperties[],
): LandUseOption[] {
  const counts = new Map<string, number>();
  for (const site of sites) {
    counts.set(
      site.dominant_lu_desc,
      (counts.get(site.dominant_lu_desc) ?? 0) + 1,
    );
  }

  return Array.from(counts, ([luDesc, count]) => ({ luDesc, count })).sort(
    (a, b) => a.luDesc.localeCompare(b.luDesc),
  );
}
