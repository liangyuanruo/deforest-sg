"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { BASEMAP_STYLES, MAPBOX_TOKEN, type Basemap } from "@/lib/mapbox";
import { formatFootballFields, formatHa } from "@/lib/format";
import { formatGprRange, GPR_CODE_LABEL, parseGpr } from "@/lib/gpr";
import type { Theme } from "@/components/ThemeToggle";
import {
  LOST_FILL_COLOR,
  type ColorMode,
  type MapLayerVisibility,
} from "@/lib/layers";
import {
  colorForLandUse,
  descriptionForLandUse,
  landUseFillExpression,
} from "@/lib/landuse";
import { cn } from "@/lib/utils";
import type {
  DeforestedFeatureCollection,
  DevelopmentZoneFeatureCollection,
  ForestFeatureCollection,
  ThreatenedFeatureCollection,
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

/**
 * Fixed opening camera, shared by both basemaps (Standard and Satellite) — tuned
 * to frame Singapore. `setStyle` preserves the camera, so switching basemap keeps
 * this exact view; it's only set once, at mount.
 */
const CAMERA = {
  center: [103.79075, 1.36602] as [number, number],
  zoom: 11.74,
  bearing: 0,
  pitch: 0,
};

/**
 * Mapbox Standard `basemap` config: a neutral, desaturated grey treatment (muted
 * greens for greenspace, grey water/roads/buildings, dark labels) so the
 * threatened-forest overlay stays the focus. Applies only to the Standard vector
 * style — the Satellite option is a raster style and ignores it — and is
 * re-applied after every setStyle swap back to Standard (a swap resets config to
 * the style's defaults).
 *
 * The `show*` flags are theme-invariant (they strip distractions in both modes);
 * only the colours + `lightPreset` differ for dark, so the dark variant below
 * spreads this base and overrides just those. This is the light (`day`) config.
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
 * Dark-mode counterpart, applied when the app is in dark mode so the Street
 * basemap matches the chrome instead of glaring white. Same distraction-stripping
 * `show*` flags (spread from the light config); the ground goes near-black, labels
 * flip to light grey so they read on it, and greenspace becomes a desaturated dark
 * green — keeping the muted, low-contrast character so the red overlay still leads.
 * `lightPreset: "night"` shifts Standard's base render dark beneath these overrides.
 * Satellite is raster imagery with no config, so dark mode leaves it untouched.
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

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

/**
 * The URA-zoning rows shared by every popup that shows land use: a colour swatch +
 * land-use label, a plain-language gloss, and the plot-ratio range + code legend.
 * Reused by the vulnerable-forest and already-cleared popups so the two can't drift.
 * All interpolated values are escaped.
 */
function zoningRowsHtml(
  lu: string | null | undefined,
  gpr: string | null | undefined,
): string {
  const luRow = lu
    ? `<div class="deforest-popup__lu"><span class="deforest-popup__swatch" style="background:${colorForLandUse(lu)}"></span>${escapeHtml(lu)}</div>`
    : "";
  // Plain-language gloss so the URA code is legible to non-planners.
  const desc = lu ? descriptionForLandUse(lu) : undefined;
  const descRow = desc
    ? `<div class="deforest-popup__desc">${escapeHtml(desc)}</div>`
    : "";
  // Plot ratio: numeric density as a range + a compact code legend.
  const parsed = parseGpr(gpr ?? null);
  const gprRange = formatGprRange(parsed.ratios);
  const gprCodes = parsed.codes
    .map((c) => `${c}${GPR_CODE_LABEL[c] ? ` — ${GPR_CODE_LABEL[c]}` : ""}`)
    .join(" · ");
  const gprRow =
    gprRange || gprCodes
      ? `<div class="deforest-popup__gpr">Plot ratio${
          gprRange ? ` ${escapeHtml(gprRange)}` : ""
        }${
          gprCodes
            ? `<span class="deforest-popup__gprCodes">${escapeHtml(gprCodes)}</span>`
            : ""
        }</div>`
      : "";
  return luRow + descRow + gprRow;
}

function threatenedFilter(ids: number[] | null): mapboxgl.FilterSpecification | null {
  if (ids === null) return null;
  return ["in", ["get", "id"], ["literal", ids]] as unknown as mapboxgl.FilterSpecification;
}

// --- threatened-layer paint, per colour mode -----------------------------
// Polygons are drawn as fills only (no outlines); selection/hover therefore read
// entirely through colour and opacity below.
// feature-state predicates reused across the expressions below.
const SELECTED = ["boolean", ["feature-state", "selected"], false];
const HOVER = ["boolean", ["feature-state", "hover"], false];

// "status": every threatened patch reads the same alarm red; the selected patch
// jumps to a heatwave-scale purple (the extreme-danger end of a temperature ramp)
// so the affected area stands out against the red field.
const STATUS_FILL_COLOR = ["case", SELECTED, "#9333ea", "#dc2626"];
const STATUS_FILL_OPACITY = ["case", SELECTED, 0.72, HOVER, 0.62, 0.42];

// "landuse": each patch its own URA colour (never repainted by selection —
// colour follows the entity). Selection reads via an opacity bump; the base
// opacity is a touch higher so the pale/white URA fills (ROAD, WHITE,
// EDUCATIONAL) still read over the basemap.
const LANDUSE_FILL_OPACITY = ["case", SELECTED, 0.82, HOVER, 0.7, 0.6];

// Every polygon fill only carries transparency so the Satellite basemap's imagery
// reads through it. The Standard basemap has no imagery to preserve, so the fills
// paint solid there — for the threatened layer, selection still reads via colour
// (status → purple). Opacity is therefore basemap-dependent across all fill
// layers (threatened, forest wash, zones wash).
const SOLID_FILL_OPACITY = 1;

// Satellite-tuned opacities for the two context washes.
const FOREST_FILL_OPACITY = 0.14;
const ZONES_FILL_OPACITY = 0.28;

// Already-cleared forests read as bleached "scars" of lost biodiversity: a
// theme-flipped neutral (near-white on the dark app theme, dark grey on the light
// one) so they stand out in both. Higher opacity than the context washes above so
// they read as a solid loss, but still let the Satellite imagery show through.
const LOST_FILL_OPACITY = 0.6;
// The base scar colour is LOST_FILL_COLOR (shared with the legend — single source
// of truth, so the map fill and the key swatch can't drift). Only the *selected*
// extreme lives here: selecting a cleared forest nudges the neutral toward pure
// white (dark) / near-black (light) so the chosen scar reads as picked in both
// basemaps — the lost layer's analogue of the threatened status→purple cue, and a
// map-only cue with no legend counterpart.
const LOST_SELECTED: Record<Theme, string> = {
  dark: "#ffffff",
  light: "#18181b",
};
/**
 * The already-cleared fill's colour. In "landuse" mode it paints each scar its
 * URA zoning colour (the dominant land use that replaced the forest) — matching
 * the threatened layer, so the whole map recolours to zoning together; colour
 * follows the entity, so selection reads via opacity there, not a recolour. In
 * "status" mode it's the theme-flipped scar neutral (LOST_FILL_COLOR),
 * `selected`-aware via LOST_SELECTED.
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
 * Push the paint for the active colour mode onto the threatened layer. The
 * already-cleared scars recolour to their URA zoning in "landuse" mode too, but
 * that's owned by the theme effect (keyed on theme + mode) so the scar-neutral
 * re-tint and the zoning recolour share one code path.
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
 * Sync the URA development-zones layer to visibility. Each parcel is painted its
 * URA zoning colour (keyed on `lu_desc`), giving the threatened patch its
 * surrounding parcel's intended use. The fill shows whenever the layer is on (in
 * both colour modes) — with outlines removed it's the layer's only rendering.
 */
function syncZones(map: mapboxgl.Map, layers: MapLayerVisibility) {
  map.setLayoutProperty(LYR.zonesFill, "visibility", layers.zones ? "visible" : "none");
}

/**
 * (Re)install every source + layer and apply the current filter / visibility /
 * colour mode / selection. Idempotent against a freshly-loaded style, so it runs
 * both on first `load` and after each `setStyle` basemap swap (which wipes all
 * custom sources and layers). Interaction handlers are *not* attached here — they
 * live on the map object and survive a style swap, so they're bound once.
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
  // The lost layer promotes `uid` (not `id`): the UUID is the selection /
  // share / deep-link key, so feature-state must key on it too.
  map.addSource(SRC.lost, {
    type: "geojson",
    data: asFeatureCollection(p.deforested),
    promoteId: "uid",
  });

  // Every data fill is fully emissive so the Standard basemap's lighting model
  // (notably the dark `night` preset) can't mute it — the overlay reads at its
  // true colour in both day and night. Harmless on the Satellite raster style,
  // which has no lighting. Without this, `night` renders the red patches as dark
  // maroon and the green wash as near-black.
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
    // Painted per parcel from the URA palette (keyed on `lu_desc`); shown
    // whenever the layer is on via syncZones. Sits below the threatened fill so
    // each patch still paints on top of its surrounding parcel.
    paint: {
      "fill-color": landUseFillExpression("lu_desc") as never,
      "fill-opacity": contextFillOpacity(basemap, ZONES_FILL_OPACITY),
      "fill-emissive-strength": 1,
    },
  });
  // Already-cleared forests sit above the context washes but below the headline
  // vulnerable-red fill. Theme-driven colour (near-white dark / dark-grey light) is
  // set here and kept in sync by a dedicated theme effect. Sources/layers are
  // re-added after every basemap swap, so reading p.theme here restores the right
  // colour on each swap too.
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
 * Fly the camera to the selected patch's centroid. No-op when nothing is
 * selected or the feature isn't in the current data. Shared by the one-time
 * `load` handler (so a `/forest/<id>` deep link frames its patch as soon as the
 * map is ready) and the selection effect (clicks/search after mount) so both
 * paths frame a patch identically. `Math.max(getZoom(), 13.5)` zooms in from the
 * Singapore overview but never pulls back if the user is already closer.
 */
function flyToPoint(map: mapboxgl.Map, lon: number, lat: number) {
  // On phones the detail bottom-sheet opens to ~half height and would cover a
  // screen-centred patch, so pad the bottom of the fly's framing box by the
  // sheet's coverage — the patch then frames in the visible upper half. Desktop
  // (sheet absent) uses no padding.
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639px)").matches;
  const padding = isMobile
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
 * Imperative Mapbox GL map. The map object lives outside React's render cycle
 * (in refs); props are mirrored into `propsRef` so the one-time `load` handler
 * always sees the latest data, and dedicated effects push prop changes into the
 * map (data → setData, selection/filter → feature-state/filter, visibility →
 * layout property). Feature ids come from each feature's `id` property via
 * `promoteId`, so `feature-state` can key on it.
 */
export function MapView(props: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const readyRef = useRef(false);
  const hoveredRef = useRef<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const selectedLostRef = useRef<string | null>(null);

  // Basemap is a map-only concern (no other component reads it), so it lives here
  // rather than being lifted like colorMode. Defaults to the Standard style the
  // map first mounts with.
  const [basemap, setBasemap] = useState<Basemap>("standard");

  // Mirror latest props so the async `load` handler and event handlers read fresh
  // values. useRef seeds `current` with the initial props; this effect keeps it in
  // sync on every commit (updating a ref during render is disallowed).
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  // --- init once ---------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Mount default is the Standard basemap; later switches go through the
    // basemap effect below (setStyle + re-install layers + re-apply config). Must
    // match the initial `basemap` state so the effect doesn't immediately re-swap
    // on first load. The Standard `basemap` config and the fixed opening camera
    // are set here; the camera is shared with the Satellite option (setStyle keeps
    // the camera across a basemap swap).
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES.standard,
      config: { basemap: standardBasemapConfig(propsRef.current.theme) },
      ...CAMERA,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // "Go to my current location". Mapbox's own control covers desktop and mobile
    // in one: a touch-sized button beside the zoom controls, the browser
    // Geolocation prompt, a live location dot with accuracy circle, and (on
    // phones) the device heading. `trackUserLocation` keeps the dot following the
    // user and gives the button its centered/tracking states; high accuracy asks
    // for GPS on mobile. Geolocation needs a secure context — works on localhost
    // and the HTTPS deploy. A denied/failed fix is surfaced as a brief notice.
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

    // mapbox-gl.css forces `.mapboxgl-map { position: relative }`, and the flex/
    // dynamic-import mount can settle the container size *after* init. Keep the
    // canvas in sync on resize; the camera is a fixed center/zoom, so it needs no
    // re-framing — resize() re-renders the same view at the new container size.
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
      // Mount always starts on the Standard style (set above), so install with
      // the Standard fill opacities; later basemap swaps re-install via the
      // basemap effect with the then-current basemap.
      addSourcesAndLayers(map, p, "standard");
      selectedRef.current = p.selectedId;
      selectedLostRef.current = p.selectedLostId;
      readyRef.current = true;
      // Frame an initial selection (a `/forest/<id>` deep link): the selection
      // effect already ran and bailed while readyRef was false, so it won't
      // re-fire on its own — fly here now that the map is ready. Only one of the
      // two can be set (they're mutually exclusive), so both calls are safe.
      flyToSelected(map, p.threatened, p.selectedId);
      flyToSelectedLost(map, p.deforested, p.selectedLostId);

      // --- interaction (bound once; survives basemap style swaps) ---
      map.on("mousemove", LYR.threatFill, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (feature?.id == null) return;
        const id = Number(feature.id);
        if (hoveredRef.current !== null && hoveredRef.current !== id) {
          map.setFeatureState(
            { source: SRC.threatened, id: hoveredRef.current },
            { hover: false },
          );
        }
        hoveredRef.current = id;
        map.setFeatureState({ source: SRC.threatened, id }, { hover: true });

        const pr = feature.properties as {
          label?: string;
          area_ha?: number;
          dominant_lu_desc?: string;
          gpr?: string | null;
        } | null;
        const label = escapeHtml(pr?.label ?? "Forest patch");
        const area = typeof pr?.area_ha === "number" ? formatHa(pr.area_ha) : "";
        // A football-field comparison makes the hectare figure picturable — the
        // same secondary line the site card carries.
        const fields =
          typeof pr?.area_ha === "number"
            ? formatFootballFields(pr.area_ha)
            : "";
        const zoning = zoningRowsHtml(pr?.dominant_lu_desc, pr?.gpr);
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="deforest-popup__body"><div class="deforest-popup__title">${label}</div>` +
              (area
                ? `<div class="deforest-popup__meta">${area} vulnerable${
                    fields ? ` · ${escapeHtml(fields)}` : ""
                  }</div>`
                : "") +
              zoning +
              `</div>`,
          )
          .addTo(map);
      });

      map.on("mouseleave", LYR.threatFill, () => {
        map.getCanvas().style.cursor = "";
        if (hoveredRef.current !== null) {
          map.setFeatureState(
            { source: SRC.threatened, id: hoveredRef.current },
            { hover: false },
          );
          hoveredRef.current = null;
        }
        popup.remove();
      });

      // Already-cleared forests: a lighter popup — no feature-state highlight — that
      // names the site, marks it "Cleared", and shows its area + the same URA-zoning
      // rows (what replaced the forest) as the vulnerable-forest popup.
      map.on("mousemove", LYR.lostFill, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const pr = e.features?.[0]?.properties as {
          name?: string;
          area_ha?: number;
          dominant_lu_desc?: string | null;
          gpr?: string | null;
        } | null;
        const name = escapeHtml(pr?.name ?? "Cleared forest");
        const area = typeof pr?.area_ha === "number" ? formatHa(pr.area_ha) : "";
        const fields =
          typeof pr?.area_ha === "number" ? formatFootballFields(pr.area_ha) : "";
        const meta = [area && `${area}`, fields && escapeHtml(fields)]
          .filter(Boolean)
          .join(" · ");
        const zoning = zoningRowsHtml(pr?.dominant_lu_desc, pr?.gpr);
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="deforest-popup__body"><div class="deforest-popup__title">${name}</div>` +
              `<div class="deforest-popup__meta">Deforested${
                meta ? ` · ${meta}` : ""
              }</div>` +
              zoning +
              `</div>`,
          )
          .addTo(map);
      });

      map.on("mouseleave", LYR.lostFill, () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("click", (e) => {
        const p = propsRef.current;
        // The headline vulnerable layer wins when it's under the cursor (it also
        // renders on top); otherwise fall to an already-cleared scar; an empty
        // click clears both. queryRenderedFeatures skips hidden layers, so a
        // toggled-off layer isn't clickable. Lost ids are UUID strings.
        const threatHits = map.queryRenderedFeatures(e.point, {
          layers: [LYR.threatFill],
        });
        if (threatHits.length) {
          p.onSelect(Number(threatHits[0].id));
          return;
        }
        const lostHits = map.queryRenderedFeatures(e.point, {
          layers: [LYR.lostFill],
        });
        if (lostHits.length) {
          p.onSelectLost(String(lostHits[0].id));
          return;
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
  // Flipping the app's light/dark just swaps the Standard `basemap` config
  // (setConfig — no setStyle, no layer rebuild). Satellite has no config to
  // tint, so it's a no-op there; its effect re-runs on basemap change so the
  // config lands as soon as the user switches back to Street.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || basemap !== "standard") return;
    map.setConfig("basemap", standardBasemapConfig(props.theme));
  }, [props.theme, basemap]);

  // --- theme: recolour the already-cleared fill live ---------------------
  // In "status" mode the lost-forest fill flips near-white (dark app theme) /
  // dark grey (light) so it stays a visible "scar" in both. In "landuse" mode the
  // scar wears its URA zoning colour (theme-independent), so this is a no-op there
  // — passing the mode keeps a theme flip from clobbering the zoning colours. A
  // plain setPaintProperty — no style rebuild.
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
  // setStyle replaces the whole style, dropping every custom source/layer and
  // all feature-state. The camera is preserved, so the user keeps their view; we
  // just rebuild our overlay on the new basemap once it loads. Skipped until the
  // first `load` (readyRef) so it never fires against the mount style.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    readyRef.current = false;
    hoveredRef.current = null;
    popupRef.current?.remove();
    map.setStyle(BASEMAP_STYLES[basemap]);
    map.once("style.load", () => {
      const p = propsRef.current;
      // A style swap resets config to the new style's defaults, so re-apply the
      // Standard basemap treatment for the current theme. The Satellite raster
      // style has no `basemap` import to configure, so it's skipped there.
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

      {/* Map encoding toggles. Desktop: a row near the top-right, kept clear of
          the corner zoom controls (sm:right-16 leaves a gap). Phones: a row in
          the top-left corner — the bottom-right corner is now under the detail
          sheet and the top-right holds the zoom/locate controls, leaving the
          top-left as the only free corner. Each control sizes to its content
          (flex-none); the pair wraps only on the very narrowest phones. */}
      <div className="absolute top-3 left-3 z-10 flex flex-row flex-wrap items-start gap-2 sm:left-auto sm:right-16 sm:flex-nowrap">
        {/* Colour mode is a plain on/off: off is the default alarm red ("status"),
            on recolours each patch by its URA zoning. A single labelled switch
            (rather than a two-option toggle with an opaque "Status" label) is
            smaller and says exactly what turning it on does. */}
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
 * On-map segmented control — the "Colour by" and "Basemap" pickers in the
 * bottom-left cluster. Visible on every breakpoint (each changes a primary map
 * encoding); interactive, so it opts back into pointer events inside the
 * otherwise-passive overlay cluster.
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
 * On-map on/off switch, sharing the segmented control's card chrome so the two sit
 * flush in the same cluster. The label always shows (unlike the segmented control's
 * sm-only label) because here the label *is* the meaning — it names what the switch
 * turns on. Interactive, so it opts back into pointer events in the passive overlay.
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
