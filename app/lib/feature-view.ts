/**
 * View-models for map features — the single source of truth for *what* a forest
 * / zone patch shows, shared by the two renderers that would otherwise drift:
 * the Mapbox popup (HTML string, `MapView`) and the detail card (JSX,
 * `SiteDetail`/`LostDetail`). React-free so importing it never drags WebGL or a
 * client bundle into a server-renderable module.
 *
 * The split is deliberate: this module owns the *derivation* (which colour, which
 * gloss, which plot-ratio range, what each GPR code means). The renderers keep
 * their own density — the hover popup stays terse, the card stays verbose — but
 * they can no longer disagree on the underlying facts.
 */
import {
  formatGprRange,
  GPR_CODE_DESCRIPTION,
  GPR_CODE_LABEL,
  parseGpr,
} from "@/lib/gpr";
import { colorForLandUse, descriptionForLandUse } from "@/lib/landuse";

/** Escapes the HTML-significant characters for safe interpolation into popup markup. */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

/** One URA GPR status code, resolved to its short label + full gloss (null if unknown). */
export interface ZoningCodeView {
  code: string;
  shortLabel: string | null;
  description: string | null;
}

/**
 * The URA-zoning facts for one patch: the land-use class (colour + label +
 * optional plain-language gloss), the numeric plot-ratio range, and any
 * non-numeric status codes. `landUse` is null when the feature has no MP2025
 * join (raw forest, or a cleared area outside every zoning polygon).
 */
export interface ZoningView {
  landUse: { label: string; color: string; gloss: string | null } | null;
  range: string | null;
  codes: ZoningCodeView[];
}

/**
 * Derives the shared {@link ZoningView} from a patch's raw `LU_DESC` + `GPR`
 * strings. The one place these lookups happen — both the popup and the card
 * consume the result, so a change here updates both at once.
 */
export function describeZoning(
  lu: string | null | undefined,
  gpr: string | null | undefined,
): ZoningView {
  const landUse = lu
    ? { label: lu, color: colorForLandUse(lu), gloss: descriptionForLandUse(lu) ?? null }
    : null;
  const parsed = parseGpr(gpr ?? null);
  const codes = parsed.codes.map((code) => ({
    code,
    shortLabel: GPR_CODE_LABEL[code] ?? null,
    description: GPR_CODE_DESCRIPTION[code] ?? null,
  }));
  return { landUse, range: formatGprRange(parsed.ratios), codes };
}

/**
 * Renders a {@link ZoningView} to the popup's `deforest-popup__*` markup: a
 * colour swatch + land-use label, a plain-language gloss, and the plot-ratio
 * range with an inline code legend (terse — short labels only; the card shows
 * the full descriptions). All interpolated text is escaped; the colour is a
 * controlled hex from the URA palette.
 */
export function zoningViewToHtml(z: ZoningView): string {
  const luRow = z.landUse
    ? `<div class="deforest-popup__lu"><span class="deforest-popup__swatch" style="background:${z.landUse.color}"></span>${escapeHtml(z.landUse.label)}</div>`
    : "";
  const descRow = z.landUse?.gloss
    ? `<div class="deforest-popup__desc">${escapeHtml(z.landUse.gloss)}</div>`
    : "";
  const gprCodes = z.codes
    .map((c) => `${c.code}${c.shortLabel ? ` — ${c.shortLabel}` : ""}`)
    .join(" · ");
  const gprRow =
    z.range || gprCodes
      ? `<div class="deforest-popup__gpr">Plot ratio${
          z.range ? ` ${escapeHtml(z.range)}` : ""
        }${
          gprCodes
            ? `<span class="deforest-popup__gprCodes">${escapeHtml(gprCodes)}</span>`
            : ""
        }</div>`
      : "";
  return luRow + descRow + gprRow;
}
