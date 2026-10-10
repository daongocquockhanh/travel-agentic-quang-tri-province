import { describe, expect, it } from "vitest";
import { prepareAttempt, scoreAttempt } from "@/lib/quiz";
import { EMPTY_PASSPORT, parsePassport, stampState, withQuizResult, withVisit } from "@/lib/passport";
import type { QuizQuestion } from "@/lib/quiz-types";

const q = (id: string, answer: number): QuizQuestion => ({
  id,
  answer,
  source: "history",
  vi: { q: `vi ${id}`, options: ["a", "b", "c", "d"].map((o) => `vi-${o}`), explain: `vi why ${id}` },
  en: { q: `en ${id}`, options: ["a", "b", "c", "d"].map((o) => `en-${o}`), explain: `en why ${id}` },
});
const QUESTIONS = [q("one", 0), q("two", 1), q("three", 2), q("four", 3)];

/** Deterministic stand-in for Math.random. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe("prepareAttempt", () => {
  it("shuffles questions and options but keeps the correct option correct", () => {
    for (const seed of [1, 7, 42, 999]) {
      const attempt = prepareAttempt(QUESTIONS, "en", seeded(seed));
      expect(attempt.map((a) => a.id).sort()).toEqual(["four", "one", "three", "two"]);
      for (const a of attempt) {
        const original = QUESTIONS.find((x) => x.id === a.id)!;
        expect(a.options[a.correct]).toBe(original.en.options[original.answer]);
        expect([...a.options].sort()).toEqual([...original.en.options].sort());
      }
    }
  });

  it("actually reorders something across seeds", () => {
    const orders = new Set([1, 2, 3, 4, 5].map((s) => prepareAttempt(QUESTIONS, "en", seeded(s)).map((a) => a.id).join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("uses the requested language", () => {
    const [first] = prepareAttempt(QUESTIONS, "vi", seeded(3));
    expect(first.q).toMatch(/^vi /);
    expect(first.explain).toMatch(/^vi why/);
  });
});

describe("scoreAttempt", () => {
  it("counts correct picks and lists the missed questions", () => {
    const attempt = prepareAttempt(QUESTIONS, "en", seeded(5));
    const picks = attempt.map((a, i) => (i < 3 ? a.correct : (a.correct + 1) % 4));
    const result = scoreAttempt(attempt, picks);
    expect(result).toMatchObject({ score: 3, total: 4 });
    expect(result.missed.map((m) => m.id)).toEqual([attempt[3].id]);
  });
});

describe("passport", () => {
  const T1 = "2026-10-10T08:00:00.000Z";
  const T2 = "2026-10-11T08:00:00.000Z";

  it("starts empty and survives corrupt storage", () => {
    expect(parsePassport(null)).toEqual(EMPTY_PASSPORT);
    expect(parsePassport("{not json")).toEqual(EMPTY_PASSPORT);
    expect(parsePassport(JSON.stringify({ visits: 5, quizzes: { x: { best: "lots" } } }))).toEqual(EMPTY_PASSPORT);
  });

  it("round-trips valid data and drops malformed entries", () => {
    const raw = JSON.stringify({
      visits: { "vinh-moc": { at: T1, method: "gps" }, bad: { at: 3, method: "teleport" } },
      quizzes: { "vinh-moc": { best: 4, total: 6, at: T1 }, bad: { best: 9, total: 3, at: T1 } },
    });
    const p = parsePassport(raw);
    expect(Object.keys(p.visits)).toEqual(["vinh-moc"]);
    expect(Object.keys(p.quizzes)).toEqual(["vinh-moc"]);
  });

  it("stamps only when the site was visited and its quiz finished", () => {
    let p = EMPTY_PASSPORT;
    expect(stampState(p, "vinh-moc")).toBe("none");
    p = withQuizResult(p, "vinh-moc", 2, 6, T1);
    expect(stampState(p, "vinh-moc")).toBe("quizzed");
    p = withVisit(p, "vinh-moc", "self", T1);
    expect(stampState(p, "vinh-moc")).toBe("stamped");
    expect(stampState(withVisit(EMPTY_PASSPORT, "x", "gps", T1), "x")).toBe("visited");
  });

  it("keeps the best score and its date", () => {
    let p = withQuizResult(EMPTY_PASSPORT, "x", 4, 6, T1);
    p = withQuizResult(p, "x", 2, 6, T2);
    expect(p.quizzes.x).toEqual({ best: 4, total: 6, at: T1 });
    p = withQuizResult(p, "x", 6, 6, T2);
    expect(p.quizzes.x).toEqual({ best: 6, total: 6, at: T2 });
  });

  it("lets a GPS check-in upgrade a self-reported visit, never the reverse", () => {
    let p = withVisit(EMPTY_PASSPORT, "x", "self", T1);
    p = withVisit(p, "x", "gps", T2);
    expect(p.visits.x).toEqual({ at: T2, method: "gps" });
    p = withVisit(p, "x", "self", T2);
    expect(p.visits.x.method).toBe("gps");
    // A repeat GPS visit keeps the first date.
    expect(withVisit(p, "x", "gps", "2027-01-01T00:00:00.000Z").visits.x.at).toBe(T2);
  });

  it("never mutates the passport it is given", () => {
    const before = JSON.stringify(EMPTY_PASSPORT);
    withVisit(EMPTY_PASSPORT, "x", "gps", T1);
    withQuizResult(EMPTY_PASSPORT, "x", 1, 2, T1);
    expect(JSON.stringify(EMPTY_PASSPORT)).toBe(before);
  });
});
