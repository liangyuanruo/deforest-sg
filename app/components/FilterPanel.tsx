"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { MAP_LAYERS, type MapLayerKey, type MapLayerVisibility } from "@/lib/layers";
import type { LandUseOption } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export interface FilterPanelProps {
  landUseOptions: LandUseOption[];
  selectedLandUses: string[];
  onToggleLandUse: (luDesc: string) => void;
  onClearLandUses: () => void;
  layers: MapLayerVisibility;
  onToggleLayer: (layer: MapLayerKey) => void;
  className?: string;
}

/**
 * All filtering behaviour — land-use pills + map-layer toggles — behind a
 * single filter button, so the top bar stays a search field. The trigger
 * shows a count of active land-use filters.
 */
export function FilterPanel({
  landUseOptions,
  selectedLandUses,
  onToggleLandUse,
  onClearLandUses,
  layers,
  onToggleLayer,
  className,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const activeCount = selectedLandUses.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className={cn("relative", className)}>
            <SlidersHorizontal />
            <span className="hidden sm:inline">Filter</span>
            {activeCount > 0 && (
              <Badge
                variant="default"
                className="ml-0.5 h-4 min-w-4 justify-center px-1 tabular-nums"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filter &amp; layers</DialogTitle>
          <DialogDescription>
            Narrow the map to a land-use class and choose which layers to show.
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Land use</h3>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onClearLandUses}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear ({activeCount})
              </button>
            )}
          </div>
          {landUseOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No land-use data.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
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
                      <span
                        className={cn(
                          active ? "opacity-80" : "text-muted-foreground",
                        )}
                      >
                        {option.count}
                      </span>
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Map layers</h3>
          <ul className="flex flex-col gap-1">
            {MAP_LAYERS.map(({ key, label, swatch, description }) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 select-none hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => onToggleLayer(key)}
                    className="size-4 accent-foreground"
                  />
                  <span
                    aria-hidden
                    className="inline-block size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: swatch }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
