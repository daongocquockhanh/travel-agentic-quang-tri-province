import { describe, expect, it } from "vitest";
import { MORE_PROMPT, followUps } from "@/lib/agent/follow-ups";
import { answerTokens } from "@/lib/agent/guards";
import { buildSystemPrompt } from "@/lib/agent/system-prompts";

const SITE = { slug: "vinh-moc", hasQuiz: true, hasTour: true };

describe("followUps", () => {
  it("offers more detail, the site's quiz and tour, and what's next", () => {
    const chips = followUps({
      lang: "en",
      site: SITE,
      refused: false,
      lastQuestion: "How deep are the tunnels?",
    });
    expect(chips.map((c) => c.kind)).toEqual(["more", "quiz", "tour", "next"]);
    expect(chips.find((c) => c.kind === "more")).toMatchObject({
      prompt: MORE_PROMPT.en,
      depth: "full",
    });
    expect(chips.find((c) => c.kind === "quiz")).toMatchObject({ href: "/site/vinh-moc/quiz" });
    expect(chips.find((c) => c.kind === "tour")).toMatchObject({ href: "/site/vinh-moc/tour" });
  });

  it("speaks the traveller's language", () => {
    const chips = followUps({
      lang: "vi",
      site: SITE,
      refused: false,
      lastQuestion: "Sâu bao nhiêu?",
    });
    expect(chips[0]).toMatchObject({ label: "Kể thêm", prompt: MORE_PROMPT.vi });
    expect((chips.at(-1) as { prompt: string }).prompt).toMatch(/đi đâu tiếp/);
  });

  it("only links a quiz or tour the site actually has", () => {
    const chips = followUps({
      lang: "en",
      site: { slug: "cua-tung", hasQuiz: true, hasTour: false },
      refused: false,
      lastQuestion: "Is it good for swimming?",
    });
    expect(chips.map((c) => c.kind)).toEqual(["more", "quiz", "next"]);
  });

  it("does not offer more of a refusal, or more after a deep answer", () => {
    expect(
      followUps({ lang: "en", site: SITE, refused: true, lastQuestion: "Who won?" }).some(
        (c) => c.kind === "more",
      ),
    ).toBe(false);
    expect(
      followUps({ lang: "en", site: SITE, refused: false, lastQuestion: MORE_PROMPT.en }).some(
        (c) => c.kind === "more",
      ),
    ).toBe(false);
  });

  it("works without a site in context", () => {
    expect(
      followUps({ lang: "en", site: null, refused: false, lastQuestion: "Best beach?" }).map(
        (c) => c.kind,
      ),
    ).toEqual(["more", "next"]);
  });
});

describe("answer depth", () => {
  it("gives a fuller answer more room, only when asked", () => {
    expect(answerTokens(undefined)).toBe(700);
    expect(answerTokens("full")).toBe(1200);
  });

  it("asks for a fuller retelling from the same sources, never padding", () => {
    const base = {
      track: "war" as const,
      lang: "en" as const,
      site: null,
      location: null,
      groundingChunks: null,
    };
    const short = buildSystemPrompt(base);
    const full = buildSystemPrompt({ ...base, depth: "full" });
    expect(short).toMatch(/two to four short paragraphs/);
    expect(full).not.toMatch(/two to four short paragraphs/);
    expect(full).toMatch(/fuller answer/);
    expect(full).toMatch(/only from the sources/i);
  });
});
