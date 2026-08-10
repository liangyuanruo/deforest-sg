import { describe, expect, it } from "vitest";
import type { ThreatenedProperties } from "@/lib/schema";
import {
  filterAndSortSites,
  landUseOptions,
  matchesLandUse,
  textScore,
} from "@/lib/scoring";

let nextId = 1;

/** Builds a `ThreatenedProperties` fixture with sane defaults, overridable per field. */
function makeSite(
  overrides: Partial<ThreatenedProperties> = {},
): ThreatenedProperties {
  const id = nextId++;
  return {
    id,
    rank: id,
    label: `Unnamed forest #${id}`,
    name: null,
    locality: null,
    area_ha: 10,
    forest_area_ha: 12,
    threatened_fraction: 0.5,
    dominant_lu_desc: "RESIDENTIAL",
    lu_desc_breakdown: { RESIDENTIAL: 10 },
    gpr: null,
    centroid_lon: 103.8,
    centroid_lat: 1.35,
    source_layer: "natural",
    context: null,
    wildlife: null,
    status: null,
    source: "OSM_forest ∩ URA_MP2025",
    ...overrides,
  };
}

describe("textScore", () => {
  it("scores an exact match as 3", () => {
    const site = makeSite({ name: "Maju Forest" });
    expect(textScore(site, "Maju Forest")).toBe(3);
  });

  it("scores a startsWith match as 2", () => {
    const site = makeSite({ name: "Maju Forest" });
    expect(textScore(site, "Maju")).toBe(2);
  });

  it("scores a substring match as 1", () => {
    const site = makeSite({ name: "Greater Maju Forest Area" });
    expect(textScore(site, "Maju")).toBe(1);
  });

  it("scores 0 when there is no match", () => {
    const site = makeSite({ name: "Gillman Barracks" });
    expect(textScore(site, "Maju")).toBe(0);
  });

  it("is case-insensitive", () => {
    const site = makeSite({ name: "Maju Forest" });
    expect(textScore(site, "MAJU forest")).toBe(3);
    expect(textScore(site, "maju")).toBe(2);
  });

  it("skips a null name and still matches other fields", () => {
    const site = makeSite({ name: null, label: "Unnamed forest near Yishun" });
    expect(textScore(site, "Yishun")).toBe(1);
  });

  it("matches via locality", () => {
    const site = makeSite({
      name: null,
      label: "Unnamed forest",
      locality: "Simpang",
    });
    expect(textScore(site, "Simpang")).toBe(3);
  });

  it("returns the best score across fields, not the first field checked", () => {
    // name only contains the query (tier 1), but locality is an exact match (tier 3).
    const site = makeSite({
      name: "Some Maju-adjacent Forest",
      label: "Unnamed forest",
      locality: "Maju",
    });
    expect(textScore(site, "Maju")).toBe(3);
  });

  it("returns 0 for an empty query", () => {
    const site = makeSite({ name: "Maju Forest" });
    expect(textScore(site, "")).toBe(0);
  });

  it("returns 0 for a whitespace-only query", () => {
    const site = makeSite({ name: "Maju Forest" });
    expect(textScore(site, "   ")).toBe(0);
  });
});

describe("matchesLandUse", () => {
  it("passes every site when the filter list is empty", () => {
    const site = makeSite({ dominant_lu_desc: "RESERVE SITE" });
    expect(matchesLandUse(site, [])).toBe(true);
  });

  it("includes a site whose dominant_lu_desc is in the filter list", () => {
    const site = makeSite({ dominant_lu_desc: "RESERVE SITE" });
    expect(matchesLandUse(site, ["RESERVE SITE", "RESIDENTIAL"])).toBe(true);
  });

  it("excludes a site whose dominant_lu_desc is not in the filter list", () => {
    const site = makeSite({ dominant_lu_desc: "RESERVE SITE" });
    expect(matchesLandUse(site, ["RESIDENTIAL"])).toBe(false);
  });
});

