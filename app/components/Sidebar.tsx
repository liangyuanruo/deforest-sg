"use client";

import { ChevronDown, MapPin, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatHa, formatPercent } from "@/lib/format";
import type { ThreatenedProperties } from "@/lib/schema";
import type { LandUseOption, SortMode } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  /** Already filtered + sorted; rendered in order. */
  sites: ThreatenedProperties[];
  /** Total threatened sites (unfiltered) — for "X of Y". */
  totalCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  sortMode: SortMode;
  onSortModeChange: (m: SortMode) => void;
  /** All available land-use chips with counts. */
  landUseOptions: LandUseOption[];
  /** Currently active filter (subset of luDesc). */
  selectedLandUses: string[];
  onToggleLandUse: (luDesc: string) => void;
  onClearLandUses: () => void;
  selectedId: number | null;
  /** Row click. */
  onSelect: (id: number | null) => void;
  className?: string;
}

const SORT_LABELS: Record<SortMode, string> = {
  relevance: "Relevance",
  area: "Threatened area",
  fraction: "% threatened",
};

export function Sidebar({
  sites,
  totalCount,
  query,
  onQueryChange,
  sortMode,
  onSortModeChange,
  landUseOptions,
  selectedLandUses,
  onToggleLandUse,
  onClearLandUses,
  selectedId,
  onSelect,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-3 border-r border-border bg-card p-3",
        className,
      )}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search a forest, area or locality…"
          className="pl-8 pr-8"
          aria-label="Search threatened forest sites"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Sort by</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" />}
          >
            {SORT_LABELS[sortMode]}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sortMode}
              onValueChange={(value) => onSortModeChange(value as SortMode)}
            >
              <DropdownMenuRadioItem value="relevance">
                Relevance
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="area">
                Threatened area
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="fraction">
                % threatened
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {landUseOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {landUseOptions.map((option) => {
            const active = selectedLandUses.includes(option.luDesc);
            return (
              <button
                key={option.luDesc}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleLandUse(option.luDesc)}
                className="focus-visible:outline-none"
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                >
                  {option.luDesc}
                  <span className={cn(active ? "opacity-80" : "text-muted-foreground")}>
                    {option.count}
                  </span>
                </Badge>
              </button>
            );
          })}
          {selectedLandUses.length > 0 && (
            <button
              type="button"
              onClick={onClearLandUses}
              className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {sites.length} of {totalCount} sites
      </p>

      <ScrollArea className="flex-1 -mx-3 border-t border-border">
        {sites.length === 0 ? (
          <p className="flex h-24 items-center justify-center px-3 text-center text-sm text-muted-foreground">
            No sites match your search / filters.
          </p>
        ) : (
          <ul className="flex flex-col">
            {sites.map((site) => {
              const isSelected = site.id === selectedId;
              const percentLabel = formatPercent(site.threatened_fraction);
              return (
                <li key={site.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(site.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-1.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-accent",
                      isSelected && "border-l-2 border-l-primary bg-accent",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {site.label}
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {formatHa(site.area_ha)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {site.locality && (
                        <>
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{site.locality}</span>
                          <span className="shrink-0">·</span>
                        </>
                      )}
                      <span className="truncate">{site.dominant_lu_desc}</span>
                    </div>
                    <div
                      className="h-1 w-full overflow-hidden rounded-full bg-muted"
                      title={`${percentLabel} threatened`}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${(site.threatened_fraction * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
