"use client";

import { useMemo, useState } from "react";
import { ChevronDown, TreePine } from "lucide-react";

import { formatHa, formatNumber, formatPercent } from "@/lib/format";
import {
  aggregateByLandUse,
  colorForLandUse,
  toColoredSlices,
} from "@/lib/landuse";
import type { ThreatenedProperties } from "@/lib/schema";
import { cn } from "@/lib/utils";

export interface StatsPanelProps {
  /** Filtered live set of threatened sites. */
  sites: ThreatenedProperties[];
  /** summary.totals.total_forest_ha_sg — denominator for "% of mapped forest". */
  totalForestHa: number;
  className?: string;
}

/**
 * Compact, left-aligned stats overlay. Headline is always visible; the
 * breakdown collapses (default collapsed on small screens) so it never eats
 * the map on a phone.
 */
export function StatsPanel({ sites, totalForestHa, className }: StatsPanelProps) {
  // Collapsed by default on small screens so the breakdown never covers the
  // map on a phone. This panel only mounts client-side (Explorer renders it
  // once data is ready, i.e. never during SSR), so reading the viewport in the
  // lazy initializer is safe and correct from the first paint.
  const [expanded, setExpanded] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 768px)").matches,
  );

  const { threatenedHa, siteCount, fraction, slices } = useMemo(() => {
    const threatenedHa = sites.reduce((sum, s) => sum + s.area_ha, 0);
    const fraction = totalForestHa > 0 ? threatenedHa / totalForestHa : 0;
    const slices = toColoredSlices(aggregateByLandUse(sites), 6);
    return { threatenedHa, siteCount: sites.length, fraction, slices };
  }, [sites, totalForestHa]);

  return (
    <div
      className={cn(
        "w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border/60 bg-card/90 shadow-sm backdrop-blur",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
      >
        <TreePine className="size-4 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-base font-semibold tabular-nums text-foreground">
            {formatHa(threatenedHa)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            forest under threat
          </span>
        </span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-2.5 border-t border-border/60 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Figure value={formatPercent(fraction)} label="of mapped forest" />
            <Figure value={formatNumber(siteCount)} label="sites" />
          </div>

          {threatenedHa > 0 && slices.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                By intended land use
              </p>
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
      )}
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
