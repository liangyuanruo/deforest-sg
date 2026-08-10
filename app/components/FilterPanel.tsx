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

        {/* The derivation, stated up front: threatened forest isn't a separate
            dataset, it's the overlap of the two source layers below. */}
        <LayerFormula />

        <ul className="flex flex-col gap-1">
          {resultLayers.map((layer) => (
            <LayerRow
              key={layer.key}
              layer={layer}
              checked={layers[layer.key]}
              onToggle={() => onToggleLayer(layer.key)}
            />
          ))}
        </ul>

        <p className="px-1 pt-1 text-xs font-medium text-muted-foreground">
          Source layers
        </p>
        <ul className="flex flex-col gap-1">
          {sourceLayers.map((layer) => (
            <LayerRow
              key={layer.key}
              layer={layer}
              checked={layers[layer.key]}
              onToggle={() => onToggleLayer(layer.key)}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

const resultLayers = MAP_LAYERS.filter((l) => l.role === "result");
const sourceLayers = MAP_LAYERS.filter((l) => l.role === "source");

/** A colour chip matching a layer's map swatch; `ring` keeps pale fills visible. */
function LayerDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-3 shrink-0 rounded-sm ring-1 ring-border"
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Reads "mapped forest ∩ development zones = threatened forest" using the layers'
 * own swatches, so the picture of how the result is computed can't drift from the
 * toggles beneath it. Purely explanatory (not interactive); the symbols are hidden
 * from assistive tech in favour of a plain-language label on the row.
 */
function LayerFormula() {
  const [a, b] = sourceLayers;
  const [result] = resultLayers;
  return (
    <div
      role="note"
      aria-label={`${result.label} is where ${a.shortLabel} and ${b.shortLabel} overlap`}
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground"
    >
      <LayerDot color={a.swatch} />
      <span>{a.shortLabel}</span>
      <span aria-hidden className="px-0.5 text-muted-foreground/70">
        ∩
      </span>
      <LayerDot color={b.swatch} />
      <span>{b.shortLabel}</span>
      <span aria-hidden className="px-0.5 text-muted-foreground/70">
        =
      </span>
      <LayerDot color={result.swatch} />
      <span className="font-medium text-foreground">{result.shortLabel}</span>
    </div>
  );
}

/** One toggle row: checkbox + swatch + label/description. */
function LayerRow({
  layer,
  checked,
  onToggle,
}: {
  layer: (typeof MAP_LAYERS)[number];
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 select-none hover:bg-muted">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="size-4 accent-foreground"
        />
        <LayerDot color={layer.swatch} />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm text-foreground">{layer.label}</span>
          <span className="text-xs text-muted-foreground">
            {layer.description}
          </span>
        </span>
      </label>
    </li>
  );
}
