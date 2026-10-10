import "server-only";
import { embed } from "ai";
import { embeddingModel, hasAiKey, minVectorSimilarity } from "@/lib/ai/provider";
import { createClient } from "@supabase/supabase-js";
import { contextualize, passages } from "@/lib/chunk";
import { listContentSlugs, readSiteContent } from "@/lib/content";
import { SAMPLE_SITES } from "@/lib/sample-sites";
import { normalizeForMatch, scrubChunk } from "@/lib/agent/guards";
import type { CuratedChunk, Lang, Section } from "@/lib/agent/types";
import type { TrackKey } from "@/lib/tracks";

export interface SearchArgs {
  query: string;
  lang: Lang;
  site_slug?: string;
  section?: Section;
  k?: number;
  /**
   * Lexical search only: the share of the query's terms a chunk must contain.
   * Used for unscoped sensitive questions, so "battle of Hamburger Hill" doesn't
   * ground on Hiền Lương's "flag battle". (pgvector uses minVectorSimilarity() instead.)
   */
  minCoverage?: number;
}

/**
 * With CONTENT_REQUIRE_REVIEWED=true (production), draft sections never
 * reach the agent, so strict-grounded answers rest only on reviewed content.
 */
const allowed = (c: CuratedChunk) =>
  process.env.CONTENT_REQUIRE_REVIEWED !== "true" || c.review_status === "reviewed";

const hasVectorBackend = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && hasAiKey(),
  );

/**
 * Top-k curated chunks for a query. Uses pgvector when Supabase + an AI key are
 * configured, otherwise a lexical index over `content/sites/**` so the agent
 * stays grounded in local dev. Falls back to the other language when the
 * requested one has no content (the model translates).
 */
export async function searchCurated(args: SearchArgs): Promise<CuratedChunk[]> {
  const k = args.k ?? 5;
  const search = async (lang: Lang) => {
    if (hasVectorBackend()) {
      try {
        // Hybrid: vector search finds paraphrases, keyword search finds exact names and
        // dates; reciprocal rank fusion keeps what either ranks highly.
        const [vector, lexical] = await Promise.all([
          searchVector({ ...args, lang, k: k * 2 }),
          searchLocal({ ...args, lang, k: k * 2 }),
        ]);
        return fuseRankings([vector, lexical], k);
      } catch (err) {
        console.warn("[retrieval] vector search failed, using local index:", err);
      }
    }
    return searchLocal({ ...args, lang, k });
  };

  const primary = (await search(args.lang)).filter(allowed);
  const chunks = primary.length
    ? primary
    : (await search(args.lang === "vi" ? "en" : "vi")).filter(allowed);
  return chunks.map((c) => ({ ...c, body: scrubChunk(c.body) }));
}

export { siteMentionedIn } from "@/lib/site-mentions";

/**
 * Reciprocal rank fusion: each list contributes 1 / (60 + rank) per passage.
 * Robust to the two retrievers' incomparable score scales. Exported for tests.
 */
export function fuseRankings(lists: CuratedChunk[][], k: number): CuratedChunk[] {
  const key = (c: CuratedChunk) => `${c.site_slug}|${c.section}|${c.lang}|${c.body.slice(0, 80)}`;
  const fused = new Map<string, { chunk: CuratedChunk; score: number }>();
  for (const list of lists) {
    list.forEach((c, rank) => {
      const entry = fused.get(key(c)) ?? { chunk: c, score: 0 };
      entry.score += 1 / (60 + rank + 1);
      fused.set(key(c), entry);
    });
  }
  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk, score }) => ({ ...chunk, score }));
}

// ── pgvector ─────────────────────────────────────────────────────

