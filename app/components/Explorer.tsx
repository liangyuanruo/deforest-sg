"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, TreePine } from "lucide-react";

import { AboutModal, GitHubLink } from "@/components/AboutModal";
import { FilterPanel } from "@/components/FilterPanel";
import { HeaderMenu } from "@/components/HeaderMenu";
import { MobileSheet, type SheetSnap } from "@/components/MobileSheet";
import { SearchBox } from "@/components/SearchBox";
import { ShareButton } from "@/components/ShareButton";
import { SiteDetail, SiteDetailBody, SiteSheetPeek } from "@/components/SiteDetail";
import { StatsBreakdown, StatsHeadline, StatsPanel } from "@/components/StatsPanel";
import { ThemeToggle, useTheme } from "@/components/ThemeToggle";
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
import { forestPath } from "@/lib/share";
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

export interface ExplorerProps {
  /** Forest to preselect on load, from a `/forest/<id>` deep link. The map
   *  flies to it once data loads; the selection then keeps the address bar in
   *  sync as the user browses. */
  initialSelectedId?: number | null;
}

export function Explorer({ initialSelectedId = null }: ExplorerProps = {}) {
  const [threatened, setThreatened] = useState<ThreatenedFeatureCollection | null>(null);
  const [forest, setForest] = useState<ForestFeatureCollection | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [zones, setZones] = useState<DevelopmentZoneFeatureCollection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedLandUses, setSelectedLandUses] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId);
  const [layers, setLayers] = useState<MapLayerVisibility>({
    forest: false,
    threatened: true,
    zones: false,
  });
  const [colorMode, setColorMode] = useState<ColorMode>("status");
  // Drives the Street basemap's day/night treatment; tracks the app theme so the
  // map follows the sun/moon toggle without its own control.
  const { theme } = useTheme();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // A deep link (`/forest/<id>`) lands with the sheet already raised to half so
  // its patch is framed above it; a plain visit opens at the stats peek.
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>(
    initialSelectedId != null ? "half" : "peek",
  );
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

  const handleSelect = useCallback((id: number | null) => {
    setSelectedId(id);
    // On phones, opening a forest raises the detail sheet to its half snap (so
    // the patch stays visible above it); closing drops it back to the stats
    // peek. Inert on desktop, where the sheet is hidden.
    setSheetSnap(id === null ? "peek" : "half");
  }, []);

  // Mirror the selection into the address bar so any forest is deep-linkable by
  // copying the URL. `replaceState` (not the Next router) keeps this a
  // client-only path swap — no navigation, no data refetch, no remount — and
  // drops any inbound `?utm_*` once analytics has recorded it. Works for both
  // entry routes (`/` and `/forest/<id>`) since they render this same tree.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = forestPath(selectedId);
    if (window.location.pathname + window.location.search !== path) {
      window.history.replaceState(null, "", path);
    }
  }, [selectedId]);

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
          {/* The brand mark "falls over" on load, then rests on its side —
              a small visual pun on deforestation. See .deforest-logo in
              globals.css (pivots at the trunk base; honours reduced-motion). */}
          <TreePine className="deforest-logo size-5 text-primary" />
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
          {/* Share stays visible on every breakpoint — it's a primary action —
              and shares the selected forest when one is open, else the app.
              Desktop: the remaining secondary actions inline. Mobile: same
              actions folded into the hamburger (both sets breakpoint-exclusive). */}
          <ShareButton site={selectedSite} />
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
              theme={theme}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-muted" />
          )}

          {/* Desktop: floating top-left panel — site detail when one is
              selected, else the compact stats overlay. Only one is ever visible.
              Hidden on phones, where the bottom sheet below takes over. */}
          {ready && (
            <div className="absolute top-3 left-3 z-10 hidden sm:block">
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

          {/* Phones: a draggable, non-modal bottom sheet (Google-Maps style).
              Its peek line stays visible over the map; drag it up for detail.
              The map stays interactive above it. Hidden on desktop (sm:hidden
              lives inside MobileSheet). Same content as the desktop panel. */}
          {ready && (
            <MobileSheet
              snap={sheetSnap}
              onSnapChange={setSheetSnap}
              peek={
                selectedSite ? (
                  <SiteSheetPeek
                    site={selectedSite}
                    onClose={() => handleSelect(null)}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <StatsHeadline
                      sites={landUseFilteredSites}
                      totalForestHa={totalForestHa}
                    />
                  </div>
                )
              }
            >
              {selectedSite ? (
                <SiteDetailBody site={selectedSite} showFootballFields={false} />
              ) : (
                <StatsBreakdown
                  sites={landUseFilteredSites}
                  totalForestHa={totalForestHa}
                  colorMode={colorMode}
                  hideFigures
                  hideStatusKey
                />
              )}
            </MobileSheet>
          )}
        </div>
      )}
    </div>
  );
}
