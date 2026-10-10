// No "server-only": scripts/bundle-content.ts runs this outside a Next build.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { SiteContentSection } from "@/lib/sites";
import type { TourScript, TourSection } from "@/lib/tours";

export type SiteContent = Record<"vi" | "en", SiteContentSection[]>;

const SECTIONS: SiteContentSection["section"][] = [
  "overview",
  "history",
  "visit_tips",
  "culture_notes",
];
const LANGS = ["vi", "en"] as const;

async function readSection(
  dir: string,
  slug: string,
  lang: "vi" | "en",
  section: SiteContentSection["section"],
): Promise<SiteContentSection | null> {
  const path = join(dir, slug, lang, `${section}.md`);
  try {
    const raw = await readFile(path, "utf8");
    const fm = matter(raw);
    return {
      section,
      body: fm.content.trim(),
      source_citation: (fm.data.source_citation as string | undefined) ?? null,
      sources: Array.isArray(fm.data.sources)
        ? fm.data.sources.filter((u: unknown) => typeof u === "string")
        : [],
      // Anything not explicitly marked reviewed is treated as a draft.
      review_status: fm.data.review_status === "reviewed" ? "reviewed" : "draft",
    };
  } catch {
    return null;
  }
}

/** Curated markdown for one site, in canonical section order. Missing files are skipped. */
export async function readSiteContentFromDisk(dir: string, slug: string): Promise<SiteContent> {
  const [vi, en] = await Promise.all(
    LANGS.map((lang) =>
      Promise.all(SECTIONS.map((s) => readSection(dir, slug, lang, s))).then(
        (arr) => arr.filter(Boolean) as SiteContentSection[],
      ),
    ),
  );
  return { vi, en };
}

/** Slugs that have a content directory on disk. */
export async function listSlugsOnDisk(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
  } catch {
    return [];
  }
}

export type SiteTourScripts = Partial<Record<"vi" | "en", TourScript>>;

/** The site's tour.md narration scripts, per language. Missing files are skipped. */
export async function readTourScriptsFromDisk(dir: string, slug: string): Promise<SiteTourScripts> {
  const out: SiteTourScripts = {};
  for (const lang of LANGS) {
    try {
      const fm = matter(await readFile(join(dir, slug, lang, "tour.md"), "utf8"));
      const basedOn = Array.isArray(fm.data.based_on) ? fm.data.based_on : [];
      out[lang] = {
        body: fm.content.trim(),
        based_on: basedOn.filter((s: unknown): s is TourSection =>
          SECTIONS.includes(s as TourSection),
        ),
        review_status: fm.data.review_status === "reviewed" ? "reviewed" : "draft",
      };
    } catch {
      // no script in this language
    }
  }
  return out;
}
