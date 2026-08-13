"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Info, TreePine } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatFootballFields,
  formatHa,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  aggregateByLandUse,
  colorForLandUse,
  descriptionForLandUse,
  toColoredSlices,
} from "@/lib/landuse";
import { MAP_LAYERS, type ColorMode } from "@/lib/layers";
import type { ThreatenedProperties } from "@/lib/schema";
import { cn } from "@/lib/utils";

/**
 * The map-key rows' identities (swatch + label), reused from MAP_LAYERS so the key
 * and the map legend can't drift. Both non-null: fixed members of MAP_LAYERS. The
 * "Deforested" scar is theme-flipped on the map (near-white / dark grey); its
 * MAP_LAYERS swatch is the neutral mid-grey both the filter legend and this key use.
 */
const THREATENED_KEY = MAP_LAYERS.find((l) => l.key === "threatened")!;
const LOST_KEY = MAP_LAYERS.find((l) => l.key === "lost")!;

export interface StatsPanelProps {
  /** Filtered live set of threatened sites. */
  sites: ThreatenedProperties[];
  /** summary.totals.total_forest_ha_sg — denominator for "% of mapped forest". */
  totalForestHa: number;
  /**
   * How the threatened layer is coloured on the map. In "status" mode every patch
   * is the alarm red, so the panel shows the map key ("Vulnerable forest" red +
   * "Deforested" grey); in "landuse" mode both layers take their zoning colours,
   * which the breakdown below already keys, so the key is omitted.
   */
  colorMode: ColorMode;
  className?: string;
}

/**
 * Compact, left-aligned stats overlay. Headline is always visible; the
 * breakdown collapses (default collapsed on small screens) so it never eats
 * the map on a phone.
 */
/** Shared aggregation so the headline and the breakdown (and the desktop card
 *  and mobile sheet that host them) all read the same numbers. */
function useStatsAgg(sites: ThreatenedProperties[], totalForestHa: number) {
  return useMemo(() => {
    const threatenedHa = sites.reduce((sum, s) => sum + s.area_ha, 0);
    const fraction = totalForestHa > 0 ? threatenedHa / totalForestHa : 0;
    const slices = toColoredSlices(aggregateByLandUse(sites), 6);
    return { threatenedHa, siteCount: sites.length, fraction, slices };
  }, [sites, totalForestHa]);
}

export function StatsPanel({
  sites,
  totalForestHa,
  colorMode,
  className,
}: StatsPanelProps) {
  // Collapsed by default on small screens so the breakdown never covers the
  // map on a phone. This panel only mounts client-side (Explorer renders it
  // once data is ready, i.e. never during SSR), so reading the viewport in the
  // lazy initializer is safe and correct from the first paint.
  const [expanded, setExpanded] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 768px)").matches,
  );

  return (
    <div
      className={cn(
        "w-60 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border/60 bg-card/90 shadow-sm backdrop-blur",
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
          <StatsBreakdown
            sites={sites}
            totalForestHa={totalForestHa}
            colorMode={colorMode}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The always-visible headline: total hectares under threat, in words + football
 * fields. Presentational (no button/chevron) so it can sit inside the desktop
 * card's toggle button or the mobile sheet's peek header alike.
 *
 * Pass `totalForestHa` to also show the "% of mapped forest" and "sites" figures
 * inline on the right — used by the mobile sheet's peek so those numbers stay
 * visible even when the sheet is dragged down (the desktop card omits it, keeping
 * those figures in its expandable breakdown instead).
 */
export function StatsHeadline({
  sites,
  totalForestHa,
}: {
  sites: ThreatenedProperties[];
  totalForestHa?: number;
}) {
  const threatenedHa = sites.reduce((sum, s) => sum + s.area_ha, 0);
  const fraction =
    totalForestHa && totalForestHa > 0 ? threatenedHa / totalForestHa : 0;
  const headline = (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="text-base font-semibold tabular-nums text-foreground">
        {formatHa(threatenedHa)}
      </span>
      <span className="text-[11px] text-muted-foreground">
        of vulnerable forests
      </span>
      <span className="text-[11px] text-muted-foreground/80">
        {formatFootballFields(threatenedHa)}
      </span>
    </span>
  );
  return (
    <>
      <TreePine className="size-4 shrink-0 text-primary" />
      {totalForestHa === undefined ? (
        headline
      ) : (
        // Mobile peek: the headline and the two figures split the row into equal
        // thirds so nothing hugs the right edge with a gap in the middle.
        <div className="grid flex-1 grid-cols-3 items-center gap-2">
          {headline}
          <Figure value={formatPercent(fraction)} label="of mapped forest" />
          <Figure value={formatNumber(sites.length)} label="sites" />
        </div>
      )}
    </>
  );
}

/**
 * The expanded breakdown: headline share + site count, the map key, and the
 * per-land-use split. No card chrome — the desktop card and the mobile sheet
 * each supply their own container.
 */
export function StatsBreakdown({
  sites,
  totalForestHa,
  colorMode,
  hideFigures = false,
  hideStatusKey = false,
}: Omit<StatsPanelProps, "className"> & {
  /** Suppress the "% of mapped forest" / "sites" figures — set by the mobile
   *  sheet, whose peek headline already shows them, to avoid repeating them. */
  hideFigures?: boolean;
  /** Suppress the map-key rows (vulnerable-forest red + deforested grey) — set by
   *  the mobile sheet. They appear only in "status" mode, so toggling colour mode
   *  would change the sheet's content height and make the draggable sheet
   *  re-measure and re-animate (a visible flicker). Omitting them keeps the sheet
   *  height stable across the toggle; the peek headline already conveys the layers. */
  hideStatusKey?: boolean;
}) {
  const { threatenedHa, siteCount, fraction, slices } = useStatsAgg(
    sites,
    totalForestHa,
  );

  return (
    <div className="flex flex-col gap-2.5">
      {!hideFigures && (
        <div className="grid grid-cols-2 gap-2">
          <Figure value={formatPercent(fraction)} label="of mapped forest" />
          <Figure value={formatNumber(siteCount)} label="sites" />
        </div>
      )}

          {/* Map key. In "status" mode the threatened patches are the alarm red and
              the already-cleared scars the neutral grey, so these rows say what each
              colour on the map means. Omitted in "landuse" mode, where both layers
              take the zoning colours the breakdown below already keys. Sits in its
              own bordered zone (square swatches, unlike the breakdown's round dots)
              so it doesn't read as a breakdown item. */}
          {colorMode === "status" && !hideStatusKey && (
            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5 text-[11px]">
              <MapKeyRow swatch={THREATENED_KEY.swatch} label={THREATENED_KEY.label} />
              <MapKeyRow swatch={LOST_KEY.swatch} label={LOST_KEY.label} />
            </div>
          )}

          {threatenedHa > 0 && slices.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
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
                    held for future development. Hover a patch on the map, or
                    select one, to see what it&rsquo;s zoned for.
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
                      <span className="text-muted-foreground/60">
                        {" · "}
                        {formatPercent(slice.areaHa / threatenedHa)}
                      </span>
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

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
