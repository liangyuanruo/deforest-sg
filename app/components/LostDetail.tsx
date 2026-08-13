"use client";

import { Axe, Ruler, X } from "lucide-react";

import { ShareButton } from "@/components/ShareButton";
import { ZoningRows } from "@/components/SiteDetail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFootballFields, formatHa } from "@/lib/format";
import type { DeforestedProperties } from "@/lib/schema";
import { cn } from "@/lib/utils";

/** A cleared forest as a share target: keyed on its UUID with past-tense copy. */
function clearedShareTarget(site: DeforestedProperties) {
  return { id: site.uid, label: site.name, cleared: true };
}

export interface LostDetailProps {
  site: DeforestedProperties;
  onClose: () => void;
  className?: string;
}

/**
 * Detail card for a selected already-cleared forest (Tengah, Dover East). Shares
 * the vulnerable-forest card's chrome and slot (Explorer swaps between the two and
 * the stats overlay, so only one panel is ever on screen), but its own shape:
 * there's no "threatened fraction" — the whole patch is gone — so it leads with the
 * cleared area, then the MP2025 zoning that replaced it via the shared
 * {@link ZoningRows}. No ShareButton: cleared areas aren't deep-linkable.
 */
export function LostDetail({ site, onClose, className }: LostDetailProps) {
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
            {site.name}
          </h2>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Axe className="size-3 shrink-0" />
            Already cleared
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <ShareButton site={clearedShareTarget(site)} size="icon-sm" />
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

      <LostDetailBody site={site} className="overflow-y-auto px-3 py-3" />
    </div>
  );
}

/**
 * Condensed summary line for the mobile sheet's always-visible peek: the cleared
 * forest's name plus how much was lost, with a close action. The action cluster is
 * `data-sheet-no-drag` so tapping it never starts a sheet drag.
 */
export function LostSheetPeek({
  site,
  onClose,
}: {
  site: DeforestedProperties;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-foreground">
          {site.name}
        </h2>
        <p className="truncate text-xs text-muted-foreground">
          {formatHa(site.area_ha)} cleared · {formatFootballFields(site.area_ha)}
        </p>
      </div>
      <div data-sheet-no-drag className="flex shrink-0 items-center">
        <ShareButton site={clearedShareTarget(site)} size="icon-sm" />
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
 * The selected cleared-forest's detail content, without card chrome. Shared by the
 * desktop card ({@link LostDetail}) and the mobile bottom sheet so the two can't
 * drift. `className` supplies the container's padding/scroll for each host.
 */
export function LostDetailBody({
  site,
  className,
  showFootballFields = true,
}: {
  site: DeforestedProperties;
  className?: string;
  /** The mobile sheet's peek already carries the football-field comparison, so
   *  it suppresses the body's copy to avoid showing the same figure twice. */
  showFootballFields?: boolean;
}) {
  const hasZoning = Boolean(site.dominant_lu_desc || site.gpr);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Ruler className="size-3.5" />
            Cleared area
          </span>
          <Badge variant="secondary" className="tabular-nums">
            {formatHa(site.area_ha)}
          </Badge>
        </div>
        {showFootballFields && (
          <p className="text-xs text-muted-foreground/80">
            {formatFootballFields(site.area_ha)}
          </p>
        )}
      </div>

      <p className="text-xs leading-snug text-muted-foreground">
        This secondary forest has already been cleared for development.
        {hasZoning
          ? " Master Plan 2025 zones the land that replaced it for:"
          : ""}
      </p>

      {hasZoning && <ZoningRows luDesc={site.dominant_lu_desc} gpr={site.gpr} />}
    </div>
  );
}