async function searchVector(args: Required<Pick<SearchArgs, "query" | "lang" | "k">> & SearchArgs) {
  const { embedding } = await embed({
    model: embeddingModel("query"),
    value: args.query,
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc("search_curated", {
    p_embedding: embedding,
    p_lang: args.lang,
    p_site_slug: args.site_slug ?? null,
    p_section: args.section ?? null,
    p_k: args.k,
  });
  if (error) throw error;

  type Row = {
    site_slug: string;
    section: Section;
    body: string;
    source_citation: string | null;
    review_status: string | null;
    similarity: number;
  };
  const minSimilarity = minVectorSimilarity();
  return ((data ?? []) as Row[])
    .filter((r) => r.similarity >= minSimilarity)
    .map<CuratedChunk>((r) => ({
      site_slug: r.site_slug,
      section: r.section,
      lang: args.lang,
      body: r.body,
      source_citation: r.source_citation,
      review_status: r.review_status === "reviewed" ? "reviewed" : "draft",
      score: r.similarity,
    }));
}

// ── local lexical index ──────────────────────────────────────────

interface IndexedChunk extends Omit<CuratedChunk, "score"> {
  /** Diacritic-free terms, for queries typed without accents ("dia dao vinh moc"). */
  terms: Map<string, number>;
  /** Terms with their diacritics, for accented queries: keeps "đồi" (hill) apart from "đội" (unit). */
  exactTerms: Map<string, number>;
  length: number;
}

const STOPWORDS = new Set([
  // en
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "is",
  "are",
  "was",
  "were",
  "it",
  "this",
  "that",
  "for",
  "with",
  "about",
  "me",
  "my",
  "you",
  "your",
  "tell",
  "what",
  "how",
  "when",
  "where",
  "why",
  "who",
  "can",
  "do",
  "does",
  "did",
  "i",
  "we",
  "here",
  "there",
  "please",
  // vi (diacritic-stripped)
  "la",
  "va",
  "cua",
  "co",
  "khong",
  "nhung",
  "cac",
  "mot",
  "toi",
  "minh",
  "ban",
  "o",
  "day",
  "do",
  "nay",
  "gi",
  "nao",
  "the",
  "ve",
  "cho",
  "voi",
  "duoc",
  "trong",
  "hay",
  "ke",
]);

export function tokenize(text: string): string[] {
  return normalizeForMatch(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Lowercase words that keep their diacritics; stopwords judged on the stripped form. */
export function tokenizeExact(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(normalizeForMatch(t)));
}

const hasDiacritics = (text: string) => normalizeForMatch(text) !== text.toLowerCase();

const count = (tokens: string[]) => {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
};

let indexPromise: Promise<IndexedChunk[]> | null = null;

async function buildIndex(): Promise<IndexedChunk[]> {
  const slugs = await listContentSlugs();
  const out: IndexedChunk[] = [];
  for (const slug of slugs) {
    const site = SAMPLE_SITES.find((s) => s.slug === slug);
    const names = site ? `${site.name_en} ${site.name_vi}` : slug;
    const content = await readSiteContent(slug);
    for (const lang of ["vi", "en"] as const) {
      for (const sec of content[lang]) {
        for (const body of passages(sec.body)) {
          const text = contextualize(body, { names, section: sec.section });
          const tokens = tokenize(text);
          const terms = count(tokens);
          const exactTerms = count(tokenizeExact(text));
          out.push({
            site_slug: slug,
            section: sec.section,
            lang,
            body,
            source_citation: sec.source_citation,
            review_status: sec.review_status,
            terms,
            exactTerms,
            length: tokens.length,
          });
        }
      }
    }
  }
  return out;
}

function getIndex() {
  // Rebuild on every call in dev so content edits show up without a restart.
  if (!indexPromise || process.env.NODE_ENV === "development") indexPromise = buildIndex();
  return indexPromise;
}

/** BM25 over the curated markdown. Exported for tests. */
export async function searchLocal(args: SearchArgs): Promise<CuratedChunk[]> {
  const k = args.k ?? 5;
  const all = await getIndex();
  const pool = all.filter(
    (c) =>
      c.lang === args.lang &&
      (!args.site_slug || c.site_slug === args.site_slug) &&
      (!args.section || c.section === args.section),
  );
  if (!pool.length) return [];

  // An accented query is matched accent-exact; a plain-ASCII one, loosely.
  const exact = hasDiacritics(args.query);
  const queryTerms = [...new Set(exact ? tokenizeExact(args.query) : tokenize(args.query))];
  const termsOf = (c: IndexedChunk) => (exact ? c.exactTerms : c.terms);
  const avgLen = pool.reduce((n, c) => n + c.length, 0) / pool.length;
  const K1 = 1.2;
  const B = 0.75;

  // Terms that appear nowhere in the pool get the highest weight: the content can't answer them.
  const idf = new Map(
    queryTerms.map((t) => {
      const df = pool.filter((p) => termsOf(p).has(t)).length;
      return [t, Math.log(1 + (pool.length - df + 0.5) / (df + 0.5))];
    }),
  );
  const totalIdf = [...idf.values()].reduce((a, b) => a + b, 0);

  const scored = pool
    .map((c) => {
      let score = 0;
      let matchedIdf = 0;
      for (const t of queryTerms) {
        const tf = termsOf(c).get(t) ?? 0;
        if (!tf) continue;
        matchedIdf += idf.get(t)!;
        score += idf.get(t)! * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * c.length) / avgLen)));
      }
      // Coverage weighted by rarity: missing "massacre" counts far more than missing "people".
      return { c, score, coverage: totalIdf ? matchedIdf / totalIdf : 0 };
    })
    .filter(
      (x) =>
        x.score > 0 &&
        (!args.minCoverage || queryTerms.length < 2 || x.coverage >= args.minCoverage),
    )
    .sort((a, b) => b.score - a.score);

  // Scoped to a site but the query has no lexical overlap ("tell me the story"):
  // the site's own overview + history are the relevant material by definition.
  if (!scored.length && args.site_slug) {
    const order: Section[] = ["overview", "history", "culture_notes", "visit_tips"];
    return pool
      .slice()
      .sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section))
      .slice(0, k)
      .map((c) => toChunk(c, 0.01));
  }

  return scored.slice(0, k).map(({ c, score }) => toChunk(c, score));
}

function toChunk(c: IndexedChunk, score: number): CuratedChunk {
  return {
    site_slug: c.site_slug,
    section: c.section,
    lang: c.lang,
    body: c.body,
    source_citation: c.source_citation,
    review_status: c.review_status,
    score,
  };
}

// ── content gaps ─────────────────────────────────────────────────

/** Record an unanswerable sensitive question for editors (SYSTEM_DESIGN §8.1). */
export async function logContentGap(gap: {
  query: string;
  track: TrackKey;
  lang: Lang;
  site_slug?: string | null;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.info("[content_gap]", JSON.stringify(gap));
    return;
  }
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.from("content_gaps").insert({
      query: gap.query.slice(0, 1000),
      track: gap.track,
      lang: gap.lang,
      site_slug: gap.site_slug ?? null,
    });
    if (error) throw error;
  } catch (err) {
    console.warn("[content_gap] insert failed:", err);
  }
}
