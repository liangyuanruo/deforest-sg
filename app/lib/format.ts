/**
 * Pure, deterministic formatting helpers for displaying analysis figures.
 *
 * Rounding rule for `formatHa`: values under 1,000 ha get one decimal place
 * (small/medium patches, e.g. a single forest fragment at 281.5937 ha reads
 * as "281.6 ha"); values of 1,000 ha or more are rounded to whole hectares
 * with thousands separators (e.g. a national total of 2940.9 ha reads as
 * "2,941 ha"). This keeps small figures precise without cluttering large
 * aggregate totals with fractional hectares.
 */
export function formatHa(n: number): string {
  const decimals = Math.abs(n) < 1000 ? 1 : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
  return `${formatted} ha`;
}

/**
 * Formats a 0..1 fraction as a whole-number percentage, e.g. 0.587 -> "59%".
 */
export function formatPercent(fraction: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(fraction);
}

/**
 * Formats a plain number with locale thousands separators, e.g.
 * 1234 -> "1,234", 1234.5678 -> "1,234.568" (up to 3 decimal places).
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(n);
}
