export const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoibGlhbmd5dWFucnVvIiwiYSI6ImNtc212MjZ3cDBwOWwzMHM4aWp6dGVrcTUifQ.4EiQVfh6qL4Sm4grV2F53Q";

export const MAPBOX_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE ??
  "mapbox://styles/liangyuanruo/cmsmuyf31012201sd2043dmfq";

/**
 * Mapbox's stock vector basemap (3D, labelled streets). Offered as an alternate
 * to the satellite `MAPBOX_STYLE` so the plan geometry can be read against either
 * imagery or a plain map. A stock style, so any token can load it.
 */
export const MAPBOX_STANDARD_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STANDARD_STYLE ?? "mapbox://styles/mapbox/standard";

/** Which basemap the map is rendered on. */
export type Basemap = "satellite" | "standard";

export const BASEMAP_STYLES: Record<Basemap, string> = {
  satellite: MAPBOX_STYLE,
  standard: MAPBOX_STANDARD_STYLE,
};
