import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { SiteContentSection } from "@/lib/sites";

const SECTIONS = ["overview", "history", "visit_tips"] as const;

async function readSection(lang: "vi" | "en", section: string): Promise<SiteContentSection | null> {
  const path = join(process.cwd(), "content/sites/vinh-moc", lang, `${section}.md`);
  try {
    const raw = await readFile(path, "utf8");
    const fm = matter(raw);
    return {
      section: section as SiteContentSection["section"],
      body: fm.content.trim(),
      source_citation: (fm.data.source_citation as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export async function readVinhMocContent(): Promise<Record<"vi" | "en", SiteContentSection[]>> {
  const [vi, en] = await Promise.all([
    Promise.all(SECTIONS.map((s) => readSection("vi", s))).then((arr) => arr.filter(Boolean) as SiteContentSection[]),
    Promise.all(SECTIONS.map((s) => readSection("en", s))).then((arr) => arr.filter(Boolean) as SiteContentSection[]),
  ]);
  return { vi, en };
}
