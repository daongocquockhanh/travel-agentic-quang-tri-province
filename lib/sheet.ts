/** Bottom sheet geometry (components/bottom-sheet.tsx), kept pure for tests. */

export type SheetSnap = "peek" | "half" | "full";

/** Sheet heights in px for a given viewport height, with `bottom` px taken by a tab bar. */
export function snapHeights(viewport: number, topGap: number, bottom = 0) {
  return {
    peek: Math.min(196, viewport * 0.4),
    half: Math.round(viewport * 0.55) - bottom,
    full: viewport - topGap - bottom,
  };
}

/** Fraction of the screen the sheet covers, for keeping map pins above it. */
export function sheetInset(snap: SheetSnap, viewport: number, topGap: number, bottom = 0) {
  if (!viewport) return snap === "peek" ? 0.3 : 0.55;
  // At full height the map is hidden anyway; keep the half layout behind it.
  const h = snapHeights(viewport, topGap, bottom)[snap === "full" ? "half" : snap];
  return (h + bottom) / viewport;
}
