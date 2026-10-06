import { beforeEach, describe, expect, it } from "vitest";
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
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("runAgent (offline)", () => {
  it("answers a war-track question from curated chunks with citations", async () => {
    const s = fakeStream();
    await runAgent(ask("How deep do the tunnels go?", { track: "war", site_slug: "vinh-moc" }), s.writer);

    const mode = s.annotations.find((a) => a.type === "mode");
    expect(mode).toMatchObject({ grounded: true, offline: true, refused: false });
    const citations = s.annotations.filter((a) => a.type === "citation");
    expect(citations.length).toBeGreaterThan(0);
    expect(s.text()).toMatch(/\[1\]/);
  });

  it("refuses a sensitive question with no curated content and does not invent an answer", async () => {
    const s = fakeStream();
    await runAgent(
      ask("What battles happened at the bridge?", { track: "war", site_slug: "hien-luong" }),
      s.writer,
    );
    const mode = s.annotations.find((a) => a.type === "mode");
    expect(mode).toMatchObject({ refused: true });
    expect(s.annotations.some((a) => a.type === "citation")).toBe(false);
    expect(s.text()).toMatch(/verified, sourced material/);
  });

  it("refuses in Vietnamese when lang is vi", async () => {
    const s = fakeStream();
    await runAgent(
      ask("Có trận đánh nào ở cầu Hiền Lương không?", { lang: "vi", site_slug: "hien-luong" }),
      s.writer,
    );
    expect(s.text()).toMatch(/Mình chưa có tư liệu/);
  });

  it("serves Vietnamese curated content for a vi question", async () => {
    const s = fakeStream();
    await runAgent(ask("Địa đạo Vĩnh Mốc sâu bao nhiêu?", { lang: "vi", site_slug: "vinh-moc" }), s.writer);
    expect(s.text()).toMatch(/Chế độ ngoại tuyến/);
    expect(s.annotations.some((a) => a.type === "citation")).toBe(true);
  });
});

describe("runAgent grounding scope", () => {
  it("grounds on the site named in the question, not the site in context", async () => {
    const s = fakeStream();
    // Standing at Vinh Moc but asking about Hien Luong, which has no content yet.
    await runAgent(ask("Tell me the war history of Hien Luong bridge", { site_slug: "vinh-moc" }), s.writer);
    expect(s.annotations.find((a) => a.type === "mode")).toMatchObject({ refused: true });
    expect(s.text()).toMatch(/about Hien Luong/);
  });

  it("treats a question naming a war site as sensitive even from a nature site", async () => {
    const s = fakeStream();
    await runAgent(ask("What happened at Hien Luong?", { site_slug: "cua-tung" }), s.writer);
    expect(s.annotations.find((a) => a.type === "mode")).toMatchObject({ grounded: true, refused: true });
  });
});

describe("runAgent planning (offline)", () => {
  it("answers 'where next' with recommend_next tool parts instead of refusing on the war track", async () => {
    const parts: string[] = [];
    const s = fakeStream();
    const writer = {
      ...s.writer,
      write(part: string) {
        parts.push(part);
        s.writer.write(part);
      },
    } as unknown as DataStreamWriter;
    await runAgent(ask("Where should I go next?", { track: "war", site_slug: "hien-luong" }), writer);

    expect(s.annotations.find((a) => a.type === "mode")).toMatchObject({ refused: false, offline: true });
    const call = parts.find((p) => p.startsWith("9:"));
    const result = parts.find((p) => p.startsWith("a:"));
    expect(JSON.parse(call!.slice(2))).toMatchObject({ toolName: "recommend_next" });
    const recs = JSON.parse(result!.slice(2)).result.recommendations;
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].slug).toBe("vinh-moc"); // same 17th-parallel story, minutes away
  });
});
