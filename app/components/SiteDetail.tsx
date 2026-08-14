"use client";

import { Building2, Info, Layers, MapPin, Ruler, X } from "lucide-react";

import { ShareButton } from "@/components/ShareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatFootballFields, formatHa, formatPercent } from "@/lib/format";
import { describeZoning } from "@/lib/feature-view";
import { GPR_EXPLAINER } from "@/lib/gpr";
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

      <SiteDetailBody site={site} className="overflow-y-auto px-3 py-3" />
    </div>
  );
}

/**
 * Condensed summary line for the mobile sheet's always-visible peek: the
 * forest's name plus how much of it is under threat, with share/close actions.
 * The action cluster is `data-sheet-no-drag` so tapping it never starts a sheet
 * drag.
 */
export function SiteSheetPeek({
  site,
  onClose,
}: {
  site: ThreatenedProperties;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-foreground">
          {site.label}
        </h2>
        <p className="truncate text-xs text-muted-foreground">
          {formatHa(site.area_ha)} vulnerable · {formatFootballFields(site.area_ha)}
          {site.locality ? ` · ${site.locality}` : ""}
        </p>
      </div>
      <div data-sheet-no-drag className="flex shrink-0 items-center">
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
  );
}

/**
 * The selected patch's detail content, without any card chrome. Shared by the
 * desktop card ({@link SiteDetail}) and the mobile bottom sheet, so the two can't
 * drift. `className` supplies the container's padding/scroll for each host.
 */
export function SiteDetailBody({
  site,
  className,
  showFootballFields = true,
}: {
  site: ThreatenedProperties;
  className?: string;
  /** The mobile sheet's peek already carries the football-field comparison, so
   *  it suppresses the body's copy to avoid showing the same figure twice. */
  showFootballFields?: boolean;
}) {
  const percent = formatPercent(site.threatened_fraction);
  const width = `${Math.min(100, site.threatened_fraction * 100).toFixed(0)}%`;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Ruler className="size-3.5" />
              Vulnerable area
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
          {showFootballFields && (
            <p className="text-xs text-muted-foreground/80">
              {formatFootballFields(site.area_ha)}
            </p>
          )}
        </div>

        <ZoningRows luDesc={site.dominant_lu_desc} gpr={site.gpr} />

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
  );
}

/**
 * The URA-zoning rows shared by the vulnerable-forest card ({@link SiteDetailBody})
 * and the already-cleared card ({@link LostDetail}): a land-use swatch + label, its
 * plain-language gloss, the plot-ratio range (with a "what is plot ratio?" tooltip),
 * and any planning-code legends. Derives its content from the shared
 * `describeZoning` view-model (lib/feature-view) — the same source the map popup
 * renders from, so the card and the popup can't drift. `luDesc` may be null (a
 * cleared area can fall outside every MP2025 polygon), in which case the swatch
 * row is omitted.
 */
export function ZoningRows({
  luDesc,
  gpr,
}: {
  luDesc: string | null;
  gpr: string | null;
}) {
  // Shared derivation with the map popup (see lib/feature-view) so the card and
  // the popup can't drift on which colour/gloss/range/codes a patch shows.
  const zoning = describeZoning(luDesc, gpr);
  const hasGpr = zoning.range !== null || zoning.codes.length > 0;

  return (
    <dl className="flex flex-col gap-2 text-xs">
      {zoning.landUse && (
        <Row
          icon={<Layers className="size-3.5" />}
          label="URA zoning"
          value={zoning.landUse.label}
          swatch={zoning.landUse.color}
        />
      )}
      {zoning.landUse?.gloss && (
        <p className="-mt-0.5 text-xs leading-snug text-muted-foreground">
          {zoning.landUse.gloss}
        </p>
      )}
      {hasGpr && (
        <Row
          icon={<Building2 className="size-3.5" />}
          label="Plot ratio"
          value={zoning.range ?? "—"}
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
      {zoning.codes.map((c) => {
        const hasGloss = c.shortLabel != null && c.description != null;
        return (
          <p
            key={c.code}
            className="-mt-0.5 text-xs leading-snug text-muted-foreground"
          >
            <span className="font-medium text-foreground">
              {c.code}
              {hasGloss ? ` — ${c.shortLabel}` : ""}
            </span>
            {hasGloss ? <>. {c.description}</> : null}
          </p>
        );
      })}
    </dl>
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
