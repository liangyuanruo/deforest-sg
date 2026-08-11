import { describe, expect, it } from "vitest";

import { describeGprCode, formatGprRange, parseGpr } from "./gpr";

describe("parseGpr", () => {
  it("splits a mixed string into ratios and codes", () => {
    expect(parseGpr("1.4, 1.7, EVA, LND")).toEqual({
      ratios: [1.4, 1.7],
      codes: ["EVA", "LND"],
    });
  });

  it("returns empty arrays for null / blank", () => {
    expect(parseGpr(null)).toEqual({ ratios: [], codes: [] });
    expect(parseGpr("")).toEqual({ ratios: [], codes: [] });
    expect(parseGpr("  ")).toEqual({ ratios: [], codes: [] });
  });

  it("handles a codes-only string", () => {
    expect(parseGpr("EVA, SDP")).toEqual({ ratios: [], codes: ["EVA", "SDP"] });
  });

  it("handles a single numeric value", () => {
    expect(parseGpr("2.8")).toEqual({ ratios: [2.8], codes: [] });
  });

  it("dedupes ratios and sorts them ascending", () => {
    expect(parseGpr("2.8, 1.4, 1.4, 2.8").ratios).toEqual([1.4, 2.8]);
  });

  it("orders known codes by a fixed order regardless of input order", () => {
    expect(parseGpr("LND, EVA, SDP").codes).toEqual(["EVA", "SDP", "LND"]);
  });

  it("keeps an unknown code after the known ones", () => {
    expect(parseGpr("XYZ, EVA").codes).toEqual(["EVA", "XYZ"]);
  });
});

describe("formatGprRange", () => {
  it("returns null when there are no ratios", () => {
    expect(formatGprRange([])).toBeNull();
  });

  it("returns the lone value unchanged", () => {
    expect(formatGprRange([2.8])).toBe("2.8");
  });

  it("returns a min–max range for multiple ratios", () => {
    expect(formatGprRange([1.4, 1.7])).toBe("1.4–1.7");
  });

  it("passes odd numeric forms through without rounding", () => {
    expect(formatGprRange([2.07])).toBe("2.07");
    expect(formatGprRange([25])).toBe("25");
    expect(formatGprRange([1, 10])).toBe("1–10");
  });
});

describe("describeGprCode", () => {
  it("returns a label + description for a known code", () => {
    const d = describeGprCode("EVA");
    expect(d?.label).toBe("Subject to evaluation");
    expect(d?.description).toMatch(/case-by-case/);
  });

  it("returns undefined for an unknown code", () => {
    expect(describeGprCode("XYZ")).toBeUndefined();
  });
});
