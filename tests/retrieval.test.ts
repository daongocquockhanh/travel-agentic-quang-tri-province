import { beforeEach, describe, expect, it } from "vitest";
import { searchCurated, searchLocal, siteMentionedIn, tokenize } from "@/lib/agent/retrieval";

beforeEach(() => {
  // Force the local index; never hit the network from tests.
  delete process.env.OPENAI_API_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
});

describe("tokenize", () => {
  it("drops stopwords and diacritics", () => {
    expect(tokenize("Tell me about the Vĩnh Mốc tunnels")).toEqual(["vinh", "moc", "tunnels"]);
  });
});

describe("searchLocal", () => {
  it("finds the Vinh Moc history chunk for an English question", async () => {
    const hits = await searchLocal({ query: "how many children were born underground", lang: "en" });
    expect(hits[0]?.site_slug).toBe("vinh-moc");
    expect(hits[0]?.section).toBe("history");
    expect(hits[0]?.source_citation).toBeTruthy();
  });

  it("searches Vietnamese content without diacritics in the query", async () => {
    const hits = await searchLocal({ query: "dia dao vinh moc sau bao nhieu met", lang: "vi" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.lang === "vi")).toBe(true);
  });

  it("returns the site's overview first for a generic site-scoped prompt", async () => {
    const hits = await searchLocal({ query: "story please", lang: "en", site_slug: "vinh-moc" });
    expect(hits[0]?.section).toBe("overview");
  });

  it("returns nothing for unrelated queries", async () => {
    expect(await searchLocal({ query: "quantum chromodynamics", lang: "en" })).toEqual([]);
  });
});

describe("searchCurated", () => {
  it("finds content for every catalogue site", async () => {
    const { SAMPLE_SITES } = await import("@/lib/sample-sites");
    for (const site of SAMPLE_SITES) {
      for (const lang of ["vi", "en"] as const) {
        const hits = await searchCurated({ query: "overview", lang, site_slug: site.slug });
        expect(hits.length, `${site.slug}/${lang}`).toBeGreaterThan(0);
        expect(hits.every((h) => h.lang === lang)).toBe(true);
      }
    }
  });

  it("finds the right site for specific facts", async () => {
    expect((await searchCurated({ query: "flag battle flagpole 38.6 metres", lang: "en" }))[0].site_slug).toBe("hien-luong");
    expect((await searchCurated({ query: "nghĩa trang hơn 10.000 phần mộ liệt sĩ", lang: "vi" }))[0].site_slug).toBe("truong-son");
    expect((await searchCurated({ query: "minor basilica 1961 bell tower", lang: "en" }))[0].site_slug).toBe("la-vang");
  });

  it("drops drafts when CONTENT_REQUIRE_REVIEWED=true", async () => {
    process.env.CONTENT_REQUIRE_REVIEWED = "true";
    try {
      expect(await searchCurated({ query: "tunnels", lang: "en", site_slug: "vinh-moc" })).toEqual([]);
    } finally {
      delete process.env.CONTENT_REQUIRE_REVIEWED;
    }
  });
});

describe("siteMentionedIn", () => {
  it.each([
    ["What battles happened at Hien Luong bridge?", "hien-luong"],
    ["Có trận đánh nào ở cầu Hiền Lương không?", "hien-luong"],
    ["Khe Sanh opening hours", "khe-sanh"],
    ["Is the beach nice?", null],
  ])("%s → %s", (q, slug) => {
    expect(siteMentionedIn(q)).toBe(slug);
  });
});
