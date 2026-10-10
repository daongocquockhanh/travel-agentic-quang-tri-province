import { describe, expect, it } from "vitest";
import { labelBox, layoutLabels, type LabelInput } from "@/lib/label-layout";

const overlap = (a: ReturnType<typeof labelBox>, b: ReturnType<typeof labelBox>) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("layoutLabels", () => {
  it("puts an isolated label below its pin", () => {
    expect(layoutLabels([{ id: "a", x: 100, y: 100, text: "Khe Sanh" }])).toEqual({ a: "below" });
  });

  it("separates labels of pins that sit close together", () => {
    // Vĩnh Mốc, Hiền Lương and Cửa Tùng cluster within ~30 px at province zoom.
    const pins: LabelInput[] = [
      { id: "vm", x: 140, y: 175, text: "Vinh Moc" },
      { id: "hl", x: 158, y: 168, text: "Hien Luong" },
      { id: "ct", x: 172, y: 172, text: "Cua Tung" },
    ];
    const where = layoutLabels(pins, { width: 390, height: 400 });
    const boxes = pins.map((p) => labelBox(p, where[p.id]));
    let overlaps = 0;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i], boxes[j])) overlaps++;
    // Three pins this tight can't all be clear, but at most one pair may touch.
    expect(overlaps).toBeLessThanOrEqual(1);
    expect(new Set(Object.values(where)).size).toBeGreaterThan(1);
  });

  it("keeps labels inside the map when it can", () => {
    const where = layoutLabels([{ id: "edge", x: 380, y: 100, text: "Con Co" }], {
      width: 390,
      height: 400,
    });
    expect(where.edge).not.toBe("right");
  });
});
