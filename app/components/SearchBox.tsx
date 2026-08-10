"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { MapPin, Search, SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { formatHa } from "@/lib/format";
import { filterAndSortSites } from "@/lib/scoring";
import type { ThreatenedProperties } from "@/lib/schema";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 8;

export interface SearchBoxProps {
  /** The searchable set (already narrowed by any active land-use filter). */
  sites: ThreatenedProperties[];
  query: string;
  onQueryChange: (q: string) => void;
  /** Fired when a suggestion is chosen — selects the site on the map. */
  onSelectSite: (id: number) => void;
  /** Number of active land-use filters, shown as a badge on the filter button. */
  filterActiveCount?: number;
  /** Opens the filter & layers panel (trigger lives inside the search box). */
  onOpenFilter?: () => void;
  className?: string;
}

/**
 * Header search with an autocomplete dropdown. Typing filters `sites` by
 * relevance; choosing a suggestion selects that site (map fly-to) instead of
 * rendering a separate results list. Keyboard nav (↑/↓/Enter/Esc) is handled
 * by cmdk since the input lives inside the Command root.
 */
export function SearchBox({
  sites,
  query,
  onQueryChange,
  onSelectSite,
  filterActiveCount = 0,
  onOpenFilter,
  className,
}: SearchBoxProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (query.trim() === "") return [];
    return filterAndSortSites(sites, {
      query,
      sortMode: "relevance",
      landUses: [],
    }).slice(0, MAX_SUGGESTIONS);
  }, [sites, query]);

  // Close on outside pointer-down (keeps item clicks working — they're inside).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const showList = open && query.trim() !== "";

  function choose(site: ThreatenedProperties) {
    onSelectSite(site.id);
    onQueryChange(site.label);
    setOpen(false);
  }

  return (
    <Command
      ref={rootRef}
      shouldFilter={false}
      className={cn(
        "relative h-auto w-full overflow-visible rounded-none bg-transparent p-0",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <InputGroup className="h-9 rounded-lg bg-background">
        <InputGroupAddon>
          <Search className="size-4 opacity-60" />
        </InputGroupAddon>
        <CommandPrimitive.Input
          value={query}
          onValueChange={(v) => {
            onQueryChange(v);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim() !== "") setOpen(true);
          }}
          placeholder="Search a forest, area or locality…"
          aria-label="Search threatened forest sites"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query.length > 0 && (
          <InputGroupAddon align="inline-end">
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
                setOpen(false);
              }}
              aria-label="Clear search"
              className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </InputGroupAddon>
        )}
        {onOpenFilter && (
          <InputGroupAddon align="inline-end" className="gap-0">
            <span aria-hidden className="mr-1 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={onOpenFilter}
              aria-label="Filter and layers"
              className="relative flex items-center gap-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <SlidersHorizontal className="size-4" />
              {filterActiveCount > 0 && (
                <Badge
                  variant="default"
                  className="h-4 min-w-4 justify-center px-1 tabular-nums"
                >
                  {filterActiveCount}
                </Badge>
              )}
            </button>
          </InputGroupAddon>
        )}
      </InputGroup>

      {showList && (
        <CommandList
          className={cn(
            "absolute top-full right-0 left-0 z-50 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg",
          )}
        >
          <CommandEmpty className="py-6 text-sm text-muted-foreground">
            No forests match &ldquo;{query.trim()}&rdquo;.
          </CommandEmpty>
          {suggestions.map((site) => (
            <CommandItem
              key={site.id}
              value={String(site.id)}
              onSelect={() => choose(site)}
              className="flex items-center gap-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {site.label}
                </span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  {site.locality && (
                    <>
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{site.locality}</span>
                      <span className="shrink-0">·</span>
                    </>
                  )}
                  <span className="truncate">{site.dominant_lu_desc}</span>
                </span>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {formatHa(site.area_ha)}
              </Badge>
            </CommandItem>
          ))}
        </CommandList>
      )}
    </Command>
  );
}
