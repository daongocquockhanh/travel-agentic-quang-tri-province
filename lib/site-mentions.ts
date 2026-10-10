import { normalizeForMatch } from "@/lib/agent/guards";
import { SAMPLE_SITES } from "@/lib/sample-sites";

/**
 * Other names travellers use for places whose story lives in a site's content
 * (diacritic-free, lowercase). The Quảng Trị Citadel is told under Thạch Hãn.
 */
const SITE_ALIASES: Record<string, string[]> = {
  "thach-han": ["citadel", "thanh co", "quang tri citadel"],
  "hien-luong": ["ben hai", "17th parallel bridge", "cau hien luong"],
  "truong-son": ["truong son cemetery", "nghia trang truong son"],
  "con-co": ["hero island", "dao anh hung"],
};

const names = (slug: string) => [slug.replace(/-/g, " "), ...(SITE_ALIASES[slug] ?? [])];
const normalize = (text: string) => ` ${normalizeForMatch(text).replace(/[^a-z0-9]+/g, " ")} `;

/**
 * Slug of a site the text names explicitly, e.g. "cầu Hiền Lương" → "hien-luong".
 * Matches on the slug words, which are the diacritic-free core of each name.
 */
export function siteMentionedIn(text: string): string | null {
  const norm = normalize(text);
  return SAMPLE_SITES.find((s) => names(s.slug).some((n) => norm.includes(` ${n} `)))?.slug ?? null;
}

/** Every site the text names, in the order they first appear. Client-safe (chat place cards). */
export function sitesMentionedIn(text: string): string[] {
  const norm = normalize(text);
  return SAMPLE_SITES.map((s) => ({
    slug: s.slug,
    at: Math.min(
      ...names(s.slug)
        .map((n) => norm.indexOf(` ${n} `))
        .filter((i) => i >= 0),
    ),
  }))
    .filter((x) => Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at)
    .map((x) => x.slug);
}

const MAX_CARDS = 3;

/**
 * Places an answer talks about, worth a card. Đông Hà is mostly a reference
 * point ("30 km north of Đông Hà"), so it only counts when nothing else is named.
 */
export function placesInAnswer(text: string, exclude: string[] = []): string[] {
  const found = sitesMentionedIn(text).filter((s) => !exclude.includes(s));
  const withoutHub = found.filter((s) => s !== "dong-ha");
  return (withoutHub.length ? withoutHub : found).slice(0, MAX_CARDS);
}
