"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { BASEMAP_STYLES, MAPBOX_TOKEN, type Basemap } from "@/lib/mapbox";
import {
  describeDeforestedPopup,
  describeForestPopup,
  describeThreatenedPopup,
  describeZonePopup,
  popupViewToHtml,
  type PopupView,
} from "@/lib/feature-view";
import type { Theme } from "@/components/ThemeToggle";
import {
  LOST_FILL_COLOR,
  type ColorMode,
  type MapLayerVisibility,
} from "@/lib/layers";
import { landUseFillExpression } from "@/lib/landuse";
import { cn } from "@/lib/utils";
import type {
  DeforestedFeatureCollection,
  DeforestedProperties,
  DevelopmentZoneFeatureCollection,
  DevelopmentZoneProperties,
  ForestFeatureCollection,
  ForestProperties,
  ThreatenedFeatureCollection,
  ThreatenedProperties,
} from "@/lib/schema";

export type { ColorMode, MapLayerKey, MapLayerVisibility } from "@/lib/layers";

export interface MapViewProps {
  /** All mapped OSM forest (context base layer). */
  forest: ForestFeatureCollection | null;
  /** Threatened forest — the headline layer. */
  threatened: ThreatenedFeatureCollection | null;
  /** URA development zones (lazy-loaded; null until the layer is first enabled). */
  developmentZones: DevelopmentZoneFeatureCollection | null;
  /** Forest already cleared (Tengah, Dover East), annotated with MP2025 zoning. */
  deforested: DeforestedFeatureCollection | null;
  /** When non-null, only these threatened site ids are shown (search/filter result). */
  filteredIds: number[] | null;
  /** Currently selected site id (drives highlight + flyTo), or null. */
  selectedId: number | null;
  /** Called when the user clicks a threatened patch (or empty map → null). */
  onSelect: (id: number | null) => void;
  /** Currently selected cleared-forest UUID (its own namespace — a UUID string,
   *  disjoint from the threatened layer's numeric ids), or null. */
  selectedLostId: string | null;
  /** Called when the user clicks an already-cleared patch (or empty map → null). */
  onSelectLost: (uid: string | null) => void;
  /** Which layers are visible. */
  layers: MapLayerVisibility;
  /** How the threatened layer is coloured (status vs URA land use). */
  colorMode: ColorMode;
  /** Fired by the on-map "Colour by" toggle. */
  onColorModeChange: (mode: ColorMode) => void;
  /** App light/dark theme — picks the Street basemap's day vs night treatment.
   *  Satellite imagery is theme-invariant. */
  theme: Theme;
  className?: string;
}

/** Opening camera, tuned to frame Singapore. Shared across basemaps — `setStyle`
 *  preserves it on swap. Set once, at mount. */
const CAMERA = {
  center: [103.79075, 1.36602] as [number, number],
  zoom: 11.74,
  bearing: 0,
  pitch: 0,
};

/**
 * Standard `basemap` config: neutral desaturated grey so the forest overlay stays
 * the focus. Vector-style only (Satellite ignores it); re-applied after every
 * setStyle swap, which resets config to defaults. `show*` flags are
 * theme-invariant; the dark variant below spreads this and overrides colours only.
 */
const STANDARD_BASEMAP_CONFIG = {
  lightPreset: "day",
  colorMotorways: "#e0e0e0",
  colorTrunks: "#e6e6e6",
  colorRoads: "#e0e0e0",
  showPedestrianRoads: false,
  colorPlaceLabels: "#4a4a4a",
  showPointOfInterestLabels: false,
  colorPointOfInterestLabels: "#e0e0e0",
  colorRoadLabels: "#4a4a4a",
  showTransitLabels: false,
  showAdminBoundaries: false,
  show3dObjects: false,
  show3dBuildings: false,
  show3dTrees: false,
  show3dLandmarks: false,
  showLandmarkIconLabels: false,
  showIndoorLabels: false,
  colorBuildings: "#f0f0f0",
  colorCommercial: "#f0f0f0",
  colorEducation: "#f0f0f0",
  colorMedical: "#f0f0f0",
  colorIndustrial: "#f0f0f0",
  colorGreenspace: "#b3d5be",
  colorWater: "#cfcfcf",
  colorLand: "#f0f0f0",
};

