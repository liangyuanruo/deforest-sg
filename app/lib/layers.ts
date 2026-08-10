/**
 * Map-layer metadata shared by the Mapbox view (visibility + legend) and the
 * filter modal (toggles). Kept mapbox-free so importing it never drags the
 * WebGL bundle into a component that must stay server-renderable.
 */
export type MapLayerKey = "forest" | "threatened" | "zones";
export type MapLayerVisibility = Record<MapLayerKey, boolean>;

export interface MapLayerMeta {
  key: MapLayerKey;
  label: string;
  swatch: string;
  description: string;
}

/** Ordered most-important first (threatened forest is the headline layer). */
export const MAP_LAYERS: MapLayerMeta[] = [
  {
    key: "threatened",
    label: "Threatened forest",
    swatch: "#f59e0b",
    description: "Forest on development-zoned land",
  },
  {
    key: "forest",
    label: "All mapped forest",
    swatch: "#16a34a",
    description: "Every OSM natural=forest patch",
  },
  {
    key: "zones",
    label: "Development zones",
    swatch: "#2563eb",
    description: "URA parcels touching forest",
  },
];
