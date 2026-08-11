"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, TreePine } from "lucide-react";

import { AboutModal, GitHubLink } from "@/components/AboutModal";
import { FilterPanel } from "@/components/FilterPanel";
import { HeaderMenu } from "@/components/HeaderMenu";
import { SearchBox } from "@/components/SearchBox";
import { SiteDetail } from "@/components/SiteDetail";
import { StatsPanel } from "@/components/StatsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchDevelopmentZones,
  fetchForestAll,
  fetchSummary,
  fetchThreatened,
} from "@/lib/data";
import { filterAndSortSites, landUseOptions } from "@/lib/scoring";
import type { ColorMode, MapLayerKey, MapLayerVisibility } from "@/lib/layers";
import type {
  DevelopmentZoneFeatureCollection,
  ForestFeatureCollection,
  Summary,
  ThreatenedFeatureCollection,
  ThreatenedProperties,
} from "@/lib/schema";

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
  const [selectedLandUses, setSelectedLandUses] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [layers, setLayers] = useState<MapLayerVisibility>({
    forest: false,
    threatened: true,
    zones: false,
  });
  const [colorMode, setColorMode] = useState<ColorMode>("status");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
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

  // The land-use filter drives what the map shows and what the stats count.
  // Search is autocomplete (it selects a single site), so it does NOT narrow
  // this set — the map stays whole while you look something up.
  const landUseFilteredSites = useMemo(
    () =>
      filterAndSortSites(sites, {
        query: "",
        sortMode: "area",
        landUses: selectedLandUses,
      }),
    [sites, selectedLandUses],
  );
  const isFiltering = selectedLandUses.length > 0;
  const filteredIds = useMemo(
    () => (isFiltering ? landUseFilteredSites.map((s) => s.id) : null),
    [isFiltering, landUseFilteredSites],
  );
  const totalForestHa = summary?.totals.total_forest_ha_sg ?? 0;

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedId) ?? null,
    [sites, selectedId],
  );

  const handleToggleLandUse = useCallback((luDesc: string) => {
    setSelectedLandUses((prev) =>
      prev.includes(luDesc) ? prev.filter((x) => x !== luDesc) : [...prev, luDesc],
    );
  }, []);
  const handleClearLandUses = useCallback(() => setSelectedLandUses([]), []);

  const handleSelect = useCallback((id: number | null) => setSelectedId(id), []);

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

  const ready = threatened !== null && forest !== null && summary !== null;

  const filterProps = {
    landUseOptions: options,
    selectedLandUses,
    onToggleLandUse: handleToggleLandUse,
    onClearLandUses: handleClearLandUses,
    layers,
    onToggleLayer: handleToggleLayer,
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Three-zone header on desktop (logo | search | actions); a single
          compact row on mobile. The filter trigger lives inside the search box
          itself (SearchBox), so there's no separate filter slot in the bar. */}
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:gap-3 sm:px-4">
        <div className="flex shrink-0 items-center gap-2 sm:flex-1">
          <TreePine className="size-5 text-primary" />
          <h1 className="hidden text-sm font-semibold sm:block">Deforest SG</h1>
        </div>

        <div className="flex min-w-0 flex-1 items-center sm:flex-none">
          <div className="min-w-0 flex-1 sm:w-[34rem] sm:flex-none">
            {ready ? (
              <SearchBox
                sites={landUseFilteredSites}
                query={query}
                onQueryChange={setQuery}
                onSelectSite={handleSelect}
                filterActiveCount={selectedLandUses.length}
                onOpenFilter={() => setFilterOpen(true)}
              />
            ) : (
              <Skeleton className="h-9 w-full" />
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:flex-1 sm:justify-end">
          {/* Desktop: the secondary actions inline. Mobile: same actions folded
              into the hamburger (both sets are breakpoint-exclusive). */}
          <ThemeToggle className="hidden sm:inline-flex" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="About this project"
                  onClick={() => setAboutOpen(true)}
                  className="hidden sm:inline-flex"
                >
                  <Info />
                </Button>
              }
            />
            <TooltipContent>About this project</TooltipContent>
          </Tooltip>
          <GitHubLink className="hidden sm:inline-flex" />
          <HeaderMenu className="sm:hidden" onOpenAbout={() => setAboutOpen(true)} />
        </div>
      </header>

      {/* Both controlled by the header actions above; neither renders a trigger.
          The filter's trigger lives inside the search box (SearchBox). */}
      {ready && (
        <FilterPanel
          open={filterOpen}
          onOpenChange={setFilterOpen}
          {...filterProps}
        />
      )}
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />

      {loadError ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-sm">
            <p className="font-semibold">Couldn&rsquo;t load the map data</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          {ready ? (
            <MapView
              forest={forest}
              threatened={threatened}
              developmentZones={zones}
              filteredIds={filteredIds}
              selectedId={selectedId}
              onSelect={handleSelect}
              layers={layers}
              colorMode={colorMode}
              onColorModeChange={setColorMode}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-muted" />
          )}

          {/* Floating top-left panel: site detail when one is selected, else
              the compact stats overlay. Only one is ever visible. */}
          {ready && (
            <div className="absolute top-3 left-3 z-10">
              {selectedSite ? (
                <SiteDetail
                  site={selectedSite}
                  onClose={() => handleSelect(null)}
                />
              ) : (
                <StatsPanel
                  sites={landUseFilteredSites}
                  totalForestHa={totalForestHa}
                  colorMode={colorMode}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
