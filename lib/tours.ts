import type { ReviewStatus, SiteContentSection } from "@/lib/sites";

/**
 * Audio tours: a site's story as short narrated stops, played in order.
 *
 * A tour comes from `content/sites/<slug>/<lang>/tour.md` when an editor has
 * written one: a narration script that retells the facts of the site's
 * curated sections, nothing more. Its frontmatter names the sections it is
 * `based_on`, and their citations become the tour's sources. Sites without a
 * script get a tour built from the sections themselves.
 *
 * tour.md body format:
 *
 *   ## Stop title
 *   > Where to stand (optional)
 *
 *   Narration…
 */

export type TourSection = SiteContentSection["section"];

export interface TourStop {
  title: string;
  /** Where to stand or what to look at, if the stop is tied to a spot. */
  cue: string | null;
  body: string;
}

export interface Tour {
  lang: "vi" | "en";
  stops: TourStop[];
  /** True for an editor's script; false when built from the sections. */
  authored: boolean;
  review_status: ReviewStatus;
  /** Distinct citations behind the tour, each with its source URLs. */
  citations: { citation: string; sources: string[] }[];
}

/** What tour.md holds once read from disk (scripts/bundle-content.ts). */
export interface TourScript {
  body: string;
  based_on: TourSection[];
  review_status: ReviewStatus;
}

/** Splits a tour.md body into stops. Text before the first `## ` heading is ignored. */
export function parseTourScript(body: string): TourStop[] {
  return body
    .split(/^##\s+/m)
    .slice(1)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const title = lines[0].trim();
      let rest = lines.slice(1).join("\n").trim();
      let cue: string | null = null;
      const quote = /^>\s?(.+)$/m.exec(rest);
      if (quote && rest.startsWith(">")) {
        cue = quote[1].trim();
        rest = rest.slice(quote[0].length).trim();
      }
      return { title, cue, body: rest };
    })
    .filter((s) => s.title && s.body);
}

const AUTO_TITLES: Record<TourSection, { vi: string; en: string }> = {
  overview: { vi: "Giới thiệu", en: "Welcome" },
  history: { vi: "Câu chuyện", en: "The story" },
  culture_notes: { vi: "Phong tục", en: "Customs" },
  visit_tips: { vi: "Trước khi đi", en: "Before you go" },
};
const AUTO_ORDER: TourSection[] = ["overview", "history", "culture_notes", "visit_tips"];

function citationsOf(sections: SiteContentSection[]): Tour["citations"] {
  const byCitation = new Map<string, Set<string>>();
  for (const s of sections) {
    if (!s.source_citation) continue;
    const urls = byCitation.get(s.source_citation) ?? new Set<string>();
    s.sources.forEach((u) => urls.add(u));
    byCitation.set(s.source_citation, urls);
  }
  return [...byCitation].map(([citation, urls]) => ({ citation, sources: [...urls] }));
}

/** A tour read straight from the curated sections: one stop per paragraph group. */
export function tourFromSections(sections: SiteContentSection[], lang: "vi" | "en"): Tour {
  const stops: TourStop[] = [];
  for (const key of AUTO_ORDER) {
    const s = sections.find((x) => x.section === key);
    if (!s) continue;
    const paras = s.body.split(/\n{2,}/).filter((p) => p.trim());
    // Long history sections become several stops so each stays a short listen.
    const parts = key === "history" && paras.length > 1 ? paras.map((p) => [p]) : [paras];
    parts.forEach((part, i) => {
      const title =
        parts.length > 1
          ? `${AUTO_TITLES[key][lang]} · ${i + 1}/${parts.length}`
          : AUTO_TITLES[key][lang];
      stops.push({ title, cue: null, body: part.join("\n\n") });
    });
  }
  return {
    lang,
    stops,
    authored: false,
    review_status: sections.every((s) => s.review_status === "reviewed") ? "reviewed" : "draft",
    citations: citationsOf(sections),
  };
}

/** The editor's script when there is one, else a tour built from the sections. */
export function buildTour(
  sections: SiteContentSection[],
  script: TourScript | null | undefined,
  lang: "vi" | "en",
): Tour | null {
  const stops = script ? parseTourScript(script.body) : [];
  if (script && stops.length) {
    const basis = sections.filter((s) => script.based_on.includes(s.section));
    const reviewed =
      script.review_status === "reviewed" && basis.every((s) => s.review_status === "reviewed");
    return {
      lang,
      stops,
      authored: true,
      review_status: reviewed ? "reviewed" : "draft",
      citations: citationsOf(basis),
    };
  }
  const auto = tourFromSections(sections, lang);
  return auto.stops.length ? auto : null;
}

/** Sentences to queue for speech; short ones are merged to save TTS round-trips. */
export function speechPieces(body: string, minChars = 80): string[] {
  const out: string[] = [];
  let buf = "";
  for (const para of body.split(/\n{2,}/)) {
    // Requiring whitespace after the stop keeps "2.3 km²" and "38,6 mét" whole.
    for (const sentence of para.split(/(?<=[.!?…]["'”)]*)\s+/)) {
      const s = sentence.trim();
      if (!s) continue;
      buf = buf ? `${buf} ${s}` : s;
      if (buf.length >= minChars) {
        out.push(buf);
        buf = "";
      }
    }
    if (buf) {
      out.push(buf);
      buf = "";
    }
  }
  return out;
}

/**
 * Rough listening time for one stop: narration runs at about 130 words a
 * minute in English and 160 syllables in Vietnamese, plus a short pause
 * between sentences and before the next stop.
 */
export function listenSeconds(text: string, lang: "vi" | "en"): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?…]+\s/).length;
  return Math.round((words / (lang === "vi" ? 160 : 130)) * 60 + sentences * 0.6 + 4);
}

export function formatMinutes(seconds: number, lang: "vi" | "en"): string {
  const min = Math.max(1, Math.round(seconds / 60));
  return lang === "vi" ? `${min} phút` : `${min} min`;
}
