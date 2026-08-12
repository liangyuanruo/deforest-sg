"use client";

import { Info, Layers, MapPin, Ruler, X } from "lucide-react";

import { ShareButton } from "@/components/ShareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatFootballFields, formatHa, formatPercent } from "@/lib/format";
import {
  describeGprCode,
  formatGprRange,
  GPR_EXPLAINER,
  parseGpr,
} from "@/lib/gpr";
import { colorForLandUse, descriptionForLandUse } from "@/lib/landuse";
import type { ThreatenedProperties } from "@/lib/schema";
import { cn } from "@/lib/utils";

export interface SiteDetailProps {
  site: ThreatenedProperties;
  onClose: () => void;
  className?: string;
}

/**
 * Detail card for the currently selected patch. Occupies the same top-left
 * slot as the stats overlay (Explorer swaps between them), so only one panel
 * is ever on screen.
 */
export function SiteDetail({ site, onClose, className }: SiteDetailProps) {
  const percent = formatPercent(site.threatened_fraction);
  const width = `${Math.min(100, site.threatened_fraction * 100).toFixed(0)}%`;
  const luDescription = descriptionForLandUse(site.dominant_lu_desc);
  const gpr = parseGpr(site.gpr);
  const gprRange = formatGprRange(gpr.ratios);
  const hasGpr = gpr.ratios.length > 0 || gpr.codes.length > 0;

  return (
    <div
      className={cn(
        "flex max-h-[calc(100vh-6rem)] w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-border/60 bg-card/95 shadow-md backdrop-blur",
        className,
      )}
    >
      <div className="flex items-start gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {site.label}
          </h2>
          {site.locality && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              {site.locality}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <ShareButton site={site} size="icon-sm" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close details"
            className="-mr-1"
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Ruler className="size-3.5" />
              Under threat
            </span>
            <Badge variant="secondary" className="tabular-nums">
              {formatHa(site.area_ha)}
            </Badge>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            title={`${percent} of this patch is on development-zoned land`}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {percent} of {formatHa(site.forest_area_ha)} total patch
          </p>
          <p className="text-xs text-muted-foreground/80">
            {formatFootballFields(site.area_ha)}
          </p>
        </div>

        <dl className="flex flex-col gap-2 text-xs">
          <Row
            icon={<Layers className="size-3.5" />}
            label="URA zoning"
            value={site.dominant_lu_desc}
            swatch={colorForLandUse(site.dominant_lu_desc)}
          />
          {luDescription && (
            <p className="-mt-0.5 text-xs leading-snug text-muted-foreground">
              {luDescription}
            </p>
          )}
          {hasGpr && (
            <Row
              label="Plot ratio"
              value={gprRange ?? "—"}
              labelAfter={
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="What is plot ratio?"
                        className="text-muted-foreground/70 hover:text-foreground"
                      >
                        <Info className="size-3" />
                      </button>
                    }
                  />
                  <TooltipContent side="top" className="max-w-[15rem]">
                    {GPR_EXPLAINER}
                  </TooltipContent>
                </Tooltip>
              }
            />
          )}
          {gpr.codes.map((code) => {
            const d = describeGprCode(code);
            return (
              <p
                key={code}
                className="-mt-0.5 text-xs leading-snug text-muted-foreground"
              >
                <span className="font-medium text-foreground">
                  {code}
                  {d ? ` — ${d.label}` : ""}
                </span>
                {d ? <>. {d.description}</> : null}
              </p>
            );
          })}
        </dl>

        {(site.context || site.wildlife || site.status) && (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {site.context && <p>{site.context}</p>}
            {site.wildlife && (
              <p>
                <span className="font-medium text-foreground">Wildlife: </span>
                {site.wildlife}
              </p>
            )}
            {site.status && (
              <p>
                <span className="font-medium text-foreground">Status: </span>
                {site.status}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  labelAfter,
  value,
  swatch,
}: {
  icon?: React.ReactNode;
  label: string;
  /** Optional element after the label text (e.g. an info tooltip trigger). */
  labelAfter?: React.ReactNode;
  value: string;
  /** Optional colour dot shown before the value (e.g. the URA land-use fill). */
  swatch?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
        {labelAfter}
      </dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right font-medium text-foreground">
        {swatch && (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-sm ring-1 ring-border"
            style={{ backgroundColor: swatch }}
          />
        )}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
