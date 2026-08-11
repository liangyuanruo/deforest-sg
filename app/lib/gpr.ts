/**
 * Gross-plot-ratio parsing + plain-language glosses, kept free of React so the
 * site-detail card and the map popup share one source of truth (mirrors the
 * jargon-gloss pattern in `lib/landuse.ts`).
 *
 * The pipeline stores `gpr` as a sorted, deduped comma list of every distinct
 * GPR across the fragments a forest patch overlaps (see
 * `analysis/run_analysis.py`), so a single patch can read `"1.4, 1.7, EVA, LND"`
 * — mixing numeric density caps with non-numeric URA status codes. We split the
 * two so the numbers can be shown as a range and each code explained.
 */

export interface ParsedGpr {
  /** Numeric gross plot ratios, ascending, deduped (e.g. [1.4, 1.7]). */
  ratios: number[];
  /** Non-numeric URA status codes, known ones first (e.g. ["EVA", "LND"]). */
  codes: string[];
}

/** Short label for each URA GPR status code. */
export const GPR_CODE_LABEL: Record<string, string> = {
  EVA: "Subject to evaluation",
  SDP: "Subject to detailed planning",
  LND: "Landed housing",
};

/** Full plain-language gloss for each URA GPR status code. */
export const GPR_CODE_DESCRIPTION: Record<string, string> = {
  EVA: "The plot ratio isn't fixed — URA decides the allowed density case-by-case when a development application is made.",
  SDP: "Use and intensity aren't finalised yet — they'll be set in a later detailed planning study.",
  LND: "Governed by landed-housing storey and envelope controls rather than a numeric plot ratio.",
};

/**
 * Fixed display order for known codes, so `"LND, EVA"` and `"EVA, LND"` render
 * the same. Unknown codes keep their original order after these.
 */
const CODE_ORDER = ["EVA", "SDP", "LND"];

/** One-line explainer of what a numeric plot ratio means, for the info tooltip. */
export const GPR_EXPLAINER =
  "Gross plot ratio — the maximum total floor area allowed, as a multiple of the land area. Higher means denser, taller development.";

/**
 * Split the stored `gpr` string into numeric ratios vs. status codes. A token
 * that parses to a finite number is a ratio; anything else is a code. Ratios are
 * deduped and sorted ascending; known codes are ordered by `CODE_ORDER`, unknown
 * codes kept in first-seen order after them. Returns empty arrays for null/blank.
 */
export function parseGpr(raw: string | null | undefined): ParsedGpr {
  if (!raw) return { ratios: [], codes: [] };

  const ratioSet = new Map<number, true>();
  const codes: string[] = [];
  for (const token of raw.split(",")) {
    const t = token.trim();
    if (!t) continue;
    const n = Number(t);
    if (Number.isFinite(n)) {
      ratioSet.set(n, true);
    } else if (!codes.includes(t)) {
      codes.push(t);
    }
  }

  const ratios = Array.from(ratioSet.keys()).sort((a, b) => a - b);
  codes.sort((a, b) => {
    const ia = CODE_ORDER.indexOf(a);
    const ib = CODE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return { ratios, codes };
}

/**
 * Format numeric ratios for display: `null` when there are none, the lone value
 * when there's one, else `"min–max"` (en-dash). Uses each number's own string
 * form so `2.07`, `10.0` etc. survive unrounded.
 */
export function formatGprRange(ratios: number[]): string | null {
  if (ratios.length === 0) return null;
  const min = ratios[0];
  const max = ratios[ratios.length - 1];
  if (min === max) return String(min);
  return `${min}–${max}`;
}

/** Short label + full gloss for a code, or `undefined` if the code is unknown. */
export function describeGprCode(
  code: string,
): { label: string; description: string } | undefined {
  const label = GPR_CODE_LABEL[code];
  const description = GPR_CODE_DESCRIPTION[code];
  if (!label || !description) return undefined;
  return { label, description };
}
