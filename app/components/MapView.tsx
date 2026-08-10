"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_STYLE, MAPBOX_TOKEN } from "@/lib/mapbox";
import { formatHa } from "@/lib/format";
import { MAP_LAYERS, type MapLayerVisibility } from "@/lib/layers";
import { cn } from "@/lib/utils";
import type {
  DevelopmentZoneFeatureCollection,
  ForestFeatureCollection,
  ThreatenedFeatureCollection,
} from "@/lib/schema";

export type { MapLayerKey, MapLayerVisibility } from "@/lib/layers";

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
  className?: string;
}

// Singapore, roughly — used to frame the map on first load.
const SG_BOUNDS: [[number, number], [number, number]] = [
  [103.6, 1.15],
  [104.09, 1.48],
];

const SRC = { forest: "forest", threatened: "threatened", zones: "zones" } as const;
const LYR = {
  forestFill: "forest-fill",
  forestLine: "forest-line",
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

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      bounds: SG_BOUNDS,
      fitBoundsOptions: { padding: 48 },
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // mapbox-gl.css forces `.mapboxgl-map { position: relative }`, and the flex/
    // dynamic-import mount can settle the container size after init — keep the
    // canvas in sync with the container.
    const resizeObserver = new ResizeObserver(() => map.resize());
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
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#dc2626",
            "#f59e0b",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.72,
            ["boolean", ["feature-state", "hover"], false],
            0.62,
            0.42,
          ],
        },
      });
      map.addLayer({
        id: LYR.threatLine,
        type: "line",
        source: SRC.threatened,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#991b1b",
            "#b45309",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2.5,
            0.7,
          ],
        },
      });

      readyRef.current = true;

      // Apply current filter / selection / visibility now that layers exist.
      const filter = threatenedFilter(p.filteredIds);
      map.setFilter(LYR.threatFill, filter);
      map.setFilter(LYR.threatLine, filter);
      applyVisibility(map, p.layers);
      if (p.selectedId !== null) {
        map.setFeatureState({ source: SRC.threatened, id: p.selectedId }, { selected: true });
        selectedRef.current = p.selectedId;
      }

      // --- interaction ---
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

        const pr = feature.properties as { label?: string; area_ha?: number } | null;
        const label = escapeHtml(pr?.label ?? "Forest patch");
        const area = typeof pr?.area_ha === "number" ? formatHa(pr.area_ha) : "";
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="deforest-popup__body"><div class="deforest-popup__title">${label}</div>` +
              (area ? `<div class="deforest-popup__meta">${area} under threat</div>` : "") +
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
  }, [props.layers]);

  return (
    <div className={cn("relative h-full w-full", props.className)}>
      <div ref={containerRef} className="h-full w-full" />
      <MapLegend layers={props.layers} />
    </div>
  );
}

function applyVisibility(map: mapboxgl.Map, layers: MapLayerVisibility) {
  const v = (on: boolean) => (on ? "visible" : "none");
  map.setLayoutProperty(LYR.forestFill, "visibility", v(layers.forest));
  map.setLayoutProperty(LYR.forestLine, "visibility", v(layers.forest));
  map.setLayoutProperty(LYR.threatFill, "visibility", v(layers.threatened));
  map.setLayoutProperty(LYR.threatLine, "visibility", v(layers.threatened));
  map.setLayoutProperty(LYR.zonesLine, "visibility", v(layers.zones));
}

/**
 * Passive legend — a read-only key for the currently visible layers. Toggling
 * lives in the filter modal now, so this only reflects state. Hidden on small
 * screens to keep the map clear; only shows layers that are actually on.
 */
function MapLegend({ layers }: { layers: MapLayerVisibility }) {
  const visible = MAP_LAYERS.filter((l) => layers[l.key]);
  if (visible.length === 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-9 left-3 z-10 hidden rounded-lg border border-border/60 bg-card/85 px-3 py-2 text-xs shadow-sm backdrop-blur md:block">
      <ul className="space-y-1">
        {visible.map(({ key, label, swatch }) => (
          <li key={key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: swatch }}
            />
            <span className="text-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