/**
 * Dark-mode counterpart so the Street basemap matches dark chrome instead of
 * glaring white. Spreads the light config's `show*` flags; ground/labels/
 * greenspace go dark, and `lightPreset: "night"` shifts Standard's base render.
 * Satellite has no config, so dark mode leaves it untouched.
 */
const STANDARD_BASEMAP_CONFIG_DARK = {
  ...STANDARD_BASEMAP_CONFIG,
  lightPreset: "night",
  colorMotorways: "#3a3a3a",
  colorTrunks: "#3a3a3a",
  colorRoads: "#333333",
  colorPlaceLabels: "#c8c8c8",
  colorPointOfInterestLabels: "#808080",
  colorRoadLabels: "#b0b0b0",
  colorBuildings: "#242424",
  colorCommercial: "#242424",
  colorEducation: "#242424",
  colorMedical: "#242424",
  colorIndustrial: "#242424",
  colorGreenspace: "#3d8a5d",
  colorWater: "#151a1f",
  colorLand: "#1a1a1a",
};

/** The Standard `basemap` config for the app's current light/dark theme. */
function standardBasemapConfig(theme: Theme) {
  return theme === "dark" ? STANDARD_BASEMAP_CONFIG_DARK : STANDARD_BASEMAP_CONFIG;
}

const SRC = {
  forest: "forest",
  threatened: "threatened",
  zones: "zones",
  lost: "lost",
} as const;
const LYR = {
  forestFill: "forest-fill",
  zonesFill: "zones-fill",
  lostFill: "lost-fill",
  threatFill: "threatened-fill",
} as const;

const EMPTY_FC = { type: "FeatureCollection", features: [] } as const;

function asFeatureCollection(
  fc:
    | ForestFeatureCollection
    | ThreatenedFeatureCollection
    | DevelopmentZoneFeatureCollection
    | DeforestedFeatureCollection
    | null,
): GeoJSON.FeatureCollection {
  return (fc ?? EMPTY_FC) as unknown as GeoJSON.FeatureCollection;
}

/**
 * True on phone-width viewports (`<=639px`, matching `MobileSheet`'s `sm:hidden`
 * breakpoint). Evaluated per call so it tracks rotation/resize. Gates flyTo
 * padding and popup suppression — a touch tap fires a synthetic `mousemove`, and
 * the sheet already shows the tapped patch, so a hover popup on top is just noise.
 */
function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639px)").matches
  );
}

function threatenedFilter(ids: number[] | null): mapboxgl.FilterSpecification | null {
  if (ids === null) return null;
  return ["in", ["get", "id"], ["literal", ids]] as unknown as mapboxgl.FilterSpecification;
}

// --- threatened-layer paint, per colour mode -----------------------------
// Fills only, no outlines — selection/hover read entirely through colour/opacity.
const SELECTED = ["boolean", ["feature-state", "selected"], false];
const HOVER = ["boolean", ["feature-state", "hover"], false];

// "status": every patch reads alarm red; the selected patch jumps to heatwave
// purple so it stands out against the red field.
const STATUS_FILL_COLOR = ["case", SELECTED, "#9333ea", "#dc2626"];
const STATUS_FILL_OPACITY = ["case", SELECTED, 0.72, HOVER, 0.62, 0.42];

// "landuse": each patch keeps its own URA colour; selection reads via an opacity
// bump instead of a recolour (colour follows the entity).
const LANDUSE_FILL_OPACITY = ["case", SELECTED, 0.82, HOVER, 0.7, 0.6];

// Fills carry transparency so Satellite imagery reads through; Standard has no
// imagery to preserve, so fills paint solid there and selection reads via colour.
const SOLID_FILL_OPACITY = 1;

// Satellite-tuned opacities for the two context washes.
const FOREST_FILL_OPACITY = 0.14;
const ZONES_FILL_OPACITY = 0.28;

