"use client";

import { useRef, useState, type ReactNode } from "react";

export type SheetSnap = "peek" | "half" | "full";

/** Sheet heights in px for a given viewport height. */
export function snapHeights(viewport: number, topGap: number) {
  return {
    peek: Math.min(196, viewport * 0.4),
    half: Math.round(viewport * 0.55),
    full: viewport - topGap,
  };
}

/** Fraction of the screen the sheet covers, for keeping map pins above it. */
export function sheetInset(snap: SheetSnap, viewport: number, topGap: number) {
  if (!viewport) return snap === "peek" ? 0.25 : 0.55;
  // At full height the map is hidden anyway; keep the half layout behind it.
  const h = snapHeights(viewport, topGap)[snap === "full" ? "half" : snap];
  return h / viewport;
}

/**
 * A map bottom sheet (Google Maps style) with three heights: peek, half and
 * full. Drag the header to resize; it settles on the nearest height, or the
 * next one in the direction of a quick flick.
 */
export function BottomSheet({
  snap,
  onSnap,
  viewport,
  topGap,
  header,
  children,
  label,
  fitHeight,
}: {
  snap: SheetSnap;
  onSnap: (s: SheetSnap) => void;
  /** window.innerHeight, measured by the parent (0 before mount). */
  viewport: number;
  /** Space kept free above the sheet at full height (top chrome). */
  topGap: number;
  header?: ReactNode;
  children: ReactNode;
  label: string;
  /** Overrides the snap heights (e.g. a short preview card); dragging still works from it. */
  fitHeight?: number | null;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number; t: number } | null>(null);
  const sheet = useRef<HTMLElement | null>(null);
  const heights = snapHeights(viewport || 800, topGap);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!sheet.current || e.button > 0) return;
    start.current = {
      y: e.clientY,
      h: sheet.current.getBoundingClientRect().height,
      t: performance.now(),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const moved = s.y - e.clientY;
    // Only a real drag takes the pointer; taps still reach the links and tabs in the header.
    if (drag == null && Math.abs(moved) < 6) return;
    if (drag == null) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(Math.max(heights.peek * 0.8, Math.min(heights.full, s.h + moved)));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || drag == null) return;
    setDrag(null);
    const moved = s.y - e.clientY;
    const velocity = moved / Math.max(1, performance.now() - s.t); // px/ms, up is positive
    const order: SheetSnap[] = ["peek", "half", "full"];
    if (Math.abs(velocity) > 0.5) {
      const i = order.indexOf(snap) + (velocity > 0 ? 1 : -1);
      onSnap(order[Math.max(0, Math.min(2, i))]);
      return;
    }
    const h = s.h + moved;
    onSnap(order.reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a)));
  };

  // Tapping the handle steps up, then back down from full.
  const step = () => onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "half");

  return (
    <section
      ref={sheet}
      aria-label={label}
      className={
        "bg-paper absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-3xl shadow-[0_-16px_40px_-12px_rgba(31,36,40,.18)] " +
        (drag == null ? "transition-[height] duration-300 ease-[cubic-bezier(.32,.72,0,1)]" : "")
      }
      style={{
        height: drag ?? fitHeight ?? (viewport ? heights[snap] : snap === "peek" ? 196 : "55dvh"),
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={snap === "full" ? "Collapse" : "Expand"}
          onClick={step}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              step();
            }
          }}
          className="pt-2.5 pb-2"
        >
          <span className="bg-ink/25 mx-auto block h-1 w-10 rounded-full" />
        </div>
        {header}
      </div>
      {children}
    </section>
  );
}
