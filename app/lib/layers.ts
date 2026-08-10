/**
 * Map-layer metadata shared by the Mapbox view (visibility + legend) and the
 * filter modal (toggles). Kept mapbox-free so importing it never drags the
 * WebGL bundle into a component that must stay server-renderable.
 */
export type MapLayerKey = "forest" | "threatened" | "zones";
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
   * two input layers it's derived from. Lets the filter panel show the derivation
   * instead of presenting all three as unrelated peers.
   */
  role: "result" | "source";
  /** Short, lowercase name used in the "forest ∩ zones = threatened" formula. */
  shortLabel: string;
}

/** Ordered most-important first (threatened forest is the headline layer). */
export const MAP_LAYERS: MapLayerMeta[] = [
  {
    key: "threatened",
    label: "Threatened forest",
    swatch: "#dc2626",
    description: "Where the two source layers overlap",
    role: "result",
    shortLabel: "threatened forest",
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
];
