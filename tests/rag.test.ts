import { describe, expect, it } from "vitest";
import { contextualize, passages, PASSAGE_CHARS } from "@/lib/chunk";
import { retrievalQuery, siteFromHistory } from "@/lib/agent/run";
import { fuseRankings, searchLocal } from "@/lib/agent/retrieval";
import type { CuratedChunk } from "@/lib/agent/types";

const turn = (role: "user" | "assistant", content: string) => ({ role, content });

describe("conversation-aware retrieval", () => {
  it("carries the subject of earlier turns into a follow-up", () => {
    const history = [
      turn("user", "Tell me about the Vinh Moc tunnels."),
      turn("assistant", "They are an underground village."),
      turn("user", "How many children were born there?"),
    ];
    expect(siteFromHistory(history)).toBe("vinh-moc");
    expect(retrievalQuery("How many children were born there?", history)).toContain("Vinh Moc");
  });

  it("picks up a site the guide named, not only the user", () => {
    const history = [
      turn("user", "Where should I go first?"),
      turn("assistant", "Start at Hien Luong bridge, on the 17th parallel."),
      turn("user", "Why is it painted in two colours?"),
    ];
    expect(siteFromHistory(history)).toBe("hien-luong");
  });

  it("leaves self-contained questions alone", () => {
    const history = [
      turn("user", "Tell me about La Vang."),
      turn("assistant", "A pilgrimage site."),
      turn(
        "user",
        "What were the opening dates of the Truong Son National Martyrs Cemetery construction works?",
      ),
    ];
    const q = history[2].content;
    expect(retrievalQuery(q, history)).toBe(q);
  });

  it("works for Vietnamese follow-ups", () => {
    const history = [
      turn("user", "Kể cho tôi về địa đạo Vĩnh Mốc."),
      turn("assistant", "Đó là một làng ngầm."),
      turn("user", "Ở đó có bao nhiêu em bé chào đời?"),
    ];
    expect(siteFromHistory(history)).toBe("vinh-moc");
    expect(retrievalQuery(history[2].content, history)).toContain("Vĩnh Mốc");
  });
});

describe("passages", () => {
  it("splits long sections into paragraph-sized passages", () => {
    const text = Array.from({ length: 5 }, (_, i) => `Paragraph ${i} `.repeat(30).trim()).join(
      "\n\n",
    );
    const parts = passages(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= PASSAGE_CHARS + 50)).toBe(true);
  });

  it("indexes each passage with its site and section", () => {
    const t = contextualize("The boat leaves at seven.", {
      names: "Con Co Island Đảo Cồn Cỏ",
      section: "visit_tips",
    });
    expect(t).toContain("Con Co Island");
    expect(t).toContain("visit tips");
  });

  it("returns the paragraph that answers, not the whole section", async () => {
    const [hit] = await searchLocal({
      query: "flag battle flagpole 38.6 metres",
      lang: "en",
      site_slug: "hien-luong",
    });
    expect(hit.body).toContain("38.6");
    expect(hit.body).not.toContain("restored to its original design in 2001");
  });
});

describe("fuseRankings", () => {
  const c = (id: string): CuratedChunk => ({
    site_slug: id,
    section: "overview",
    lang: "en",
    body: id,
    source_citation: null,
    review_status: "draft",
    score: 0,
  });

  it("ranks passages both retrievers agree on first", () => {
    const fused = fuseRankings(
      [
        [c("a"), c("b"), c("c")],
        [c("b"), c("d"), c("a")],
      ],
      3,
    );
    expect(fused.map((x) => x.site_slug)).toEqual(["b", "a", "d"]);
  });

  it("keeps a strong hit from either side", () => {
    const fused = fuseRankings([[c("vector-only")], [c("keyword-only")]], 2);
    expect(fused.map((x) => x.site_slug).sort()).toEqual(["keyword-only", "vector-only"]);
  });
});