// Cleared forests read as bleached "scars": theme-flipped neutral (near-white
// dark / dark-grey light), higher opacity than the context washes so they read
// as a solid loss.
const LOST_FILL_OPACITY = 0.6;
// Base colour is LOST_FILL_COLOR (shared with the legend). Only the *selected*
// extreme lives here — nudges toward pure white/near-black so the picked scar
// reads in both basemaps.
const LOST_SELECTED: Record<Theme, string> = {
  dark: "#ffffff",
  light: "#18181b",
};
/**
 * Cleared-fill colour. "landuse" mode paints each scar its URA zoning colour
 * (matching the threatened layer); "status" mode uses the theme-flipped scar
 * neutral, `selected`-aware via LOST_SELECTED.
 */
function lostFillColor(theme: Theme, mode: ColorMode): unknown {
  if (mode === "landuse") return landUseFillExpression("dominant_lu_desc");
  return ["case", SELECTED, LOST_SELECTED[theme], LOST_FILL_COLOR[theme]];
}
/** Solid on Standard; on Satellite the base wash, bumped for the selected scar. */
function lostFillOpacity(basemap: Basemap): unknown {
  if (basemap === "standard") return SOLID_FILL_OPACITY;
  return ["case", SELECTED, 0.82, LOST_FILL_OPACITY];
}

function threatenedFillOpacity(mode: ColorMode, basemap: Basemap): unknown {
  if (basemap === "standard") return SOLID_FILL_OPACITY;
  return mode === "landuse" ? LANDUSE_FILL_OPACITY : STATUS_FILL_OPACITY;
}

/** Solid on Standard, the given satellite-tuned opacity on Satellite. */
function contextFillOpacity(basemap: Basemap, satelliteOpacity: number): number {
  return basemap === "standard" ? SOLID_FILL_OPACITY : satelliteOpacity;
}

/**
 * Push the active colour mode's paint onto the threatened layer. Cleared scars'
 * "landuse" recolour is owned by the theme effect instead, so both share one path.
 */
function applyColorMode(map: mapboxgl.Map, mode: ColorMode, basemap: Basemap) {
  const isLandUse = mode === "landuse";
  map.setPaintProperty(
    LYR.threatFill,
    "fill-color",
    (isLandUse ? landUseFillExpression() : STATUS_FILL_COLOR) as never,
  );
  map.setPaintProperty(
    LYR.threatFill,
    "fill-opacity",
    threatenedFillOpacity(mode, basemap) as never,
  );
}

/**
 * Sync the URA zones layer to visibility. Each parcel paints its zoning colour
 * (keyed on `lu_desc`); with outlines removed, the fill is its only rendering.
 */
function syncZones(map: mapboxgl.Map, layers: MapLayerVisibility) {
  map.setLayoutProperty(LYR.zonesFill, "visibility", layers.zones ? "visible" : "none");
}

/**
 * (Re)install every source + layer and apply current filter/visibility/colour/
 * selection. Idempotent, so it runs on first `load` and after each `setStyle`
 * swap (which wipes custom sources/layers). Interaction handlers live on the map
 * object and survive a swap, so they're bound once, elsewhere.
 */
