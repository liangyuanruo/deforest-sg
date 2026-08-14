import { describe, expect, it } from "vitest";

import { describeZoning, escapeHtml, zoningViewToHtml } from "@/lib/feature-view";

/**
 * `describeZoning` is the single source of truth for the URA-zoning facts shown
 * in both the map popup (`zoningViewToHtml`) and the detail card (`ZoningRows`
 * JSX). These characterization tests pin the derivation + the popup HTML so the
 * two renderers can never again drift on *what* they show. The golden HTML
 * strings reproduce the pre-seam `zoningRowsHtml` output byte-for-byte.
 */
describe("describeZoning", () => {
  it("derives colour, gloss and a numeric plot-ratio range for a known class", () => {
    expect(describeZoning("RESIDENTIAL", "1.4, 2.8")).toEqual({
      landUse: {
        label: "RESIDENTIAL",
        color: "#f6bb81",
        gloss:
          "Housing — public HDB flats, private condominiums, landed homes and apartments, with supporting local amenities.",
      },
      range: "1.4–2.8",
      codes: [],
    });
  });

  it("falls back to the neutral colour and no gloss for an unknown class, keeping unknown GPR codes", () => {
    expect(describeZoning("MYSTERY ZONE", "3.5, ZZZ")).toEqual({
      landUse: { label: "MYSTERY ZONE", color: "#c9ced1", gloss: null },
      range: "3.5",
      codes: [{ code: "ZZZ", shortLabel: null, description: null }],
    });
  });

  it("orders and glosses known GPR status codes, with no land use", () => {
    const z = describeZoning(null, "LND, EVA");
    expect(z.landUse).toBeNull();
    expect(z.range).toBeNull();
    expect(z.codes).toEqual([
      {
        code: "EVA",
        shortLabel: "Subject to evaluation",
        description:
          "The plot ratio isn't fixed — URA decides the allowed density case-by-case when a development application is made.",
      },
      {
        code: "LND",
        shortLabel: "Landed housing",
        description:
          "Governed by landed-housing storey and envelope controls rather than a numeric plot ratio.",
      },
    ]);
  });

  it("returns an empty view when there is neither land use nor GPR", () => {
    expect(describeZoning(null, null)).toEqual({
      landUse: null,
      range: null,
      codes: [],
    });
  });
});

describe("zoningViewToHtml", () => {
  it("renders swatch + label, gloss and a numeric range", () => {
    expect(zoningViewToHtml(describeZoning("RESIDENTIAL", "1.4, 2.8"))).toBe(
      '<div class="deforest-popup__lu"><span class="deforest-popup__swatch" style="background:#f6bb81"></span>RESIDENTIAL</div>' +
        '<div class="deforest-popup__desc">Housing — public HDB flats, private condominiums, landed homes and apartments, with supporting local amenities.</div>' +
        '<div class="deforest-popup__gpr">Plot ratio 1.4–2.8</div>',
    );
  });

  it("escapes the land-use label (URA classes contain ampersands)", () => {
    expect(zoningViewToHtml(describeZoning("COMMERCIAL & RESIDENTIAL", null))).toBe(
      '<div class="deforest-popup__lu"><span class="deforest-popup__swatch" style="background:#36ade5"></span>COMMERCIAL &amp; RESIDENTIAL</div>' +
        '<div class="deforest-popup__desc">Mixed-use development combining commercial and residential uses across multiple levels.</div>',
    );
  });

  it("renders status codes inline with short labels, no numeric range", () => {
    expect(zoningViewToHtml(describeZoning(null, "EVA, LND"))).toBe(
      '<div class="deforest-popup__gpr">Plot ratio<span class="deforest-popup__gprCodes">EVA — Subject to evaluation · LND — Landed housing</span></div>',
    );
  });

  it("renders an unknown code bare (no short label) alongside a lone ratio", () => {
    expect(zoningViewToHtml(describeZoning("MYSTERY ZONE", "3.5, ZZZ"))).toBe(
      '<div class="deforest-popup__lu"><span class="deforest-popup__swatch" style="background:#c9ced1"></span>MYSTERY ZONE</div>' +
        '<div class="deforest-popup__gpr">Plot ratio 3.5<span class="deforest-popup__gprCodes">ZZZ</span></div>',
    );
  });

  it("renders nothing when the view is empty", () => {
    expect(zoningViewToHtml(describeZoning(null, null))).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes the HTML-significant characters", () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot;",
    );
  });
});
