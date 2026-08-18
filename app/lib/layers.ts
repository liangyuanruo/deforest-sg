/**
 * Map-layer metadata shared by the Mapbox view (visibility + legend) and the
 * filter modal (toggles). Kept mapbox-free so importing it never drags the
 * WebGL bundle into a component that must stay server-renderable. (The `Theme`
 * import is type-only, erased at compile — no client runtime pulled in.)
 */
import type { Theme } from "@/components/ThemeToggle";

export type MapLayerKey = "forest" | "threatened" | "zones" | "lost";
export type MapLayerVisibility = Record<MapLayerKey, boolean>;

/**
 * How the threatened layer is coloured: "status" (headline alarm red, heatwave
 * purple when selected) or "landuse" (each patch its official URA MP2025 zoning
 * colour).
 */
export type ColorMode = "status" | "landuse";

export interface MapLayerMeta {
  key: MapLayerKey;
  label: string;
  swatch: string;
  description: string;
  /**
   * "result" is the computed overlap (threatened forest); "source" is one of the
   * two input layers it's derived from; "lost" is forest already cleared (shown
   * for contrast, not part of the overlap). Lets the filter panel group the layers
   * by what they mean instead of presenting them as unrelated peers.
   */
  role: "result" | "source" | "lost";
  /** Short, lowercase name used in the "forest ∩ zones = threatened" formula. */
  shortLabel: string;
}

/**
 * The development-zones fill in "status" colour mode — the same blue the legend
 * swatch shows. Single source of truth for both, so the chip can't drift from the
 * parcels. ("landuse" mode repaints the layer per parcel from the URA palette.)
 */
export const ZONES_FILL_COLOR = "#2563eb";

/** Ordered most-important first (threatened forest is the headline layer). */
export const MAP_LAYERS: MapLayerMeta[] = [
  {
    key: "threatened",
    label: "Vulnerable forest",
    swatch: "#dc2626",
    description: "Where the two source layers overlap",
    role: "result",
    shortLabel: "vulnerable forest",
  },
  {
    key: "forest",
    label: "All mapped forest",
    swatch: "#16a34a",
    description: "Tree cover traced from satellite imagery, from OpenStreetMap",
    role: "source",
    shortLabel: "mapped forest",
  },
  {
    key: "zones",
    label: "Development zones",
    swatch: ZONES_FILL_COLOR,
    description: "Building-zoned land that touches forest (Master Plan 2025)",
    role: "source",
    shortLabel: "development zones",
  },
  {
    key: "lost",
    // Theme-flipped on the map, so its legend swatch is resolved per theme via
    // `swatchForLayer` (see LOST_FILL_COLOR) — this static value is only a
    // fallback for any raw `.swatch` read, kept equal to the light-theme scar.
    label: "Deforested",
    swatch: "#3f3f46",
    description: "Forest already cleared for development",
    role: "lost",
    shortLabel: "deforested",
  },
];

/**
 * The already-cleared "scar" fill is theme-flipped — near-white on the dark app
 * theme, dark grey on the light one — so it stays visible in both. This is the
 * **single source of truth** for that colour: the map paint (`MapView`) and every
 * legend swatch resolve it here, so a legend chip can never drift from the polygon.
 */
export const LOST_FILL_COLOR: Record<Theme, string> = {
  dark: "#f4f4f5",
  light: "#3f3f46",
};

/**
 * The colour a layer is painted on the map at the current app theme — the value a
 * legend swatch must use to match it. Fixed-fill layers return their static
 * `swatch`; the theme-flipped "lost" scar resolves per theme. Route every legend
 * chip through this so the key and the map can't diverge.
 *
 * (The `zones` swatch matches the layer in "status" mode; in "landuse" mode that
 * layer paints per parcel from the URA palette, which the breakdown already keys.)
 */
export function swatchForLayer(layer: MapLayerMeta, theme: Theme): string {
  return layer.key === "lost" ? LOST_FILL_COLOR[theme] : layer.swatch;
}
