// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { plan } from "@/lib/plan-store";
import { sheetInset, snapHeights } from "@/lib/sheet";
import { placesInAnswer, sitesMentionedIn } from "@/lib/site-mentions";

describe("plan.moveTo", () => {
  beforeEach(() => plan.set(["a", "b", "c", "d"]));

  it("moves a stop later or earlier", () => {
    plan.moveTo("a", 2);
    expect(plan.get()).toEqual(["b", "c", "a", "d"]);
    plan.moveTo("d", 0);
    expect(plan.get()).toEqual(["d", "b", "c", "a"]);
  });

  it("clamps the index and ignores unknown stops", () => {
    plan.moveTo("b", 99);
    expect(plan.get()).toEqual(["a", "c", "d", "b"]);
    plan.moveTo("zzz", 0);
    expect(plan.get()).toEqual(["a", "c", "d", "b"]);
  });
});

describe("places in a guide answer", () => {
  it("finds places in the order they are named, with or without diacritics", () => {
    expect(sitesMentionedIn("Start at Hiền Lương, then Vinh Moc Tunnels and the citadel.")).toEqual(
      ["hien-luong", "vinh-moc", "thach-han"],
    );
  });

  it("treats Đông Hà as a reference point unless it is the only place", () => {
    expect(placesInAnswer("Vịnh Mốc is about 30 km north of Đông Hà.")).toEqual(["vinh-moc"]);
    expect(placesInAnswer("Đông Hà has the best street food.")).toEqual(["dong-ha"]);
  });

  it("skips places already shown and keeps at most three", () => {
    const text = "Khe Sanh, Trường Sơn, La Vang, Cửa Tùng and Cồn Cỏ.";
    expect(placesInAnswer(text, ["khe-sanh"])).toEqual(["truong-son", "la-vang", "cua-tung"]);
  });
});

describe("bottom sheet heights", () => {
  it("fits between the top chrome and the tab bar", () => {
    const h = snapHeights(844, 72, 58);
    expect(h.full).toBe(844 - 72 - 58);
    expect(h.peek).toBeLessThan(h.half);
    // The map keeps pins above the sheet and the tab bar.
    expect(sheetInset("half", 844, 72, 58)).toBeCloseTo((h.half + 58) / 844);
  });
});