function addSourcesAndLayers(map: mapboxgl.Map, p: MapViewProps, basemap: Basemap) {
  map.addSource(SRC.forest, {
    type: "geojson",
    data: asFeatureCollection(p.forest),
    promoteId: "id",
  });
  map.addSource(SRC.threatened, {
    type: "geojson",
    data: asFeatureCollection(p.threatened),
    promoteId: "id",
  });
  map.addSource(SRC.zones, {
    type: "geojson",
    data: asFeatureCollection(p.developmentZones),
    promoteId: "id",
  });
  // Lost layer promotes `uid`, not `id` — the UUID is its selection/share key.
  map.addSource(SRC.lost, {
    type: "geojson",
    data: asFeatureCollection(p.deforested),
    promoteId: "uid",
  });

  // Emissive so Standard's `night` lighting can't mute the overlay colours
  // (otherwise red renders dark maroon, green near-black). Harmless on Satellite.
  map.addLayer({
    id: LYR.forestFill,
    type: "fill",
    source: SRC.forest,
    paint: {
      "fill-color": "#16a34a",
      "fill-opacity": contextFillOpacity(basemap, FOREST_FILL_OPACITY),
      "fill-emissive-strength": 1,
    },
  });
  map.addLayer({
    id: LYR.zonesFill,
    type: "fill",
    source: SRC.zones,
    // Sits below the threatened fill so each patch paints on top of its parcel.
    paint: {
      "fill-color": landUseFillExpression("lu_desc") as never,
      "fill-opacity": contextFillOpacity(basemap, ZONES_FILL_OPACITY),
      "fill-emissive-strength": 1,
    },
  });
  // Sits above context washes, below the threatened fill. Colour is theme-driven
  // and kept in sync by a dedicated theme effect (re-read here on every basemap swap).
  map.addLayer({
    id: LYR.lostFill,
    type: "fill",
    source: SRC.lost,
    paint: {
      "fill-color": lostFillColor(p.theme, p.colorMode) as never,
      "fill-opacity": lostFillOpacity(basemap) as never,
      "fill-emissive-strength": 1,
    },
  });
  map.addLayer({
    id: LYR.threatFill,
    type: "fill",
    source: SRC.threatened,
    paint: {
      "fill-color": STATUS_FILL_COLOR as never,
      "fill-opacity": STATUS_FILL_OPACITY as never,
      "fill-emissive-strength": 1,
    },
  });

  // Apply current filter / selection / visibility / colour now that layers exist.
  const filter = threatenedFilter(p.filteredIds);
  map.setFilter(LYR.threatFill, filter);
  applyVisibility(map, p.layers);
  applyColorMode(map, p.colorMode, basemap);
  syncZones(map, p.layers);
  if (p.selectedId !== null) {
    map.setFeatureState({ source: SRC.threatened, id: p.selectedId }, { selected: true });
  }
  if (p.selectedLostId !== null) {
    map.setFeatureState({ source: SRC.lost, id: p.selectedLostId }, { selected: true });
  }
}

/**
 * Fly the camera to a patch's centroid. No-op when nothing is selected or the
 * feature isn't in the current data. Shared by the mount `load` handler (so a
 * `/forest/<id>` deep link frames immediately) and the selection effect, so both
 * paths frame identically. Zooms in from the overview but never pulls back.
 */
function flyToPoint(map: mapboxgl.Map, lon: number, lat: number) {
  // Phones: pad the bottom by the sheet's ~half-height coverage so the patch
  // frames in the visible upper half. Desktop (no sheet) uses no padding.
  const padding = isMobileViewport()
    ? { bottom: Math.round(window.innerHeight * 0.45) }
    : undefined;
  map.flyTo({
    center: [lon, lat],
    zoom: Math.max(map.getZoom(), 13.5),
    duration: 2000,
    padding,
    essential: true,
  });
}

function flyToSelected(
  map: mapboxgl.Map,
  threatened: ThreatenedFeatureCollection | null,
  selectedId: number | null,
) {
  if (selectedId === null) return;
  const feature = threatened?.features.find(
    (f) => f.properties.id === selectedId,
  );
  if (!feature) return;
  flyToPoint(map, feature.properties.centroid_lon, feature.properties.centroid_lat);
}

/** {@link flyToSelected} for the already-cleared layer, keyed on the UUID. */
function flyToSelectedLost(
  map: mapboxgl.Map,
  deforested: DeforestedFeatureCollection | null,
  selectedLostId: string | null,
) {
  if (selectedLostId === null) return;
  const feature = deforested?.features.find(
    (f) => f.properties.uid === selectedLostId,
  );
  if (!feature) return;
  flyToPoint(map, feature.properties.centroid_lon, feature.properties.centroid_lat);
}

/**
 * Per-layer hover behaviour, declared once so layers can't drift (this is how the
 * pointer cursor previously ended up set on only two of four handlers). `cursor`
 * shows/resets the pointer; `coveredBy` defers to layers painted on top;
 * `featureStateHover` toggles the `{hover}` state the threatened paint reads.
 */
