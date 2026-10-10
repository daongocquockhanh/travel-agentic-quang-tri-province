/**
 * Greedy label placement for map pins: each label tries below, above, right
 * and left of its pin and takes the first spot that doesn't overlap a label
 * already placed or another pin. Pins are processed top to bottom so the
 * result is stable as the map pans.
 */
export type Placement = "below" | "above" | "right" | "left";

export interface LabelInput {
  id: string;
  /** Pin centre in px. */
  x: number;
  y: number;
  text: string;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const PIN_R = 9;
const GAP = 3;
const LABEL_H = 18;
const ORDER: Placement[] = ["below", "above", "right", "left"];

/** Approximate label width at 11px medium: average glyph ~6.3px plus padding. */
export function labelWidth(text: string): number {
  return Math.ceil(text.length * 6.3) + 12;
}

export function labelBox(p: LabelInput, where: Placement): Box {
  const w = labelWidth(p.text);
  switch (where) {
    case "below":
      return {
        x0: p.x - w / 2,
        y0: p.y + PIN_R + GAP,
        x1: p.x + w / 2,
        y1: p.y + PIN_R + GAP + LABEL_H,
      };
    case "above":
      return {
        x0: p.x - w / 2,
        y0: p.y - PIN_R - GAP - LABEL_H,
        x1: p.x + w / 2,
        y1: p.y - PIN_R - GAP,
      };
    case "right":
      return {
        x0: p.x + PIN_R + GAP,
        y0: p.y - LABEL_H / 2,
        x1: p.x + PIN_R + GAP + w,
        y1: p.y + LABEL_H / 2,
      };
    case "left":
      return {
        x0: p.x - PIN_R - GAP - w,
        y0: p.y - LABEL_H / 2,
        x1: p.x - PIN_R - GAP,
        y1: p.y + LABEL_H / 2,
      };
  }
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const area = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

export function layoutLabels(
  points: LabelInput[],
  bounds?: { width: number; height: number },
): Record<string, Placement> {
  const pins: Box[] = points.map((p) => ({
    x0: p.x - PIN_R,
    y0: p.y - PIN_R,
    x1: p.x + PIN_R,
    y1: p.y + PIN_R,
  }));
  const placed: Box[] = [];
  const out: Record<string, Placement> = {};

  for (const p of [...points].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let best: { where: Placement; cost: number; box: Box } | null = null;
    for (const where of ORDER) {
      const box = labelBox(p, where);
      let cost = 0;
      for (const q of placed) cost += area(box, q);
      for (const pin of pins) if (overlaps(box, pin)) cost += area(box, pin) * 2;
      if (bounds && (box.x0 < 0 || box.x1 > bounds.width || box.y0 < 0 || box.y1 > bounds.height))
        cost += 400;
      if (!best || cost < best.cost) best = { where, cost, box };
      if (cost === 0) break;
    }
    out[p.id] = best!.where;
    placed.push(best!.box);
  }
  return out;
}

/** CSS offset for a label relative to its pin centre. */
export function labelStyle(where: Placement): Record<string, string> {
  const d = `${PIN_R + GAP}px`;
  switch (where) {
    case "below":
      return { top: d, left: "50%", transform: "translateX(-50%)" };
    case "above":
      return { bottom: d, left: "50%", transform: "translateX(-50%)" };
    case "right":
      return { left: d, top: "50%", transform: "translateY(-50%)" };
    case "left":
      return { right: d, top: "50%", transform: "translateY(-50%)" };
  }
}
