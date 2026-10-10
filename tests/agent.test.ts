import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataStreamWriter } from "ai";
import { runAgent } from "@/lib/agent/run";
import type { AgentAnnotation, AgentRequest } from "@/lib/agent/types";

/** Collects what runAgent writes, decoding the data-stream text parts. */
function fakeStream() {
  const annotations: AgentAnnotation[] = [];
  let text = "";
  const writer = {
    write(part: string) {
      const m = /^0:(.*)\n$/s.exec(part);
      if (m) text += JSON.parse(m[1]);
    },
    writeData() {},
    writeMessageAnnotation(value: unknown) {
      annotations.push(value as AgentAnnotation);
    },
    writeSource() {},
    merge() {},
    onError: undefined,
  } as unknown as DataStreamWriter;
  return { writer, annotations, text: () => text };
}

const ask = (content: string, extra: Partial<AgentRequest> = {}): AgentRequest => ({
  messages: [{ role: "user", content }],
  track: "foreign",
  lang: "en",
  ...extra,
});

beforeEach(() => {
  // Offline path: no LLM, no Supabase. Exercises grounding + refusal logic.
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("runAgent (offline)", () => {
  it("answers a war-track question from curated chunks with citations", async () => {
    const s = fakeStream();
    await runAgent(
      ask("How deep do the tunnels go?", { track: "war", site_slug: "vinh-moc" }),
      s.writer,
    );

    const mode = s.annotations.find((a) => a.type === "mode");
    expect(mode).toMatchObject({ grounded: true, offline: true, refused: false });
    const citations = s.annotations.filter((a) => a.type === "citation");
    expect(citations.length).toBeGreaterThan(0);
    expect(s.text()).toMatch(/\[1\]/);
  });

  // Every section is still a draft, so the production switch leaves no usable content.
  const withReviewedOnly = async (fn: () => Promise<void>) => {
    process.env.CONTENT_REQUIRE_REVIEWED = "true";
    try {
      await fn();
    } finally {
      delete process.env.CONTENT_REQUIRE_REVIEWED;
    }
  };

  it("refuses a sensitive question with no usable curated content and does not invent an answer", async () => {
    const s = fakeStream();
    await withReviewedOnly(() =>
      runAgent(
        ask("What battles happened at the bridge?", { track: "war", site_slug: "hien-luong" }),
        s.writer,
      ),
    );
    const mode = s.annotations.find((a) => a.type === "mode");
    expect(mode).toMatchObject({ refused: true });
    expect(s.annotations.some((a) => a.type === "citation")).toBe(false);
    expect(s.text()).toMatch(/verified, sourced material/);
    expect(s.text()).toMatch(/about Hien Luong/);
  });

  it("refuses in Vietnamese when lang is vi", async () => {
    const s = fakeStream();
    await withReviewedOnly(() =>
      runAgent(
        ask("Có trận đánh nào ở cầu Hiền Lương không?", { lang: "vi", site_slug: "hien-luong" }),
        s.writer,
      ),
    );
    expect(s.text()).toMatch(/Mình chưa có tư liệu/);
  });

  it("marks citations drawn from draft content", async () => {
    const s = fakeStream();
    await runAgent(
      ask("How tall was the flagpole?", { track: "war", site_slug: "hien-luong" }),
      s.writer,
    );
    const citations = s.annotations.filter((a) => a.type === "citation");
    expect(citations.length).toBeGreaterThan(0);
    expect(citations.every((c) => c.type === "citation" && c.draft)).toBe(true);
  });

  it("serves Vietnamese curated content for a vi question", async () => {
    const s = fakeStream();
    await runAgent(
      ask("Địa đạo Vĩnh Mốc sâu bao nhiêu?", { lang: "vi", site_slug: "vinh-moc" }),
      s.writer,
    );
    expect(s.text()).toMatch(/Chế độ ngoại tuyến/);
    expect(s.annotations.some((a) => a.type === "citation")).toBe(true);
  });
});

describe("runAgent grounding scope", () => {
  const citedSites = (anns: AgentAnnotation[]) =>
    new Set(anns.flatMap((a) => (a.type === "citation" ? [a.site_slug] : [])));

  it("grounds on the site named in the question, not the site in context", async () => {
    const s = fakeStream();
    // Standing at Vinh Moc but asking about Hien Luong.
    await runAgent(
      ask("Tell me the war history of Hien Luong bridge", { site_slug: "vinh-moc" }),
      s.writer,
    );
    expect(s.annotations.find((a) => a.type === "mode")).toMatchObject({
      grounded: true,
      refused: false,
    });
    expect(citedSites(s.annotations)).toEqual(new Set(["hien-luong"]));
  });

  it("treats a question naming a war site as sensitive even from a nature site", async () => {
    const s = fakeStream();
    await runAgent(ask("What happened at Hien Luong?", { site_slug: "cua-tung" }), s.writer);
    expect(s.annotations.find((a) => a.type === "mode")).toMatchObject({ grounded: true });
    expect(citedSites(s.annotations)).toEqual(new Set(["hien-luong"]));
  });
});

describe("runAgent planning (offline)", () => {
  // The recommender ranks sites open on arrival first, so pin the clock to
  // 10:00 in Vietnam (03:00 UTC); at night Vĩnh Mốc is closed and drops behind.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-10T03:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("answers 'where next' with recommend_next tool parts instead of refusing on the war track", async () => {
    const parts: string[] = [];
    const s = fakeStream();
    const writer = {
      ...s.writer,
      write(part: string) {
        parts.push(part);
        (s.writer.write as (p: string) => void)(part);
      },
    } as unknown as DataStreamWriter;
    await runAgent(
      ask("Where should I go next?", { track: "war", site_slug: "hien-luong" }),
      writer,
    );

    expect(s.annotations.find((a) => a.type === "mode")).toMatchObject({
      refused: false,
      offline: true,
    });
    const call = parts.find((p) => p.startsWith("9:"));
    const result = parts.find((p) => p.startsWith("a:"));
    expect(JSON.parse(call!.slice(2))).toMatchObject({ toolName: "recommend_next" });
    const recs = JSON.parse(result!.slice(2)).result.recommendations;
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].slug).toBe("vinh-moc"); // same 17th-parallel story, minutes away
  });

  it("doesn't attach unrelated citations to a plan with no place in context", async () => {
    const s = fakeStream();
    await runAgent(ask("Plan a day for me with war history sites", { track: "war" }), s.writer);
    expect(s.annotations.find((a) => a.type === "mode")).toMatchObject({ refused: false });
    expect(s.annotations.filter((a) => a.type === "citation")).toEqual([]);
  });
});
