/**
 * Ingest script — reads content/sites/<slug>/{meta.yml, <lang>/<section>.md},
 * chunks markdown, embeds via OpenAI, upserts into Supabase.
 *
 * Usage:  bun run scripts/ingest.ts
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *   OPENAI_EMBEDDING_MODEL (default: text-embedding-3-small)
 * Optional:
 *   INGEST_REQUIRE_REVIEWED=1  refuse to ingest unless every section is reviewed (production)
 *
 * Runs the editorial checks (lib/content-check.ts) first and writes nothing if they fail.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import matter from "gray-matter";
import YAML from "yaml";
import { chunk } from "../lib/chunk";
import { checkContent } from "../lib/content-check";

const CONTENT_DIR = join(process.cwd(), "content/sites");
const REQUIRES_CITATION = new Set(["war", "religious"]);
const SECTIONS = ["overview", "history", "visit_tips", "culture_notes"] as const;
type Section = (typeof SECTIONS)[number];
const LANGS = ["vi", "en"] as const;

interface SiteMeta {
  slug: string;
  name_vi: string;
  name_en: string;
  type: string;
  tracks: string[];
  geom: { lat: number; lng: number };
  hero_image?: string | null;
  /** Free-text hours, e.g. "7:00–16:30". Stored as {text} when opening_hours is absent. */
  hours?: string;
  opening_hours?: Record<string, string> | null;
  ticket_price_vnd?: number | null;
}

const env = (key: string, fallback?: string) => {
  const v = process.env[key];
  if (!v && fallback === undefined) throw new Error(`Missing env var ${key}`);
  return v ?? fallback!;
};

const supabase = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

const openai = new OpenAI({ apiKey: env("OPENAI_API_KEY") });
const EMBEDDING_MODEL = env("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small");

async function embed(input: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input });
  return res.data[0].embedding;
}

async function loadMeta(slug: string): Promise<SiteMeta> {
  const path = join(CONTENT_DIR, slug, "meta.yml");
  const raw = await readFile(path, "utf8");
  const parsed = YAML.parse(raw) as SiteMeta;
  if (!parsed.slug || parsed.slug !== slug) {
    throw new Error(`meta.yml slug mismatch for ${slug}`);
  }
  if (!parsed.geom?.lat || !parsed.geom?.lng) {
    throw new Error(`meta.yml missing geom.lat/lng for ${slug}`);
  }
  return parsed;
}

async function ingestSite(slug: string) {
  console.log(`\n==> ${slug}`);
  const meta = await loadMeta(slug);

  const { data: siteId, error: upsertErr } = await supabase.rpc("upsert_site", {
    p_slug: meta.slug,
    p_name_vi: meta.name_vi,
    p_name_en: meta.name_en,
    p_type: meta.type,
    p_tracks: meta.tracks,
    p_lat: meta.geom.lat,
    p_lng: meta.geom.lng,
    p_hero_image: meta.hero_image ?? null,
    p_opening_hours: meta.opening_hours ?? (meta.hours ? { text: meta.hours } : null),
    p_ticket_price_vnd: meta.ticket_price_vnd ?? null,
  });
  if (upsertErr) throw upsertErr;
  if (!siteId) throw new Error(`upsert_site returned no id for ${slug}`);
  console.log(`   site_id = ${siteId}`);

  for (const lang of LANGS) {
    const langDir = join(CONTENT_DIR, slug, lang);
    let entries: string[];
    try {
      entries = await readdir(langDir);
    } catch {
      console.log(`   (no ${lang}/ dir, skipping)`);
      continue;
    }

    // wipe existing for idempotency
    const { error: clearErr } = await supabase.rpc("replace_site_content", {
      p_site_id: siteId,
      p_lang: lang,
    });
    if (clearErr) throw clearErr;

    for (const file of entries) {
      if (!file.endsWith(".md")) continue;
      const section = file.replace(/\.md$/, "") as Section;
      if (!SECTIONS.includes(section)) {
        console.warn(`   skip unknown section: ${file}`);
        continue;
      }

      const md = await readFile(join(langDir, file), "utf8");
      const fm = matter(md);
      const body = fm.content.trim();
      const sourceCitation =
        (fm.data.source_citation as string | undefined) ?? null;

      const isSensitive = REQUIRES_CITATION.has(meta.type);
      if (isSensitive && (section === "history" || section === "overview") && !sourceCitation) {
        throw new Error(
          `Missing source_citation in ${slug}/${lang}/${file} (type=${meta.type} requires citation for ${section})`,
        );
      }

      const chunks = chunk(body);
      console.log(`   ${lang}/${section}: ${chunks.length} chunk(s)`);

      const rows = await Promise.all(
        chunks.map(async (c, idx) => ({
          site_id: siteId,
          lang,
          section,
          body: c,
          embedding: await embed(c),
          source_citation: sourceCitation,
          review_status: fm.data.review_status === "reviewed" ? "reviewed" : "draft",
          sources: Array.isArray(fm.data.sources) ? fm.data.sources : [],
          chunk_index: idx,
        })),
      );

      const { error: insErr } = await supabase.from("site_content").insert(rows);
      if (insErr) throw insErr;
    }
  }
  console.log(`   done.`);
}

async function main() {
  const strict = process.env.INGEST_REQUIRE_REVIEWED === "1";
  const report = await checkContent(CONTENT_DIR, { strict });
  if (report.errors.length) {
    for (const e of report.errors) console.error(`  ERROR ${e}`);
    console.error(`\nContent check failed (${report.errors.length} error(s)${strict ? ", strict" : ""}). Nothing ingested.`);
    process.exit(1);
  }

  let entries: string[];
  try {
    entries = await readdir(CONTENT_DIR);
  } catch {
    console.error(`No content/sites directory at ${CONTENT_DIR}`);
    process.exit(1);
  }

  const slugs = entries.filter((e) => !e.startsWith("."));
  if (!slugs.length) {
    console.log("No site directories found. Nothing to ingest.");
    return;
  }

  for (const slug of slugs) {
    try {
      await ingestSite(slug);
    } catch (err) {
      console.error(`!! Failed ${slug}:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
  console.log("\nIngest complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