interface HoverBinding {
  layer: string;
  source: string;
  describe: (props: unknown) => PopupView;
  cursor: boolean;
  coveredBy: string[];
  featureStateHover: boolean;
  /** Show this layer's popup on a phone tap (no hover on touch). True for
   *  non-selectable context layers (zones, forest); selectable layers open the
   *  detail sheet instead. */
  peekable: boolean;
}

const HOVER_BINDINGS: HoverBinding[] = [
  {
    layer: LYR.threatFill,
    source: SRC.threatened,
    describe: (p) => describeThreatenedPopup(p as ThreatenedProperties),
    cursor: true,
    coveredBy: [],
    featureStateHover: true,
    peekable: false,
  },
  {
    layer: LYR.lostFill,
    source: SRC.lost,
    describe: (p) => describeDeforestedPopup(p as DeforestedProperties),
    cursor: true,
    coveredBy: [],
    featureStateHover: false,
    peekable: false,
  },
  {
    layer: LYR.zonesFill,
    source: SRC.zones,
    describe: (p) => describeZonePopup(p as DevelopmentZoneProperties),
    // Signals interactivity like the other layers even though zones aren't
    // selectable — fixes the drift where only threatened/cleared showed the pointer.
    cursor: true,
    coveredBy: [LYR.threatFill, LYR.lostFill],
    featureStateHover: false,
    peekable: true,
  },
  {
    layer: LYR.forestFill,
    source: SRC.forest,
    describe: (p) => describeForestPopup(p as ForestProperties),
    cursor: true,
    coveredBy: [LYR.threatFill, LYR.lostFill, LYR.zonesFill],
    featureStateHover: false,
    peekable: true,
  },
];

/**
 * Binds one layer's hover popup + cursor + feature-state highlight from its
 * {@link HoverBinding}. Suppressed on phones (see isMobileViewport) since taps
 * fire a synthetic mousemove and the sheet already shows the detail. Properties
 * are pre-validated by lib/data, so `describe` casts them to its schema type.
 */
function bindHover(
  map: mapboxgl.Map,
  popup: mapboxgl.Popup,
  binding: HoverBinding,
  hoveredRef: { current: number | null },
): void {
  map.on("mousemove", binding.layer, (e) => {
    if (isMobileViewport()) return;
    // Defer to any layer painted on top: it speaks for the point, not this one.
    if (
      binding.coveredBy.length &&
      map.queryRenderedFeatures(e.point, { layers: binding.coveredBy }).length
    ) {
      return;
    }
    if (binding.cursor) map.getCanvas().style.cursor = "pointer";
    const feature = e.features?.[0];
    if (!feature) return;
    if (binding.featureStateHover) {
      if (feature.id == null) return;
      const id = Number(feature.id);
      if (hoveredRef.current !== null && hoveredRef.current !== id) {
        map.setFeatureState({ source: binding.source, id: hoveredRef.current }, { hover: false });
      }
      hoveredRef.current = id;
      map.setFeatureState({ source: binding.source, id }, { hover: true });
    }
    popup
      .setLngLat(e.lngLat)
      .setHTML(popupViewToHtml(binding.describe(feature.properties)))
      .addTo(map);
  });

  map.on("mouseleave", binding.layer, () => {
    if (binding.cursor) map.getCanvas().style.cursor = "";
    if (binding.featureStateHover && hoveredRef.current !== null) {
      map.setFeatureState({ source: binding.source, id: hoveredRef.current }, { hover: false });
      hoveredRef.current = null;
    }
    popup.remove();
  });
}

/**
 * Imperative Mapbox GL map. The map lives outside React's render cycle (in
 * refs); props mirror into `propsRef` so async handlers see fresh data, and
 * dedicated effects push prop changes in (data → setData, selection → feature-
 * state/filter, visibility → layout property). Feature ids come from `id` via
 * `promoteId` so feature-state can key on it.
 */
