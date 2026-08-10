"use client";

import { useMemo } from "react";
import { Layers, MapPin, Percent, TreePine } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatHa, formatNumber, formatPercent } from "@/lib/format";
import type { ThreatenedProperties } from "@/lib/schema";
import { cn } from "@/lib/utils";

export interface StatsBarProps {
  /** Filtered live set of threatened sites. */
  sites: ThreatenedProperties[];
  /** summary.totals.total_forest_ha_sg — denominator for "% of mapped forest". */
  totalForestHa: number;
  className?: string;
}

export interface LandUseBarProps {
  /** Filtered live set of threatened sites. */
  sites: ThreatenedProperties[];
  className?: string;
}

interface LandUseSlice {
  luDesc: string;
  areaHa: number;
}

/**
 * Colors follow the land-use CLASS, never its rank, so a filter that
 * changes the underlying set never repaints survivors.
 */
const LAND_USE_COLOR: Record<string, string> = {
  "RESERVE SITE": "var(--series-1)",
  RESIDENTIAL: "var(--series-2)",
  "SPECIAL USE": "var(--series-3)",
  "BUSINESS 2": "var(--series-4)",
  ROAD: "var(--series-5)",
  "EDUCATIONAL INSTITUTION": "var(--series-6)",
  UTILITY: "var(--series-7)",
};

const OTHER_COLOR = "var(--series-other)";
const OTHER_LABEL = "Other";

function aggregateByLandUse(sites: ThreatenedProperties[]): LandUseSlice[] {
  const totals = new Map<string, number>();
  for (const site of sites) {
    totals.set(
      site.dominant_lu_desc,
      (totals.get(site.dominant_lu_desc) ?? 0) + site.area_ha,
    );
  }
  return Array.from(totals.entries())
    .map(([luDesc, areaHa]) => ({ luDesc, areaHa }))
    .sort((a, b) => b.areaHa - a.areaHa);
}

/** Groups any class outside LAND_USE_COLOR into a single trailing "Other" slice. */
function toColoredSlices(byLandUse: LandUseSlice[]): LandUseSlice[] {
  const known: LandUseSlice[] = [];
  let otherHa = 0;
  for (const slice of byLandUse) {
    if (slice.luDesc in LAND_USE_COLOR) {
      known.push(slice);
    } else {
      otherHa += slice.areaHa;
    }
  }
  known.sort((a, b) => b.areaHa - a.areaHa);
  if (otherHa > 0) {
    known.push({ luDesc: OTHER_LABEL, areaHa: otherHa });
  }
  return known;
}

export function StatsBar({ sites, totalForestHa, className }: StatsBarProps) {
  const { threatenedHa, siteCount, fractionOfMappedForest, topLandUse } =
    useMemo(() => {
      const threatenedHa = sites.reduce((sum, s) => sum + s.area_ha, 0);
      const siteCount = sites.length;
      const fractionOfMappedForest =
        totalForestHa > 0 ? threatenedHa / totalForestHa : 0;
      const byLandUse = aggregateByLandUse(sites);
      const topLandUse = byLandUse[0] ?? null;
      return { threatenedHa, siteCount, fractionOfMappedForest, topLandUse };
    }, [sites, totalForestHa]);

  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}
    >
      <StatTile
        icon={TreePine}
        value={formatHa(threatenedHa)}
        label="Forest under threat"
      />
      <StatTile
        icon={Percent}
        value={formatPercent(fractionOfMappedForest)}
        label="of mapped forest"
        sublabel="zoned for development"
      />
      <StatTile
        icon={MapPin}
        value={formatNumber(siteCount)}
        label="Sites"
        sublabel="affected patches"
      />
      <StatTile
        icon={Layers}
        value={topLandUse ? topLandUse.luDesc : "—"}
        label="Top land use"
        sublabel={topLandUse ? formatHa(topLandUse.areaHa) : ""}
        valueClassName="truncate text-lg sm:text-xl"
      />
    </div>
  );
}

interface StatTileProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  sublabel?: string;
  valueClassName?: string;
}

function StatTile({
  icon: Icon,
  value,
  label,
  sublabel,
  valueClassName,
}: StatTileProps) {
  return (
    <Card className="gap-1 border border-border px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "tabular-nums text-2xl font-semibold text-foreground",
          valueClassName,
        )}
        title={value}
      >
        {value}
      </div>
      {sublabel !== undefined && sublabel !== "" && (
        <div className="text-xs text-muted-foreground">{sublabel}</div>
      )}
    </Card>
  );
}

export function LandUseBar({ sites, className }: LandUseBarProps) {
  const { threatenedHa, slices } = useMemo(() => {
    const threatenedHa = sites.reduce((sum, s) => sum + s.area_ha, 0);
    const byLandUse = aggregateByLandUse(sites);
    const slices = toColoredSlices(byLandUse);
    return { threatenedHa, slices };
  }, [sites]);

  if (sites.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-xs font-medium text-muted-foreground">
          Threatened area by intended land use
        </p>
        <p className="text-sm text-muted-foreground">No sites selected</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        Threatened area by intended land use
      </p>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {slices.map((slice) => {
          const color = LAND_USE_COLOR[slice.luDesc] ?? OTHER_COLOR;
          const widthPct =
            threatenedHa > 0 ? (slice.areaHa / threatenedHa) * 100 : 0;
          return (
            <span
              key={slice.luDesc}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${widthPct}%`, backgroundColor: color }}
              title={`${slice.luDesc}: ${formatHa(slice.areaHa)}`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((slice) => {
          const color = LAND_USE_COLOR[slice.luDesc] ?? OTHER_COLOR;
          const share = threatenedHa > 0 ? slice.areaHa / threatenedHa : 0;
          return (
            <li
              key={slice.luDesc}
              className="flex items-center gap-1.5 text-xs"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="text-foreground">{slice.luDesc}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatHa(slice.areaHa)} ({formatPercent(share)})
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
