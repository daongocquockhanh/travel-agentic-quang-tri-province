import { describe, expect, it } from "vitest";
import { checkQuiz } from "@/lib/quiz-check";

const text = (q: string) => ({ q, options: ["a", "b", "c", "d"], explain: `because ${q}` });
const question = (over: Record<string, unknown> = {}) => ({
  id: "depth",
  answer: 2,
  source: "history",
  vi: text("vi"),
  en: text("en"),
  ...over,
});
const quiz = (questions: unknown[], review_status = "draft") => ({ review_status, questions });
const SECTIONS = ["overview", "history", "visit_tips"];
const five = () => ["a", "b", "c", "d", "e"].map((id) => question({ id }));

describe("checkQuiz", () => {
  it("accepts a well-formed draft quiz, warning that it is unreviewed", () => {
    const r = checkQuiz("vinh-moc", quiz(five()), SECTIONS);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/not yet reviewed/);
  });

  it("makes drafts an error in strict mode", () => {
    expect(checkQuiz("vinh-moc", quiz(five()), SECTIONS, { strict: true }).errors.join()).toMatch(
      /not yet reviewed/,
    );
  });

  it("requires both languages with four options each", () => {
    const r = checkQuiz(
      "vinh-moc",
      quiz([question({ en: undefined }), question({ id: "b", vi: { ...text("vi"), options: ["a", "b"] } })]),
      SECTIONS,
    );
    expect(r.errors.join("\n")).toMatch(/depth: en is missing/);
    expect(r.errors.join("\n")).toMatch(/b: vi needs exactly 4 options/);
  });

  it("rejects an answer index outside 0–3", () => {
    expect(checkQuiz("x", quiz([question({ answer: 4 })]), SECTIONS).errors.join()).toMatch(
      /answer must be 0, 1, 2 or 3/,
    );
  });

  it("requires the source to be a section this site has", () => {
    const r = checkQuiz("x", quiz([question({ source: "culture_notes" })]), SECTIONS);
    expect(r.errors.join()).toMatch(/source "culture_notes" is not a section of this site/);
  });

  it("rejects duplicate ids and warns below five questions", () => {
    const r = checkQuiz("x", quiz([question(), question()]), SECTIONS);
    expect(r.errors.join()).toMatch(/duplicate question id "depth"/);
    expect(r.warnings.join()).toMatch(/only 2 questions/);
  });

  it("rejects a file that is not a quiz", () => {
    expect(checkQuiz("x", "nonsense", SECTIONS).errors.join()).toMatch(/questions must be a list/);
  });
});
