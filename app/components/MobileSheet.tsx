"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** The three rest positions, à la Google Maps: a thumbnail peek, a half-screen
 *  card (map still visible above it), and a near-full reader. */
export type SheetSnap = "peek" | "half" | "full";

/** The sheet grows to fit its content but never past this fraction of the
 *  viewport, so it can't cover the search header; taller content scrolls. */
const MAX_VH = 0.88;
/** The half snap targets this fraction of the viewport — but is clamped down to
 *  the content height, so a short card never opens past what it needs. */
const HALF_VH = 0.48;

/** Below this drag distance (px) a gesture counts as a tap, not a drag. */
const TAP_SLOP = 6;

export interface MobileSheetProps {
  /** Controlled rest position (selection drives it: opening a forest → half). */
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** Always-visible summary shown in the draggable header (below the handle). */
  peek: React.ReactNode;
  /** Scrollable detail, revealed as the sheet is dragged up. */
  children: React.ReactNode;
  className?: string;
}

/**
 * A non-modal, draggable bottom sheet for phones. Unlike `ui/sheet` (a modal
 * base-ui dialog with a backdrop), this leaves the map fully visible and
 * interactive above it and rests at three snap points you can drag between.
 * Rendered on every breakpoint but hidden (`sm:hidden`) on desktop, where the
 * floating top-left panel takes over.
 */
export function MobileSheet({
  snap,
  onSnapChange,
  peek,
  children,
  className,
}: MobileSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ vh: 0, headerH: 0, contentH: 0 });
  // Live translateY while dragging (px); null when at rest, where the position
  // is derived from the controlled `snap` instead. Keeping the rest position
  // derived (not stored) avoids syncing state in an effect.
  const [dragTy, setDragTy] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    startY: number;
    startTy: number;
    pos: number;
    moved: boolean;
  } | null>(null);

  // Measure the viewport, the header (peek height), and the natural content
  // height so the sheet can size itself to its content and the snap offsets
  // track the real layout. Re-runs when the content or peek changes, or on
  // resize. We measure a non-stretching inner wrapper (`contentRef`) rather than
  // the scroll container: the container is `flex-1`, so its own height reflects
  // the panel, not the content, whereas the inner wrapper is only as tall as
  // what it holds — and so can't feed back on the panel height it drives.
  useLayoutEffect(() => {
    const measure = () => {
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 72;
      // Round up: a fractional content height floored by the panel would leave
      // the scroll container a hair short and show a spurious scrollbar at full.
      const bodyH = contentRef.current
        ? Math.ceil(contentRef.current.getBoundingClientRect().height)
        : 0;
      setMetrics({ vh: window.innerHeight, headerH, contentH: headerH + bodyH });
    };
    measure();
    // Re-measure whenever the header or content actually changes size — covers
    // late reflows the one-shot measure would miss (web-font load, text
    // wrapping). Both refs are non-stretching, so this can't feed back on the
    // panel height it drives.
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [peek, children]);

  // The panel is as tall as its content, capped so it never covers the header.
  const panelH = metrics.vh
    ? Math.min(metrics.contentH, metrics.vh * MAX_VH)
    : 0;

  // translateY that leaves a given snap's slice of the panel visible. `half` is
  // clamped to the panel height, so a card shorter than half a screen simply
  // rests fully open instead of floating with empty space beneath it.
  const snapTy = useCallback(
    (s: SheetSnap) => {
      if (!metrics.vh) return 0;
      const visible =
        s === "full"
          ? panelH
          : s === "half"
            ? Math.min(panelH, metrics.vh * HALF_VH)
            : metrics.headerH;
      return Math.max(0, panelH - visible);
    },
    [metrics, panelH],
  );

  // At rest, position comes from the controlled snap; mid-drag, from the finger.
  // `null` (before measurement) parks the sheet fully off-screen.
  const ty = dragTy ?? (metrics.vh ? snapTy(snap) : null);

  const nearestSnap = useCallback(
    (tyVal: number): SheetSnap => {
      const opts: SheetSnap[] = ["peek", "half", "full"];
      return opts.reduce((best, s) =>
        Math.abs(snapTy(s) - tyVal) < Math.abs(snapTy(best) - tyVal) ? s : best,
      );
    },
    [snapTy],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-sheet-no-drag]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startTy = ty ?? snapTy(snap);
    drag.current = { startY: e.clientY, startTy, pos: startTy, moved: false };
    setDragging(true);
    setDragTy(startTy);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dy) > TAP_SLOP) drag.current.moved = true;
    const next = Math.min(
      Math.max(0, drag.current.startTy + dy),
      panelH - metrics.headerH,
    );
    drag.current.pos = next;
    setDragTy(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const { moved, pos } = drag.current;
    drag.current = null;
    setDragging(false);
    setDragTy(null);
    // A tap toggles peek↔half; a drag snaps to whichever rest point is nearest.
    onSnapChange(moved ? nearestSnap(pos) : snap === "peek" ? "half" : "peek");
  };

  const toggle = () => onSnapChange(snap === "peek" ? "half" : "peek");

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border border-b-0 border-border/60 bg-card/95 shadow-lg backdrop-blur sm:hidden",
        className,
      )}
      style={{
        height: panelH ? `${panelH}px` : `${MAX_VH * 100}dvh`,
        // Fully off-screen until measured, so there's no flash of a full-height
        // sheet before the first snap position is known.
        transform: ty === null ? "translateY(100%)" : `translateY(${ty}px)`,
        transition: dragging
          ? "none"
          : "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        ref={headerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shrink-0 touch-none select-none"
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={snap === "peek" ? "Expand details" : "Collapse details"}
          aria-expanded={snap !== "peek"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          className="flex cursor-grab justify-center pt-2 pb-1 active:cursor-grabbing"
        >
          <span aria-hidden className="h-1 w-9 rounded-full bg-border" />
        </div>
        <div className="px-3 pb-2.5">{peek}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={contentRef} className="px-3 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
