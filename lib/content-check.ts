import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { haversineMeters } from "./geo";
import { SAMPLE_SITES } from "./sample-sites";
import { parseTourScript } from "./tours";

/**
 * Editorial checks for content/sites. Run by `bun run content:check`, by the
 * ingest script before it writes anything, and by the test suite.
 *
 * Errors block ingest. Warnings are for editors. In strict mode (production
 * ingest) unreviewed sections are errors too.
 */

export const SECTIONS = ["overview", "history", "visit_tips", "culture_notes"] as const;
export const REQUIRED_SECTIONS = ["overview", "history", "visit_tips"] as const;
const LANGS = ["vi", "en"] as const;
const TYPES = ["war", "cultural", "religious", "nature", "food", "city"];
const TRACKS = ["war", "foreign", "domestic"];
/** Sections that make historical or religious claims and so need a citation on sensitive sites. */
const CITED_SECTIONS = new Set(["overview", "history", "culture_notes"]);
const SENSITIVE_TYPES = new Set(["war", "religious"]);
/** The merged Quảng Trị province (incl. former Quảng Bình) plus Cồn Cỏ, with margin. */
const BBOX = { minLat: 16.0, maxLat: 18.2, minLng: 105.5, maxLng: 107.7 };
const MIN_BODY_CHARS = 150;

export interface SiteMeta {
  slug: string;
  name_vi: string;
  name_en: string;
  type: string;
  tracks: string[];
  geom: { lat: number; lng: number };
  hours?: string;
  hero_image?: string | null;
  opening_hours?: Record<string, string> | null;
  ticket_price_vnd?: number | null;
}

export interface ContentReport {
  errors: string[];
  warnings: string[];
  /** slug → lang → section → review status, for summaries. */
  status: Record<string, Record<string, Record<string, "draft" | "reviewed">>>;
}

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

