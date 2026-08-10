"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, TreePine } from "lucide-react";

import { AboutModal, GitHubLink } from "@/components/AboutModal";
import { LandUseBar, StatsBar } from "@/components/StatsBar";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchDevelopmentZones,
  fetchForestAll,
  fetchSummary,
  fetchThreatened,
} from "@/lib/data";
import { filterAndSortSites, landUseOptions, type SortMode } from "@/lib/scoring";
import type {
  DevelopmentZoneFeatureCollection,
  ForestFeatureCollection,
  Summary,
  ThreatenedFeatureCollection,
  ThreatenedProperties,
} from "@/lib/schema";
import type { MapLayerKey, MapLayerVisibility } from "@/components/MapView";

// The map uses WebGL / window, so it must never render on the server.
const MapView = dynamic(
  () => import("@/components/MapView").then((m) => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);

export function Explorer() {
  const [threatened, setThreatened] = useState<ThreatenedFeatureCollection | null>(null);
  const [forest, setForest] = useState<ForestFeatureCollection | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [zones, setZones] = useState<DevelopmentZoneFeatureCollection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [selectedLandUses, setSelectedLandUses] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [layers, setLayers] = useState<MapLayerVisibility>({
    forest: true,
    threatened: true,
    zones: false,
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const zonesRequestedRef = useRef(false);

  // Load the two core layers + summary once on mount (setState runs after the
  // await, so this is not the synchronous set-state-in-effect anti-pattern).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [t, f, s] = await Promise.all([
          fetchThreatened(),
          fetchForestAll(),
          fetchSummary(),
        ]);
        if (!active) return;
        setThreatened(t);
        setForest(f);
        setSummary(s);
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : "Failed to load data");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const sites = useMemo<ThreatenedProperties[]>(
    () => threatened?.features.map((f) => f.properties) ?? [],
    [threatened],
  );
  const options = useMemo(() => landUseOptions(sites), [sites]);
  const filteredSites = useMemo(
    () => filterAndSortSites(sites, { query, sortMode, landUses: selectedLandUses }),
    [sites, query, sortMode, selectedLandUses],
  );
  const isFiltering = query.trim() !== "" || selectedLandUses.length > 0;
  const filteredIds = useMemo(
    () => (isFiltering ? filteredSites.map((s) => s.id) : null),
    [isFiltering, filteredSites],
  );
  const totalForestHa = summary?.totals.total_forest_ha_sg ?? 0;

  const handleToggleLandUse = useCallback((luDesc: string) => {
    setSelectedLandUses((prev) =>
      prev.includes(luDesc) ? prev.filter((x) => x !== luDesc) : [...prev, luDesc],
    );
  }, []);
  const handleClearLandUses = useCallback(() => setSelectedLandUses([]), []);

  const handleSelect = useCallback((id: number | null) => {
    setSelectedId(id);
    if (id !== null) setMobileSidebarOpen(false);
  }, []);

  const handleToggleLayer = useCallback((layer: MapLayerKey) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
    // Lazy-load the heavy development-zones layer only when first enabled.
    if (layer === "zones" && !zonesRequestedRef.current) {
      zonesRequestedRef.current = true;
      fetchDevelopmentZones()
        .then(setZones)
        .catch(() => {
          zonesRequestedRef.current = false;
        });
    }
  }, []);

  const sidebarProps = {
    sites: filteredSites,
    totalCount: sites.length,
    query,
    onQueryChange: setQuery,
    sortMode,
    onSortModeChange: setSortMode,
    landUseOptions: options,
    selectedLandUses,
    onToggleLandUse: handleToggleLandUse,
    onClearLandUses: handleClearLandUses,
    selectedId,
    onSelect: handleSelect,
  };

  const ready = threatened !== null && forest !== null && summary !== null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open the site list"
        >
          <Menu />
        </Button>
        <div className="flex items-center gap-2">
          <TreePine className="size-5 text-primary" />
          <div className="leading-tight">
            <h1 className="text-sm font-semibold">Deforest SG</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Forest under the Master Plan 2025
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <AboutModal />
          <GitHubLink />
        </div>
      </header>

      {loadError ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-sm">
            <p className="font-semibold">Couldn&rsquo;t load the map data</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-border p-3">
            {ready ? (
              <StatsBar sites={filteredSites} totalForestHa={totalForestHa} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[76px]" />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 overflow-hidden">
            {ready && (
              <Sidebar
                {...sidebarProps}
                className="hidden w-80 shrink-0 md:flex"
              />
            )}

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="relative flex-1">
                {ready ? (
                  <MapView
                    forest={forest}
                    threatened={threatened}
                    developmentZones={zones}
                    filteredIds={filteredIds}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    layers={layers}
                    onToggleLayer={handleToggleLayer}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" />
                )}
              </div>
              {ready && (
                <div className="hidden border-t border-border p-3 sm:block">
                  <LandUseBar sites={filteredSites} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile: the sidebar lives in a slide-out drawer. */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
          <SheetTitle className="sr-only">Threatened forest sites</SheetTitle>
          {ready && <Sidebar {...sidebarProps} className="h-full border-r-0" />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
