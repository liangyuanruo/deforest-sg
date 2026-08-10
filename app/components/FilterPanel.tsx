"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { MAP_LAYERS, type MapLayerKey, type MapLayerVisibility } from "@/lib/layers";
import type { LandUseOption } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export interface FilterPanelProps {
  /** Controlled open state (the trigger now lives inside the search box). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landUseOptions: LandUseOption[];
  selectedLandUses: string[];
  onToggleLandUse: (luDesc: string) => void;
  onClearLandUses: () => void;
  layers: MapLayerVisibility;
  onToggleLayer: (layer: MapLayerKey) => void;
}

type FilterBodyProps = Omit<FilterPanelProps, "open" | "onOpenChange">;

const TITLE = "Filter & layers";
const DESCRIPTION =
  "Narrow the map to a land-use class and choose which layers to show.";

/**
 * True below the `sm` breakpoint (640px). Client-only — false during SSR and the
 * first client render (the panel is closed then, so there's no hydration diff);
 * it settles on mount and stays in sync with viewport changes.
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/**
 * All filtering behaviour — land-use pills + map-layer toggles. Controlled by the
 * header (the trigger sits inside the search box); renders no trigger of its own.
 * On phones it opens as a bottom drawer (thumb-reachable); on desktop as a
 * centered dialog.
 */
export function FilterPanel({ open, onOpenChange, ...body }: FilterPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-xl">
          <SheetHeader className="pb-2">
            <SheetTitle>{TITLE}</SheetTitle>
            <SheetDescription>{DESCRIPTION}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
            <FilterBody {...body} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        <FilterBody {...body} />
      </DialogContent>
    </Dialog>
  );
}

function FilterBody({
  landUseOptions,
  selectedLandUses,
  onToggleLandUse,
  onClearLandUses,
  layers,
  onToggleLayer,
}: FilterBodyProps) {
  const activeCount = selectedLandUses.length;

  return (
    <>
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
    </>
  );
}
