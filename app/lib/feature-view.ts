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
import { formatFootballFields, formatHa } from "@/lib/format";
import {
  formatGprRange,
  GPR_CODE_DESCRIPTION,
  GPR_CODE_LABEL,
  parseGpr,
} from "@/lib/gpr";
import { colorForLandUse, descriptionForLandUse } from "@/lib/landuse";
import type {
  DeforestedProperties,
  DevelopmentZoneProperties,
  ForestProperties,
  ThreatenedProperties,
} from "@/lib/schema";

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

/**
 * A map hover popup's content: a title, an optional secondary meta line (area +
 * football-field equivalent), and the shared zoning rows (`null` for raw forest,
 * which has no MP2025 join). Feeds {@link popupViewToHtml}. The `describe*Popup`
 * builders below read schema-typed feature properties — the collections are
 * validated by `lib/data` before they reach the map, so the fields these read are
 * present (no defensive fallbacks), unlike the old inline `feature.properties` casts.
 */
export interface PopupView {
  title: string;
  meta: string | null;
  zoning: ZoningView | null;
}

/** `<area> · <football fields>`, the secondary line shared by every popup. */
function areaMeta(areaHa: number): string {
  return `${formatHa(areaHa)} · ${formatFootballFields(areaHa)}`;
}

/** Vulnerable-forest popup: the patch label, its threatened area, and its zoning. */
export function describeThreatenedPopup(
  p: Pick<ThreatenedProperties, "label" | "area_ha" | "dominant_lu_desc" | "gpr">,
): PopupView {
  return {
    title: p.label,
    meta: `${formatHa(p.area_ha)} vulnerable · ${formatFootballFields(p.area_ha)}`,
    zoning: describeZoning(p.dominant_lu_desc, p.gpr),
  };
}

/** Base forest-wash popup: the OSM patch name + area, no zoning (raw ground cover). */
export function describeForestPopup(
  p: Pick<ForestProperties, "label" | "forest_area_ha">,
): PopupView {
  return { title: p.label, meta: areaMeta(p.forest_area_ha), zoning: null };
}

/** Development-zone popup: a generic header, the parcel area, and its intended zoning. */
export function describeZonePopup(
  p: Pick<DevelopmentZoneProperties, "lu_desc" | "gpr" | "area_ha">,
): PopupView {
  return {
    title: "Development zone",
    meta: areaMeta(p.area_ha),
    zoning: describeZoning(p.lu_desc, p.gpr),
  };
}

/** Already-cleared popup: the site name, a "Deforested" area line, and what replaced it. */
export function describeDeforestedPopup(
  p: Pick<DeforestedProperties, "name" | "area_ha" | "dominant_lu_desc" | "gpr">,
): PopupView {
  return {
    title: p.name,
    meta: `Deforested · ${areaMeta(p.area_ha)}`,
    zoning: describeZoning(p.dominant_lu_desc, p.gpr),
  };
}

/**
 * Renders a {@link PopupView} to the popup's outer markup: a title, the optional
 * meta line, and the zoning rows. Title and meta are escaped here (once, at the
 * boundary); the zoning HTML is already escaped by {@link zoningViewToHtml}.
 */
export function popupViewToHtml(v: PopupView): string {
  const meta = v.meta
    ? `<div class="deforest-popup__meta">${escapeHtml(v.meta)}</div>`
    : "";
  const zoning = v.zoning ? zoningViewToHtml(v.zoning) : "";
  return `<div class="deforest-popup__body"><div class="deforest-popup__title">${escapeHtml(v.title)}</div>${meta}${zoning}</div>`;
}