export function MapView(props: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const readyRef = useRef(false);
  const hoveredRef = useRef<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const selectedLostRef = useRef<string | null>(null);

  // Map-only concern (nothing else reads it), so it lives here rather than being
  // lifted like colorMode. Defaults to the Standard style the map mounts with.
  const [basemap, setBasemap] = useState<Basemap>("standard");

  // Seeded with initial props; kept in sync every commit (can't update a ref
  // during render) so the async `load` handler and event handlers see fresh data.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  // --- init once ---------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Must match initial `basemap` state or the basemap effect re-swaps on first
    // load. Camera is shared across basemaps (setStyle preserves it on swap).
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES.standard,
      config: { basemap: standardBasemapConfig(propsRef.current.theme) },
      ...CAMERA,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // Mapbox's built-in "go to my location" control: button, Geolocation prompt,
    // live accuracy dot, device heading on phones. Needs a secure context (works
    // on localhost + the HTTPS deploy); a denied/failed fix surfaces as a notice.
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });
    map.addControl(geolocate, "top-right");
    geolocate.on("error", (err) => {
      // PERMISSION_DENIED (1) is a user choice, not a fault — stay quiet.
      if (err.code !== 1) {
        console.warn("Geolocation failed:", err.message);
      }
    });

    // The flex/dynamic-import mount can settle container size after init — keep
    // the canvas in sync. Camera is fixed, so resize() just re-renders at the new size.
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: "deforest-popup",
    });
    popupRef.current = popup;

    map.on("load", () => {
      const p = propsRef.current;
      // Mounts on Standard (set above); later basemap swaps re-install via the
      // basemap effect with the then-current basemap.
      addSourcesAndLayers(map, p, "standard");
      selectedRef.current = p.selectedId;
      selectedLostRef.current = p.selectedLostId;
      readyRef.current = true;
      // Frame an initial selection (`/forest/<id>` deep link): the selection
      // effect already bailed while readyRef was false, so fly here instead.
      // selectedId/selectedLostId are mutually exclusive, so both calls are safe.
      flyToSelected(map, p.threatened, p.selectedId);
      flyToSelectedLost(map, p.deforested, p.selectedLostId);

      // --- interaction (bound once; survives basemap swaps) ---
      // Click/selection is separate below — only threatened + cleared are selectable.
      for (const binding of HOVER_BINDINGS) bindHover(map, popup, binding, hoveredRef);

      map.on("click", (e) => {
        const p = propsRef.current;
        // Phones have no hover, so a tap is the only affordance — clear any prior
        // peek popup up front.
        const mobile = isMobileViewport();
        if (mobile) popup.remove();
        // Threatened wins when hit (also renders on top); else fall to a cleared
        // scar; empty click clears both. Hidden layers aren't clickable
        // (queryRenderedFeatures skips them). Lost ids are UUID strings.
        const threatHits = map.queryRenderedFeatures(e.point, {
          layers: [LYR.threatFill],
        });
        if (threatHits.length) {
          const id = Number(threatHits[0].id);
          // Re-clicking the selected patch leaves state unchanged (no effect
          // re-fire), so fly here to always re-frame even after panning away.
          if (id === p.selectedId) {
            const pr = threatHits[0].properties as {
              centroid_lon?: number;
              centroid_lat?: number;
            } | null;
            if (
              typeof pr?.centroid_lon === "number" &&
              typeof pr?.centroid_lat === "number"
            ) {
              flyToPoint(map, pr.centroid_lon, pr.centroid_lat);
            }
          }
          p.onSelect(id);
          return;
        }
        const lostHits = map.queryRenderedFeatures(e.point, {
          layers: [LYR.lostFill],
        });
        if (lostHits.length) {
          const uid = String(lostHits[0].id);
          // Same re-click guard as the threatened layer above.
          if (uid === p.selectedLostId) {
            const pr = lostHits[0].properties as {
              centroid_lon?: number;
              centroid_lat?: number;
            } | null;
            if (
              typeof pr?.centroid_lon === "number" &&
              typeof pr?.centroid_lat === "number"
            ) {
              flyToPoint(map, pr.centroid_lon, pr.centroid_lat);
            }
          }
          p.onSelectLost(uid);
          return;
        }
        // Phones only: a bare zone/forest tap has no selectable card, so show its
        // popup instead — the touch equivalent of desktop hover. HOVER_BINDINGS is
        // in cover order, so zones win over forest.
        if (mobile) {
          for (const b of HOVER_BINDINGS) {
            if (!b.peekable) continue;
            const props = map.queryRenderedFeatures(e.point, { layers: [b.layer] })[0]
              ?.properties;
            if (props) {
              popup
                .setLngLat(e.lngLat)
                .setHTML(popupViewToHtml(b.describe(props)))
                .addTo(map);
              return;
            }
          }
        }
        p.onSelect(null);
        p.onSelectLost(null);
      });
    });

    return () => {
      resizeObserver.disconnect();
      popup.remove();
      map.remove();
      mapRef.current = null;
      popupRef.current = null;
      readyRef.current = false;
    };
    // Mount-only: subsequent prop changes are handled by the effects below.
  }, []);

  // --- data → setData ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(SRC.forest) as mapboxgl.GeoJSONSource | undefined)?.setData(
      asFeatureCollection(props.forest),
    );
  }, [props.forest]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(SRC.threatened) as mapboxgl.GeoJSONSource | undefined)?.setData(
      asFeatureCollection(props.threatened),
    );
  }, [props.threatened]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(SRC.zones) as mapboxgl.GeoJSONSource | undefined)?.setData(
      asFeatureCollection(props.developmentZones),
    );
  }, [props.developmentZones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(SRC.lost) as mapboxgl.GeoJSONSource | undefined)?.setData(
      asFeatureCollection(props.deforested),
    );
  }, [props.deforested]);

  // --- filter ------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const filter = threatenedFilter(props.filteredIds);
    map.setFilter(LYR.threatFill, filter);
  }, [props.filteredIds]);

  // --- selection: feature-state + flyTo ----------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const prev = selectedRef.current;
    if (prev !== null && prev !== props.selectedId) {
      map.setFeatureState({ source: SRC.threatened, id: prev }, { selected: false });
    }
    if (props.selectedId !== null) {
      map.setFeatureState(
        { source: SRC.threatened, id: props.selectedId },
        { selected: true },
      );
      flyToSelected(map, props.threatened, props.selectedId);
    }
    selectedRef.current = props.selectedId;
  }, [props.selectedId, props.threatened]);

  // --- lost selection: feature-state + flyTo -----------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const prev = selectedLostRef.current;
    if (prev !== null && prev !== props.selectedLostId) {
      map.setFeatureState({ source: SRC.lost, id: prev }, { selected: false });
    }
    if (props.selectedLostId !== null) {
      map.setFeatureState(
        { source: SRC.lost, id: props.selectedLostId },
        { selected: true },
      );
      flyToSelectedLost(map, props.deforested, props.selectedLostId);
    }
    selectedLostRef.current = props.selectedLostId;
  }, [props.selectedLostId, props.deforested]);

  // --- visibility --------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyVisibility(map, props.layers);
    syncZones(map, props.layers);
  }, [props.layers]);

  // --- colour mode -------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyColorMode(map, props.colorMode, basemap);
  }, [props.colorMode, basemap]);

  // --- theme: re-tint the Street basemap live ----------------------------
  // Flipping theme just swaps the Standard config (setConfig, no rebuild).
  // No-op on Satellite (no config); re-runs on basemap change so it lands when
  // switching back to Street.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || basemap !== "standard") return;
    map.setConfig("basemap", standardBasemapConfig(props.theme));
  }, [props.theme, basemap]);

  // --- theme: recolour the already-cleared fill live ---------------------
  // "status" mode flips the cleared fill near-white/dark-grey so it stays a
  // visible scar in both themes. "landuse" mode's zoning colour is
  // theme-independent, so this is a no-op there. Plain setPaintProperty, no rebuild.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setPaintProperty(
      LYR.lostFill,
      "fill-color",
      lostFillColor(props.theme, props.colorMode) as never,
    );
  }, [props.theme, props.colorMode]);

  // --- basemap: swap the base style, then re-install our layers -----------
  // setStyle replaces the whole style, dropping every custom source/layer/state.
  // Camera is preserved. Skipped until first `load` so it never fires on mount.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    readyRef.current = false;
    hoveredRef.current = null;
    popupRef.current?.remove();
    map.setStyle(BASEMAP_STYLES[basemap]);
    map.once("style.load", () => {
      const p = propsRef.current;
      // Style swap resets config to defaults — re-apply Standard's theme config.
      // Satellite has no `basemap` import, so it's skipped there.
      if (basemap === "standard") {
        map.setConfig("basemap", standardBasemapConfig(propsRef.current.theme));
      }
      addSourcesAndLayers(map, p, basemap);
      selectedRef.current = p.selectedId;
      selectedLostRef.current = p.selectedLostId;
      readyRef.current = true;
    });
  }, [basemap]);

  return (
    <div className={cn("relative h-full w-full", props.className)}>
      <div ref={containerRef} className="h-full w-full" />

      {/* Map encoding toggles. Desktop: row near top-right (sm:right-16 clears the
          zoom controls). Phones: top-left, since top-right holds zoom/locate and
          bottom-right is under the detail sheet. */}
      <div className="absolute top-3 left-3 z-10 flex flex-row flex-wrap items-start gap-2 sm:left-auto sm:right-16 sm:flex-nowrap">
        {/* Off = alarm red ("status"), on = colour by URA zoning. A single
            labelled switch says what it does; an opaque "Status" toggle wouldn't. */}
        <SwitchControl
          label="URA zoning"
          ariaLabel="Colour vulnerable forest by URA zoning"
          checked={props.colorMode === "landuse"}
          onChange={(on) => props.onColorModeChange(on ? "landuse" : "status")}
          className="flex-none"
        />
        <SegmentedControl
          label="Basemap"
          ariaLabel="Basemap style"
          options={BASEMAP_OPTIONS}
          value={basemap}
          onChange={setBasemap}
          className="flex-none"
        />
      </div>
    </div>
  );
}

