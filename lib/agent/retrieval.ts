import "server-only";
import { embed } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { chunk } from "@/lib/chunk";
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
}

/**
 * With CONTENT_REQUIRE_REVIEWED=true (production), draft sections never
 * reach the agent, so strict-grounded answers rest only on reviewed content.
 */
const allowed = (c: CuratedChunk) =>
  process.env.CONTENT_REQUIRE_REVIEWED !== "true" || c.review_status === "reviewed";

/** Below this cosine similarity a pgvector hit is treated as "no match". */
const MIN_SIMILARITY = 0.25;

const hasVectorBackend = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.OPENAI_API_KEY,
  );

/**
 * Top-k curated chunks for a query. Uses pgvector when Supabase + OpenAI are
 * configured, otherwise a lexical index over `content/sites/**` so the agent
 * stays grounded in local dev. Falls back to the other language when the
 * requested one has no content (the model translates).
 */
export async function searchCurated(args: SearchArgs): Promise<CuratedChunk[]> {
  const k = args.k ?? 5;
  const search = async (lang: Lang) => {
    if (hasVectorBackend()) {
      try {
        return await searchVector({ ...args, lang, k });
      } catch (err) {
        console.warn("[retrieval] vector search failed, using local index:", err);
      }
    }
    return searchLocal({ ...args, lang, k });
  };

  const primary = (await search(args.lang)).filter(allowed);
  const chunks = primary.length ? primary : (await search(args.lang === "vi" ? "en" : "vi")).filter(allowed);
  return chunks.map((c) => ({ ...c, body: scrubChunk(c.body) }));
}

/**
 * Slug of a site the text names explicitly, e.g. "cầu Hiền Lương" → "hien-luong".
 * Matches on the slug words, which are the diacritic-free core of each name.
 */
export function siteMentionedIn(text: string): string | null {
  const norm = ` ${normalizeForMatch(text).replace(/[^a-z0-9]+/g, " ")} `;
  const hit = SAMPLE_SITES.find((s) => norm.includes(` ${s.slug.replace(/-/g, " ")} `));
  return hit?.slug ?? null;
}

// ── pgvector ─────────────────────────────────────────────────────

async function searchVector(args: Required<Pick<SearchArgs, "query" | "lang" | "k">> & SearchArgs) {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { embedding } = await embed({
    model: openai.embedding(process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"),
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
  return ((data ?? []) as Row[])
    .filter((r) => r.similarity >= MIN_SIMILARITY)
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
  terms: Map<string, number>;
  length: number;
}

const STOPWORDS = new Set([
  // en
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "is", "are", "was", "were", "it",
  "this", "that", "for", "with", "about", "me", "my", "you", "your", "tell", "what", "how",
  "when", "where", "why", "who", "can", "do", "does", "did", "i", "we", "here", "there", "please",
  // vi (diacritic-stripped)
  "la", "va", "cua", "co", "khong", "nhung", "cac", "mot", "toi", "minh", "ban", "o", "day",
  "do", "nay", "gi", "nao", "the", "ve", "cho", "voi", "duoc", "trong", "hay", "ke",
]);

export function tokenize(text: string): string[] {
  return normalizeForMatch(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

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
        for (const body of chunk(sec.body)) {
          const terms = new Map<string, number>();
          const tokens = tokenize(`${names} ${body}`);
          for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1);
          out.push({
            site_slug: slug,
            section: sec.section,
            lang,
            body,
            source_citation: sec.source_citation,
            review_status: sec.review_status,
            terms,
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

  const queryTerms = [...new Set(tokenize(args.query))];
  const avgLen = pool.reduce((n, c) => n + c.length, 0) / pool.length;
  const K1 = 1.2;
  const B = 0.75;

  const scored = pool
    .map((c) => {
      let score = 0;
      for (const t of queryTerms) {
        const tf = c.terms.get(t) ?? 0;
        if (!tf) continue;
        const df = pool.filter((p) => p.terms.has(t)).length;
        const idf = Math.log(1 + (pool.length - df + 0.5) / (df + 0.5));
        score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * c.length) / avgLen)));
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
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
