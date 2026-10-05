import "server-only";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { SiteContentSection } from "@/lib/sites";

const CONTENT_DIR = join(process.cwd(), "content/sites");
const SECTIONS: SiteContentSection["section"][] = ["overview", "history", "visit_tips", "culture_notes"];
const LANGS = ["vi", "en"] as const;

async function readSection(
  slug: string,
  lang: "vi" | "en",
  section: SiteContentSection["section"],
): Promise<SiteContentSection | null> {
  const path = join(CONTENT_DIR, slug, lang, `${section}.md`);
  try {
    const raw = await readFile(path, "utf8");
    const fm = matter(raw);
    return {
      section,
      body: fm.content.trim(),
      source_citation: (fm.data.source_citation as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/** Curated markdown for one site, in canonical section order. Missing files are skipped. */
export async function readSiteContent(slug: string): Promise<Record<"vi" | "en", SiteContentSection[]>> {
  const [vi, en] = await Promise.all(
    LANGS.map((lang) =>
      Promise.all(SECTIONS.map((s) => readSection(slug, lang, s))).then(
        (arr) => arr.filter(Boolean) as SiteContentSection[],
      ),
    ),
  );
  return { vi, en };
}

/** Slugs that have a content directory on disk. */
export async function listContentSlugs(): Promise<string[]> {
  try {
    const entries = await readdir(CONTENT_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
  } catch {
    return [];
  }
}
