import { describe, expect, it } from "vitest";
import { formatHa, formatNumber, formatPercent } from "@/lib/format";

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
