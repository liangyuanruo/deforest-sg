import { describe, expect, it } from "vitest";
import {
  formatFootballFields,
  formatHa,
  formatNumber,
  formatPercent,
} from "@/lib/format";

describe("formatHa", () => {
  it("shows one decimal place for values under 1,000 ha", () => {
    expect(formatHa(281.5937)).toBe("281.6 ha");
    expect(formatHa(0.14212688805007853)).toBe("0.1 ha");
    expect(formatHa(3.2024)).toBe("3.2 ha");
    expect(formatHa(999.94)).toBe("999.9 ha");
  });

  it("shows zero decimal places with thousands separators for 1,000+ ha", () => {
    expect(formatHa(2940.9)).toBe("2,941 ha");
    expect(formatHa(5006.7)).toBe("5,007 ha");
    expect(formatHa(1000)).toBe("1,000 ha");
  });

  it("rounds correctly at the boundary", () => {
    expect(formatHa(999.96)).toBe("1,000.0 ha");
  });

  it("handles zero", () => {
    expect(formatHa(0)).toBe("0.0 ha");
  });
});

describe("formatPercent", () => {
  it("formats a fraction as a rounded whole-number percent", () => {
    expect(formatPercent(0.587)).toBe("59%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0.5)).toBe("50%");
  });

  it("rounds half-up-ish for typical fractions", () => {
    expect(formatPercent(0.9746)).toBe("97%");
    expect(formatPercent(0.005)).toBe("1%");
  });
});

describe("formatNumber", () => {
  it("adds thousands separators to integers", () => {
    expect(formatNumber(831)).toBe("831");
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(1000000)).toBe("1,000,000");
  });

  it("keeps up to three decimal places", () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(formatNumber(1234.5678)).toBe("1,234.568");
  });

  it("handles zero and negative numbers", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(-42)).toBe("-42");
  });
});

describe("formatFootballFields", () => {
  it("grounds the real headline and site figures", () => {
    // 2,940.9 / 0.71 = 4,142 -> nearest 100
    expect(formatFootballFields(2940.9)).toBe("≈ 4,100 football fields");
    // Maju: 21.7 / 0.71 = 30.6 -> nearest whole
    expect(formatFootballFields(21.7)).toBe("≈ 31 football fields");
    // Dover: 33 / 0.71 = 46.48 -> nearest whole
    expect(formatFootballFields(33)).toBe("≈ 46 football fields");
  });

  it("rounds to the nearest 100 at or above 1,000 fields", () => {
    expect(formatFootballFields(1000 * 0.71)).toBe("≈ 1,000 football fields");
    expect(formatFootballFields(1049 * 0.71)).toBe("≈ 1,000 football fields");
    expect(formatFootballFields(1051 * 0.71)).toBe("≈ 1,100 football fields");
  });

  it("rounds to the nearest 10 between 100 and 1,000 fields", () => {
    expect(formatFootballFields(100 * 0.71)).toBe("≈ 100 football fields");
    expect(formatFootballFields(994 * 0.71)).toBe("≈ 990 football fields");
    expect(formatFootballFields(996 * 0.71)).toBe("≈ 1,000 football fields");
  });

  it("rounds to the nearest whole between 1 and 100 fields", () => {
    expect(formatFootballFields(9.4 * 0.71)).toBe("≈ 9 football fields");
    expect(formatFootballFields(99.4 * 0.71)).toBe("≈ 99 football fields");
  });

  it("pluralises correctly and floors below one field", () => {
    expect(formatFootballFields(0.71)).toBe("≈ 1 football field");
    expect(formatFootballFields(0.5)).toBe("under 1 football field");
    expect(formatFootballFields(0)).toBe("under 1 football field");
  });
});