const BASEMAP_OPTIONS: { key: Basemap; label: string }[] = [
  { key: "satellite", label: "Satellite" },
  { key: "standard", label: "Street" },
];

/**
 * On-map segmented control — "Colour by" / "Basemap" pickers. Always visible
 * (each changes a primary map encoding); opts back into pointer events inside
 * the otherwise-passive overlay cluster.
 */
function SegmentedControl<T extends string>({
  label,
  ariaLabel,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  ariaLabel: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/85 py-1 pr-1 pl-2 shadow-sm backdrop-blur",
        className,
      )}
    >
      <span className="hidden text-[11px] text-muted-foreground sm:inline">{label}</span>
      <div
        role="group"
        aria-label={ariaLabel}
        className="flex w-full rounded-md bg-muted/60 p-0.5 sm:inline-flex sm:w-auto"
      >
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex-1 rounded-[5px] px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors sm:flex-none",
              value === o.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * On-map switch, sharing the segmented control's chrome. Label always shows
 * (unlike the segmented control's sm-only label) since here the label *is* the
 * meaning. Opts back into pointer events in the passive overlay.
 */
function SwitchControl({
  label,
  ariaLabel,
  checked,
  onChange,
  className,
}: {
  label: string;
  ariaLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-lg border border-border/60 bg-card/85 py-2 pr-2 pl-2.5 shadow-sm backdrop-blur",
        className,
      )}
    >
      <span className="text-[11px] leading-none font-medium whitespace-nowrap text-foreground">
        {label}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block size-3 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function applyVisibility(map: mapboxgl.Map, layers: MapLayerVisibility) {
  const v = (on: boolean) => (on ? "visible" : "none");
  map.setLayoutProperty(LYR.forestFill, "visibility", v(layers.forest));
  map.setLayoutProperty(LYR.threatFill, "visibility", v(layers.threatened));
  map.setLayoutProperty(LYR.lostFill, "visibility", v(layers.lost));
  // The zones layer is handled by syncZones.
}