describe("filterAndSortSites", () => {
  it("with a query, orders higher text-match tier first", () => {
    const exact = makeSite({ name: "Maju", area_ha: 1 });
    const startsWith = makeSite({ name: "Maju Woods", area_ha: 1 });
    const substring = makeSite({ name: "Greater Maju Area", area_ha: 1 });

    const result = filterAndSortSites([substring, exact, startsWith], {
      query: "Maju",
      sortMode: "relevance",
      landUses: [],
    });

    expect(result.map((s) => s.name)).toEqual([
      "Maju",
      "Maju Woods",
      "Greater Maju Area",
    ]);
  });

  it("with a query, ties in text tier are broken by larger area_ha", () => {
    const small = makeSite({ name: "Maju Forest", area_ha: 5 });
    const large = makeSite({ name: "Maju Forest", area_ha: 50 });

    const result = filterAndSortSites([small, large], {
      query: "maju forest",
      sortMode: "relevance",
      landUses: [],
    });

    expect(result.map((s) => s.area_ha)).toEqual([50, 5]);
  });

  it("with an empty query and relevance sort, orders by area_ha DESC (impact-first)", () => {
    const a = makeSite({ area_ha: 10 });
    const b = makeSite({ area_ha: 100 });
    const c = makeSite({ area_ha: 50 });

    const result = filterAndSortSites([a, b, c], {
      query: "",
      sortMode: "relevance",
      landUses: [],
    });

    expect(result.map((s) => s.area_ha)).toEqual([100, 50, 10]);
  });

  it('sorts by "area" mode: area_ha DESC', () => {
    const a = makeSite({ area_ha: 10, threatened_fraction: 0.9 });
    const b = makeSite({ area_ha: 100, threatened_fraction: 0.1 });

    const result = filterAndSortSites([a, b], {
      query: "",
      sortMode: "area",
      landUses: [],
    });

    expect(result.map((s) => s.area_ha)).toEqual([100, 10]);
  });

  it('sorts by "fraction" mode: threatened_fraction DESC', () => {
    const a = makeSite({ area_ha: 100, threatened_fraction: 0.1 });
    const b = makeSite({ area_ha: 10, threatened_fraction: 0.9 });

    const result = filterAndSortSites([a, b], {
      query: "",
      sortMode: "fraction",
      landUses: [],
    });

    expect(result.map((s) => s.threatened_fraction)).toEqual([0.9, 0.1]);
  });

  it("reduces the result set via the land-use filter", () => {
    const reserve = makeSite({ dominant_lu_desc: "RESERVE SITE" });
    const residential = makeSite({ dominant_lu_desc: "RESIDENTIAL" });

    const result = filterAndSortSites([reserve, residential], {
      query: "",
      sortMode: "area",
      landUses: ["RESERVE SITE"],
    });

    expect(result).toEqual([reserve]);
  });

  it("drops sites with zero text score when the query is non-empty", () => {
    const match = makeSite({ name: "Maju Forest" });
    const noMatch = makeSite({ name: "Gillman Barracks" });

    const result = filterAndSortSites([match, noMatch], {
      query: "Maju",
      sortMode: "relevance",
      landUses: [],
    });

    expect(result).toEqual([match]);
  });

  it("returns a new array and does not mutate the input", () => {
    const a = makeSite({ area_ha: 10 });
    const b = makeSite({ area_ha: 100 });
    const input = [a, b];
    const inputCopy = [...input];

    const result = filterAndSortSites(input, {
      query: "",
      sortMode: "area",
      landUses: [],
    });

    expect(result).not.toBe(input);
    expect(input).toEqual(inputCopy);
    expect(input[0]).toBe(a);
    expect(input[1]).toBe(b);
  });
});

describe("landUseOptions", () => {
  it("counts distinct dominant_lu_desc values", () => {
    const sites = [
      makeSite({ dominant_lu_desc: "RESIDENTIAL" }),
      makeSite({ dominant_lu_desc: "RESIDENTIAL" }),
      makeSite({ dominant_lu_desc: "RESERVE SITE" }),
    ];

    const result = landUseOptions(sites);

    expect(result).toEqual([
      { luDesc: "RESIDENTIAL", count: 2 },
      { luDesc: "RESERVE SITE", count: 1 },
    ]);
  });

  it("orders by count DESC then luDesc ASC", () => {
    const sites = [
      makeSite({ dominant_lu_desc: "ZEBRA ZONE" }),
      makeSite({ dominant_lu_desc: "ALPHA ZONE" }),
      makeSite({ dominant_lu_desc: "ZEBRA ZONE" }),
      makeSite({ dominant_lu_desc: "BETA ZONE" }),
      makeSite({ dominant_lu_desc: "ALPHA ZONE" }),
    ];

    const result = landUseOptions(sites);

    expect(result).toEqual([
      { luDesc: "ALPHA ZONE", count: 2 },
      { luDesc: "ZEBRA ZONE", count: 2 },
      { luDesc: "BETA ZONE", count: 1 },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(landUseOptions([])).toEqual([]);
  });
});