export async function checkContent(
  contentDir: string,
  opts: { strict?: boolean } = {},
): Promise<ContentReport> {
  const report: ContentReport = { errors: [], warnings: [], status: {} };
  const err = (m: string) => report.errors.push(m);
  const warn = (m: string) => report.warnings.push(m);

  const dirs = (await readdir(contentDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);

  for (const site of SAMPLE_SITES) {
    if (!dirs.includes(site.slug))
      err(`${site.slug}: no content directory (every catalogue site needs one)`);
  }

  for (const slug of dirs) {
    const where = (p: string) => `${slug}/${p}`;
    const metaPath = join(contentDir, slug, "meta.yml");
    if (!(await exists(metaPath))) {
      err(`${where("meta.yml")}: missing`);
      continue;
    }

    let meta: SiteMeta;
    try {
      meta = YAML.parse(await readFile(metaPath, "utf8")) as SiteMeta;
    } catch (e) {
      err(`${where("meta.yml")}: invalid YAML (${(e as Error).message})`);
      continue;
    }

    if (meta.slug !== slug)
      err(`${where("meta.yml")}: slug "${meta.slug}" does not match directory`);
    if (!meta.name_vi || !meta.name_en)
      err(`${where("meta.yml")}: name_vi and name_en are required`);
    if (!TYPES.includes(meta.type))
      err(`${where("meta.yml")}: type must be one of ${TYPES.join(", ")}`);
    if (
      !Array.isArray(meta.tracks) ||
      !meta.tracks.length ||
      meta.tracks.some((t) => !TRACKS.includes(t))
    ) {
      err(`${where("meta.yml")}: tracks must be a non-empty subset of ${TRACKS.join(", ")}`);
    }
    const { lat, lng } = meta.geom ?? ({} as SiteMeta["geom"]);
    if (!(lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng)) {
      err(`${where("meta.yml")}: geom ${lat},${lng} is outside Quảng Trị`);
    }

    // meta.yml and the app catalogue must agree, or the map and the agent disagree.
    const cat = SAMPLE_SITES.find((s) => s.slug === slug);
    if (!cat) {
      err(`${slug}: not in lib/sample-sites.ts (the app catalogue)`);
    } else {
      if (cat.name_vi !== meta.name_vi || cat.name_en !== meta.name_en) {
        err(
          `${where("meta.yml")}: names differ from the catalogue ("${cat.name_vi}" / "${cat.name_en}")`,
        );
      }
      if (cat.type !== meta.type)
        err(`${where("meta.yml")}: type differs from the catalogue (${cat.type})`);
      if ([...cat.tracks].sort().join() !== [...(meta.tracks ?? [])].sort().join()) {
        err(`${where("meta.yml")}: tracks differ from the catalogue (${cat.tracks.join(", ")})`);
      }
      if (lat != null && lng != null && haversineMeters({ lat, lng }, cat) > 500) {
        err(`${where("meta.yml")}: geom is more than 500 m from the catalogue position`);
      }
    }

    const sensitive = SENSITIVE_TYPES.has(meta.type);
    const sectionsByLang: Record<string, string[]> = {};
    report.status[slug] = {};

    for (const lang of LANGS) {
      const langDir = join(contentDir, slug, lang);
      const files = (await exists(langDir))
        ? (await readdir(langDir)).filter((f) => f.endsWith(".md"))
        : [];
      sectionsByLang[lang] = [];
      report.status[slug][lang] = {};

      for (const required of REQUIRED_SECTIONS) {
        if (!files.includes(`${required}.md`))
          err(`${where(`${lang}/${required}.md`)}: missing (required)`);
      }

      for (const file of files) {
        if (file === "tour.md") continue; // checked below, once the sections are known
        const section = file.replace(/\.md$/, "");
        const p = where(`${lang}/${file}`);
        if (!(SECTIONS as readonly string[]).includes(section)) {
          err(`${p}: unknown section (allowed: ${SECTIONS.join(", ")})`);
          continue;
        }
        sectionsByLang[lang].push(section);

        const fm = matter(await readFile(join(langDir, file), "utf8"));
        const data = fm.data as Record<string, unknown>;
        const body = fm.content.trim();

        if (data.section !== section)
          err(`${p}: frontmatter section "${data.section}" should be "${section}"`);
        if (data.lang !== lang) err(`${p}: frontmatter lang "${data.lang}" should be "${lang}"`);

        const status = data.review_status;
        if (status !== "draft" && status !== "reviewed") {
          err(`${p}: review_status must be "draft" or "reviewed"`);
        }
        report.status[slug][lang][section] = status === "reviewed" ? "reviewed" : "draft";
        if (status !== "reviewed") {
          (opts.strict ? err : warn)(`${p}: not yet reviewed`);
        }

        if (sensitive && CITED_SECTIONS.has(section) && !data.source_citation) {
          err(`${p}: source_citation is required (type=${meta.type})`);
        }
        if (data.sources !== undefined) {
          const urls = Array.isArray(data.sources) ? data.sources : [];
          if (
            !Array.isArray(data.sources) ||
            urls.some((u) => typeof u !== "string" || !/^https?:\/\//.test(u))
          ) {
            err(`${p}: sources must be a list of http(s) URLs`);
          }
        } else if (sensitive && CITED_SECTIONS.has(section)) {
          warn(`${p}: no sources list; add the URLs behind the citation`);
        }

        if (body.length < MIN_BODY_CHARS) warn(`${p}: only ${body.length} characters`);
        if (/\b(TODO|TBD|FIXME|lorem ipsum)\b/i.test(body))
          err(`${p}: contains a placeholder (TODO/TBD/FIXME)`);
      }
    }

    // Audio tour scripts (lib/tours.ts): optional, but in both languages if at all.
    const stopsByLang: Record<string, number> = {};
    for (const lang of LANGS) {
      const path = join(contentDir, slug, lang, "tour.md");
      if (!(await exists(path))) continue;
      const p = where(`${lang}/tour.md`);
      const fm = matter(await readFile(path, "utf8"));
      const data = fm.data as Record<string, unknown>;
      if (data.section !== "tour")
        err(`${p}: frontmatter section "${data.section}" should be "tour"`);
      if (data.lang !== lang) err(`${p}: frontmatter lang "${data.lang}" should be "${lang}"`);
      if (data.review_status !== "draft" && data.review_status !== "reviewed") {
        err(`${p}: review_status must be "draft" or "reviewed"`);
      } else if (data.review_status !== "reviewed") {
        (opts.strict ? err : warn)(`${p}: not yet reviewed`);
      }
      // A script retells its sections; their citations are the tour's sources.
      const basedOn = Array.isArray(data.based_on) ? (data.based_on as unknown[]) : [];
      if (!basedOn.length) err(`${p}: based_on must list the sections the script retells`);
      for (const b of basedOn) {
        if (!sectionsByLang[lang].includes(String(b)))
          err(`${p}: based_on "${String(b)}" is not a section of this site`);
      }
      const stops = parseTourScript(fm.content);
      stopsByLang[lang] = stops.length;
      if (stops.length < 2) err(`${p}: needs at least two "## " stops`);
      for (const stop of stops) {
        if (stop.body.length < 80)
          warn(`${p}: stop "${stop.title}" is only ${stop.body.length} characters`);
      }
      if (/\b(TODO|TBD|FIXME|lorem ipsum)\b/i.test(fm.content))
        err(`${p}: contains a placeholder (TODO/TBD/FIXME)`);
    }
    if (Object.keys(stopsByLang).length === 1) {
      err(
        `${slug}: tour.md exists in ${Object.keys(stopsByLang)[0]} only; write it in both languages`,
      );
    } else if (stopsByLang.vi !== undefined && stopsByLang.vi !== stopsByLang.en) {
      warn(`${slug}: tour has ${stopsByLang.vi} stops in vi but ${stopsByLang.en} in en`);
    }

    const vi = [...sectionsByLang.vi].sort().join();
    const en = [...sectionsByLang.en].sort().join();
    if (vi !== en)
      err(`${slug}: vi has [${vi}] but en has [${en}]; both languages need the same sections`);
  }

  return report;
}
