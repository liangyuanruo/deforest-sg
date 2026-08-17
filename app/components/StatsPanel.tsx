"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Info, TreePine } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatFootballFields, formatHa } from "@/lib/format";
import {
  aggregateByLandUse,
  colorForLandUse,
  descriptionForLandUse,
  toColoredSlices,
} from "@/lib/landuse";
import { MAP_LAYERS, swatchForLayer, type ColorMode } from "@/lib/layers";
import type { Theme } from "@/components/ThemeToggle";
import type { ThreatenedProperties } from "@/lib/schema";
import { cn } from "@/lib/utils";

/**
 * Map-key rows' identities (swatch + label), reused from MAP_LAYERS so the key
 * and the map legend can't drift. Both non-null: fixed members of MAP_LAYERS.
 */
const THREATENED_KEY = MAP_LAYERS.find((l) => l.key === "threatened")!;
const LOST_KEY = MAP_LAYERS.find((l) => l.key === "lost")!;

export interface StatsPanelProps {
  /** Filtered live set of threatened sites. */
  sites: ThreatenedProperties[];
  /** Threatened-layer colour mode. "status" shows the map key (red/grey); in
   *  "landuse" both layers take zoning colours the breakdown already keys, so
   *  the key is omitted. */
  colorMode: ColorMode;
  /** App theme — the "Deforested" scar is theme-flipped, so the key resolves its
   *  colour per theme (via swatchForLayer) to match the map fill. */
  theme: Theme;
  className?: string;
}

/**
 * Shared aggregation so the headline, breakdown, desktop card, and mobile
 * sheet all read the same numbers.
 *
 * Everything here is an absolute area. Deliberately no share-of-total figure:
 * the only denominator available is mapped forest, which omits nature reserves
 * (Mandai and others), so any percentage of it would be quietly wrong.
 */
function useStatsAgg(sites: ThreatenedProperties[]) {
  return useMemo(() => {
    const threatenedHa = sites.reduce((sum, s) => sum + s.area_ha, 0);
    const slices = toColoredSlices(aggregateByLandUse(sites), 6);
    return { threatenedHa, slices };
  }, [sites]);
}

export function StatsPanel({
  sites,
  colorMode,
  theme,
  className,
}: StatsPanelProps) {
  // Collapsed by default on small screens so the breakdown never covers the map.
  // Only mounts client-side (never during SSR), so reading the viewport in the
  // lazy initializer is safe from the first paint.
  const [expanded, setExpanded] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 768px)").matches,
  );

  return (
    <div
      className={cn(
        "w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border/60 bg-card/90 shadow-sm backdrop-blur",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
      >
        <StatsHeadline sites={sites} />
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-3 py-2.5">
          <StatsBreakdown sites={sites} colorMode={colorMode} theme={theme} />
        </div>
      )}
    </div>
  );
}

/**
 * Always-visible headline: total hectares under threat, in words + football
 * fields. Presentational, so it can sit inside the desktop card's toggle button
 * or the mobile sheet's peek header alike.
 */
export function StatsHeadline({ sites }: { sites: ThreatenedProperties[] }) {
  const threatenedHa = sites.reduce((sum, s) => sum + s.area_ha, 0);
  return (
    <>
      <TreePine className="size-5 shrink-0 text-primary sm:size-4" />
      <span className="flex min-w-0 flex-1 items-end gap-2 sm:flex-col sm:items-start sm:gap-0">
        <span className="shrink-0 whitespace-nowrap text-xl font-semibold leading-none tabular-nums text-foreground sm:text-base sm:leading-tight">
          {formatHa(threatenedHa)}
        </span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1 leading-tight sm:flex-col sm:gap-x-0">
          <span className="text-[11px] text-muted-foreground">
            of vulnerable forests
          </span>
          <span className="text-[11px] text-muted-foreground/80">
            {formatFootballFields(threatenedHa)}
          </span>
        </span>
      </span>
    </>
  );
}

/**
 * The expanded breakdown: the map key and the per-land-use split. No card
 * chrome — the desktop card and the mobile sheet each supply their own
 * container.
 */
export function StatsBreakdown({
  sites,
  colorMode,
  theme,
  hideStatusKey = false,
}: Omit<StatsPanelProps, "className"> & {
  /** Suppress the map-key rows — set by the mobile sheet, where a "status"-only
   *  key would change content height and make the draggable sheet visibly
   *  re-measure/re-animate on colour-mode toggle. */
  hideStatusKey?: boolean;
}) {
  const { threatenedHa, slices } = useStatsAgg(sites);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Map key: what the alarm-red / neutral-grey fills mean in "status" mode.
          Omitted in "landuse" mode (breakdown below already keys those colours).
          Square swatches, unlike the breakdown's round dots. */}
      {colorMode === "status" && !hideStatusKey && (
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5 text-[11px] first:border-t-0 first:pt-0">
          <MapKeyRow
            swatch={swatchForLayer(THREATENED_KEY, theme)}
            label={THREATENED_KEY.label}
          />
          <MapKeyRow
            swatch={swatchForLayer(LOST_KEY, theme)}
            label={LOST_KEY.label}
          />
        </div>
      )}

      {threatenedHa > 0 && slices.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5 first:border-t-0 first:pt-0">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              By URA land zoning
            </p>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="What is URA land zoning?"
                    className="text-muted-foreground/70 hover:text-foreground"
                  >
                    <Info className="size-3" />
                  </button>
                }
              />
              <TooltipContent side="right" className="max-w-[15rem]">
                URA land zoning is the use each site is planned for under the
                Master Plan 2025 — e.g. housing, industry, or a reserve site
                held for future development. Hover a patch on the map, or select
                one, to see what it&rsquo;s zoned for.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
            {slices.map((slice) => (
              <span
                key={slice.luDesc}
                className="h-full ring-1 ring-inset ring-border/70 first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(slice.areaHa / threatenedHa) * 100}%`,
                  backgroundColor: colorForLandUse(slice.luDesc),
                }}
                title={`${slice.luDesc}: ${formatHa(slice.areaHa)}`}
              />
            ))}
          </div>
          <ul className="flex flex-col gap-1">
            {slices.map((slice) => (
              <li
                key={slice.luDesc}
                className="flex items-center gap-1.5 text-[11px]"
                title={descriptionForLandUse(slice.luDesc) ?? slice.luDesc}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: colorForLandUse(slice.luDesc) }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {slice.luDesc}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatHa(slice.areaHa)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One map-key row: a square swatch (matching the map fill) + its layer label. */
function MapKeyRow({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-sm ring-1 ring-border"
        style={{ backgroundColor: swatch }}
      />
      <span className="text-foreground">{label}</span>
    </div>
  );
}
