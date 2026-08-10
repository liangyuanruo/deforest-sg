"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ChevronDown, Layers } from "lucide-react";
import { BASEMAP_STYLES, MAPBOX_TOKEN, type Basemap } from "@/lib/mapbox";
import { formatHa } from "@/lib/format";
import { MAP_LAYERS, type ColorMode, type MapLayerVisibility } from "@/lib/layers";
import {
  aggregateByLandUse,
  colorForLandUse,
  landUseFillExpression,
  OTHER_LABEL,
  toColoredSlices,
  type LandUseSlice,
} from "@/lib/landuse";
import { cn } from "@/lib/utils";
import type {
  DevelopmentZoneFeatureCollection,
  ForestFeatureCollection,
  ThreatenedFeatureCollection,
} from "@/lib/schema";

export type { ColorMode, MapLayerKey, MapLayerVisibility } from "@/lib/layers";

/** How many land-use classes to name in the map legend before folding to "Other". */
const LEGEND_MAX_CLASSES = 8;

export interface MapViewProps {
  /** All mapped OSM forest (context base layer). */
  forest: ForestFeatureCollection | null;
  /** Threatened forest — the headline layer. */
  threatened: ThreatenedFeatureCollection | null;
  /** URA development zones (lazy-loaded; null until the layer is first enabled). */
  developmentZones: DevelopmentZoneFeatureCollection | null;
  /** When non-null, only these threatened site ids are shown (search/filter result). */
  filteredIds: number[] | null;
  /** Currently selected site id (drives highlight + flyTo), or null. */
  selectedId: number | null;
  /** Called when the user clicks a threatened patch (or empty map → null). */
  onSelect: (id: number | null) => void;
  /** Which layers are visible. */
  layers: MapLayerVisibility;
  /** How the threatened layer is coloured (status vs URA land use). */
  colorMode: ColorMode;
  /** Fired by the on-map "Colour by" toggle. */
  onColorModeChange: (mode: ColorMode) => void;
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
 * Mapbox Standard `basemap` config: a faded, label-light, flat treatment so the
 * threatened-forest overlay stays the focus. Applies only to the Standard vector
 * style — the Satellite option is a raster style and ignores it — and is
 * re-applied after every setStyle swap back to Standard (a swap resets config to
 * the style's defaults).
 */
const STANDARD_BASEMAP_CONFIG = {
  lightPreset: "dawn",
  colorMotorways: "#ffdbf4",
  colorTrunks: "#ffdbf4",
  colorRoads: "#ffdbf4",
  showPedestrianRoads: false,
  showPointOfInterestLabels: false,
  colorPointOfInterestLabels: "#fffcf5",
  showRoadLabels: false,
  showTransitLabels: false,
  showAdminBoundaries: false,
  show3dObjects: false,
  show3dBuildings: false,
  show3dTrees: false,
  show3dLandmarks: false,
  showLandmarkIconLabels: false,
  showIndoorLabels: false,
  theme: "faded",
  colorBuildings: "#fffcf5",
  colorCommercial: "#fffcf5",
  colorEducation: "#fffcf5",
  colorMedical: "#fffcf5",
  colorIndustrial: "#fffcf5",
  colorGreenspace: "#96df90",
  colorWater: "#29b8ff",
  colorLand: "#fffcf5",
};

const SRC = { forest: "forest", threatened: "threatened", zones: "zones" } as const;
const LYR = {
  forestFill: "forest-fill",
  forestLine: "forest-line",
  zonesFill: "zones-fill",
  zonesLine: "zones-line",
  threatFill: "threatened-fill",
  threatLine: "threatened-line",
} as const;

const EMPTY_FC = { type: "FeatureCollection", features: [] } as const;

function asFeatureCollection(
  fc:
    | ForestFeatureCollection
    | ThreatenedFeatureCollection
    | DevelopmentZoneFeatureCollection
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

function threatenedFilter(ids: number[] | null): mapboxgl.FilterSpecification | null {
  if (ids === null) return null;
  return ["in", ["get", "id"], ["literal", ids]] as unknown as mapboxgl.FilterSpecification;
}

// --- threatened-layer paint, per colour mode -----------------------------
// feature-state predicates reused across the expressions below.
const SELECTED = ["boolean", ["feature-state", "selected"], false];
const HOVER = ["boolean", ["feature-state", "hover"], false];

// "status": every threatened patch reads the same alarm red; the selected patch
// jumps to a heatwave-scale purple (the extreme-danger end of a temperature ramp)
// so the affected area stands out against the red field.
const STATUS_FILL_COLOR = ["case", SELECTED, "#9333ea", "#dc2626"];
const STATUS_FILL_OPACITY = ["case", SELECTED, 0.72, HOVER, 0.62, 0.42];
const STATUS_LINE_COLOR = ["case", SELECTED, "#6b21a8", "#991b1b"];

// "landuse": each patch its own URA colour (never repainted by selection —
// colour follows the entity). Selection reads via a darker, heavier outline and
// a small opacity bump; the base opacity is a touch higher so the pale/white
// URA fills (ROAD, WHITE, EDUCATIONAL) still read over the basemap.
const LANDUSE_FILL_OPACITY = ["case", SELECTED, 0.82, HOVER, 0.7, 0.6];
const LANDUSE_LINE_COLOR = ["case", SELECTED, "#0f172a", "#334155"];

/** Push the paint for the active colour mode onto the threatened layers. */
function applyColorMode(map: mapboxgl.Map, mode: ColorMode) {
  const isLandUse = mode === "landuse";
  map.setPaintProperty(
    LYR.threatFill,
    "fill-color",
    (isLandUse ? landUseFillExpression() : STATUS_FILL_COLOR) as never,
  );
  map.setPaintProperty(
    LYR.threatFill,
    "fill-opacity",
    (isLandUse ? LANDUSE_FILL_OPACITY : STATUS_FILL_OPACITY) as never,
  );
  map.setPaintProperty(
    LYR.threatLine,
    "line-color",
    (isLandUse ? LANDUSE_LINE_COLOR : STATUS_LINE_COLOR) as never,
  );
}

/**
 * Sync the URA development-zones layer to both visibility and colour mode. Kept
 * separate from applyVisibility/applyColorMode because the zones *fill* depends
 * on both: it only shows in land-use mode (each parcel painted its URA zoning
 * colour, giving the threatened patch its surrounding parcel's intended use);
 * in status mode the zones stay the plain blue dashed outline. The outline is
 * always shown when the layer is on, switching from blue (status) to a neutral
 * dark (land use) so it reads over the varied parcel fills.
 */
function syncZones(map: mapboxgl.Map, layers: MapLayerVisibility, mode: ColorMode) {
  const isLandUse = mode === "landuse";
  const v = (on: boolean) => (on ? "visible" : "none");
  map.setLayoutProperty(LYR.zonesFill, "visibility", v(layers.zones && isLandUse));
  map.setLayoutProperty(LYR.zonesLine, "visibility", v(layers.zones));
  map.setPaintProperty(LYR.zonesLine, "line-color", isLandUse ? "#334155" : "#2563eb");
}

/**
 * (Re)install every source + layer and apply the current filter / visibility /
 * colour mode / selection. Idempotent against a freshly-loaded style, so it runs
 * both on first `load` and after each `setStyle` basemap swap (which wipes all
 * custom sources and layers). Interaction handlers are *not* attached here — they
 * live on the map object and survive a style swap, so they're bound once.
 */
function addSourcesAndLayers(map: mapboxgl.Map, p: MapViewProps) {
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

  map.addLayer({
    id: LYR.forestFill,
    type: "fill",
    source: SRC.forest,
    paint: { "fill-color": "#16a34a", "fill-opacity": 0.14 },
  });
  map.addLayer({
    id: LYR.forestLine,
    type: "line",
    source: SRC.forest,
    paint: { "line-color": "#15803d", "line-opacity": 0.45, "line-width": 0.6 },
  });
  map.addLayer({
    id: LYR.zonesFill,
    type: "fill",
    source: SRC.zones,
    // Painted per parcel from the URA palette (keyed on `lu_desc`); shown
    // only in land-use mode via syncZones. Sits below the threatened fill so
    // each patch still paints on top of its surrounding parcel.
    paint: {
      "fill-color": landUseFillExpression("lu_desc") as never,
      "fill-opacity": 0.28,
    },
  });
  map.addLayer({
    id: LYR.zonesLine,
    type: "line",
    source: SRC.zones,
    paint: {
      "line-color": "#2563eb",
      "line-opacity": 0.7,
      "line-width": 1,
      "line-dasharray": [2, 1.5],
    },
  });
  map.addLayer({
    id: LYR.threatFill,
    type: "fill",
    source: SRC.threatened,
    paint: {
      "fill-color": STATUS_FILL_COLOR as never,
      "fill-opacity": STATUS_FILL_OPACITY as never,
    },
  });
  map.addLayer({
    id: LYR.threatLine,
    type: "line",
    source: SRC.threatened,
    paint: {
      "line-color": STATUS_LINE_COLOR as never,
      "line-width": ["case", SELECTED, 2.5, 0.7] as never,
    },
  });

  // Apply current filter / selection / visibility / colour now that layers exist.
  const filter = threatenedFilter(p.filteredIds);
  map.setFilter(LYR.threatFill, filter);
  map.setFilter(LYR.threatLine, filter);
  applyVisibility(map, p.layers);
  applyColorMode(map, p.colorMode);
  syncZones(map, p.layers, p.colorMode);
  if (p.selectedId !== null) {
    map.setFeatureState({ source: SRC.threatened, id: p.selectedId }, { selected: true });
  }
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
      config: { basemap: STANDARD_BASEMAP_CONFIG },
      ...CAMERA,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

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
      addSourcesAndLayers(map, p);
      selectedRef.current = p.selectedId;
      readyRef.current = true;

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
        } | null;
        const label = escapeHtml(pr?.label ?? "Forest patch");
        const area = typeof pr?.area_ha === "number" ? formatHa(pr.area_ha) : "";
        const lu = pr?.dominant_lu_desc;
        const luRow = lu
          ? `<div class="deforest-popup__lu"><span class="deforest-popup__swatch" style="background:${colorForLandUse(lu)}"></span>${escapeHtml(lu)}</div>`
          : "";
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="deforest-popup__body"><div class="deforest-popup__title">${label}</div>` +
              (area ? `<div class="deforest-popup__meta">${area} under threat</div>` : "") +
              luRow +
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

      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: [LYR.threatFill] });
        propsRef.current.onSelect(hits.length ? Number(hits[0].id) : null);
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

  // --- filter ------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const filter = threatenedFilter(props.filteredIds);
    map.setFilter(LYR.threatFill, filter);
    map.setFilter(LYR.threatLine, filter);
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
      const feature = props.threatened?.features.find(
        (f) => f.properties.id === props.selectedId,
      );
      if (feature) {
        map.flyTo({
          center: [feature.properties.centroid_lon, feature.properties.centroid_lat],
          zoom: Math.max(map.getZoom(), 13.5),
          duration: 900,
          essential: true,
        });
      }
    }
    selectedRef.current = props.selectedId;
  }, [props.selectedId, props.threatened]);

  // --- visibility --------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyVisibility(map, props.layers);
    syncZones(map, props.layers, props.colorMode);
  }, [props.layers, props.colorMode]);

  // --- colour mode -------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyColorMode(map, props.colorMode);
    syncZones(map, props.layers, props.colorMode);
  }, [props.colorMode, props.layers]);

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
      // Standard basemap treatment. The Satellite raster style has no `basemap`
      // import to configure, so it's skipped there.
      if (basemap === "standard") {
        map.setConfig("basemap", STANDARD_BASEMAP_CONFIG);
      }
      addSourcesAndLayers(map, p);
      selectedRef.current = p.selectedId;
      readyRef.current = true;
    });
  }, [basemap]);

  // Land-use legend rows: the classes present in the threatened set, top N by
  // area then "Other". Only computed (and shown) in land-use mode.
  const landUseSlices = useMemo<LandUseSlice[]>(() => {
    if (props.colorMode !== "landuse" || !props.threatened) return [];
    const agg = aggregateByLandUse(props.threatened.features.map((f) => f.properties));
    return toColoredSlices(agg, LEGEND_MAX_CLASSES);
  }, [props.colorMode, props.threatened]);

  return (
    <div className={cn("relative h-full w-full", props.className)}>
      <div ref={containerRef} className="h-full w-full" />

      {/* Toggles: a single row near the top-right on desktop, kept clear of the
          zoom controls that sit in the corner (sm:right-16 leaves a gap). On
          phones the row sits at the bottom-right (the legend is hidden there, so
          nothing to clear) — raised to bottom-14 to sit above Mapbox's corner
          attribution button. The two toggles share a compact fixed width equally
          (flex-1) so they read as a matched pair. */}
      <div className="absolute right-3 bottom-14 z-10 flex w-[19rem] max-w-[calc(100vw-1.5rem)] items-stretch gap-2 sm:top-3 sm:right-16 sm:bottom-auto sm:w-auto sm:max-w-none sm:items-start">
        <SegmentedControl
          label="Colour by"
          ariaLabel="Colour threatened forest by"
          options={COLOR_MODE_OPTIONS}
          value={props.colorMode}
          onChange={props.onColorModeChange}
          className="flex-1 sm:flex-none"
        />
        <SegmentedControl
          label="Basemap"
          ariaLabel="Basemap style"
          options={BASEMAP_OPTIONS}
          value={basemap}
          onChange={setBasemap}
          className="flex-1 sm:flex-none"
        />
      </div>

      {/* Legend: bottom-left, desktop only. On phones it's hidden — the
          collapsible "forest under threat" card (top-left) carries the same
          land-use key, so the map key would be redundant there and its footprint
          is better given to the toggle row. */}
      <div className="absolute bottom-9 left-3 z-10 hidden sm:block">
        <MapLegend
          layers={props.layers}
          colorMode={props.colorMode}
          landUseSlices={landUseSlices}
        />
      </div>
    </div>
  );
}

const COLOR_MODE_OPTIONS: { key: ColorMode; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "landuse", label: "Land use" },
];

const BASEMAP_OPTIONS: { key: Basemap; label: string }[] = [
  { key: "satellite", label: "Satellite" },
  { key: "standard", label: "Standard" },
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

function applyVisibility(map: mapboxgl.Map, layers: MapLayerVisibility) {
  const v = (on: boolean) => (on ? "visible" : "none");
  map.setLayoutProperty(LYR.forestFill, "visibility", v(layers.forest));
  map.setLayoutProperty(LYR.forestLine, "visibility", v(layers.forest));
  map.setLayoutProperty(LYR.threatFill, "visibility", v(layers.threatened));
  map.setLayoutProperty(LYR.threatLine, "visibility", v(layers.threatened));
  // The zones layer (fill + outline) is handled by syncZones — its fill depends
  // on colour mode as well as visibility.
}

/**
 * Passive legend / map key. In "status" mode it lists the visible layers; in
 * "landuse" mode it keys the URA land-use colours present in the threatened set.
 *
 * Always open on desktop. On phones it collapses to a tappable header so the key
 * is reachable without a tall overlay permanently covering the map (collapsed by
 * default). Positioning is handled by the overlay cluster in MapView.
 */
function MapLegend({
  layers,
  colorMode,
  landUseSlices,
}: {
  layers: MapLayerVisibility;
  colorMode: ColorMode;
  landUseSlices: LandUseSlice[];
}) {
  // Collapsed by default on small screens; the md:* classes force the body open
  // on desktop regardless. MapView is client-only, so reading the viewport in
  // the lazy initializer is safe and correct from first paint.
  const [expanded, setExpanded] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 768px)").matches,
  );

  const rows =
    colorMode === "landuse"
      ? landUseSlices
          .map((slice) => ({
            key: slice.luDesc,
            color: colorForLandUse(slice.luDesc),
            label: slice.luDesc === OTHER_LABEL ? "Other uses" : slice.luDesc,
            ring: true,
          }))
          // Alphabetical so a class is easy to find; the catch-all "Other uses"
          // is always pinned to the bottom regardless of its name.
          .sort((a, b) => {
            const aOther = a.label === "Other uses";
            const bOther = b.label === "Other uses";
            if (aOther !== bOther) return aOther ? 1 : -1;
            return a.label.localeCompare(b.label);
          })
      : MAP_LAYERS.filter((l) => layers[l.key]).map((l) => ({
          key: l.key,
          color: l.swatch,
          label: l.label,
          ring: false,
        }));

  if (rows.length === 0) return null;

  const title = colorMode === "landuse" ? "Intended land use" : "Map key";

  return (
    <div className="pointer-events-none max-w-[13rem] overflow-hidden rounded-lg border border-border/60 bg-card/85 text-xs shadow-sm backdrop-blur">
      {/* Mobile-only collapse toggle (hidden on desktop, where the key is always open). */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="pointer-events-auto flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/40 md:hidden"
      >
        <Layers className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">{title}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "px-3 pb-2",
          expanded ? "block border-t border-border/60 pt-2" : "hidden",
          "md:block md:border-t-0 md:pt-2",
        )}
      >
        {colorMode === "landuse" && (
          <p className="mb-1.5 hidden font-medium text-muted-foreground md:block">
            Intended land use
          </p>
        )}
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "inline-block size-2.5 shrink-0 rounded-sm",
                  row.ring && "ring-1 ring-border",
                )}
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate text-foreground">{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
