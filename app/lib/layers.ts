/**
 * Map-layer metadata shared by the Mapbox view (visibility + legend) and the
 * filter modal (toggles). Kept mapbox-free so importing it never drags the
 * WebGL bundle into a component that must stay server-renderable.
 */
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
    swatch: "#2563eb",
    description: "Building-zoned land that touches forest (Master Plan 2025)",
    role: "source",
    shortLabel: "development zones",
  },
  {
    key: "lost",
    label: "Already lost",
    swatch: "#71717a",
    description: "Forest already cleared for development (Tengah, Dover East)",
    role: "lost",
    shortLabel: "already lost",
  },
];
