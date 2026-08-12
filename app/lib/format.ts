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

/**
 * One FIFA-standard football pitch (105 x 68 m = 7,140 m2) in hectares. Used to
 * translate abstract hectare figures into a unit a lay reader can picture. This
 * is a presentation-only heuristic — it never feeds the analysis.
 */
export const FOOTBALL_FIELD_HA = 0.71;

/**
 * Renders a hectare figure as an approximate football-field count, e.g.
 * "~ 4,100 football fields". Rounding is deliberately coarse so the count never
 * looks falsely precise and scales with magnitude: >= 1,000 -> nearest 100;
 * >= 100 -> nearest 10; >= 1 -> nearest whole; < 1 -> "under 1 football field".
 * Pluralises correctly ("1 football field" vs. "2 football fields").
 */
export function formatFootballFields(areaHa: number): string {
  const fields = areaHa / FOOTBALL_FIELD_HA;

  if (fields < 1) return "under 1 football field";

  let rounded: number;
  if (fields >= 1000) {
    rounded = Math.round(fields / 100) * 100;
  } else if (fields >= 100) {
    rounded = Math.round(fields / 10) * 10;
  } else {
    rounded = Math.round(fields);
  }

  const noun = rounded === 1 ? "football field" : "football fields";
  return `≈ ${formatNumber(rounded)} ${noun}`;
}
