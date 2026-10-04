import type { TrackKey } from "@/lib/tracks";
import type { SiteType } from "@/lib/agent/types";

/** Per-message input cap (SYSTEM_DESIGN §8.2). */
export const MAX_MESSAGE_CHARS = 4000;
/** How many prior turns we forward to the model. Keeps sessions inside the token budget. */
export const MAX_HISTORY_MESSAGES = 12;

const SENSITIVE_SITE_TYPES: ReadonlySet<SiteType> = new Set(["war", "religious"]);

/**
 * Keyword lists for topics that must be answered from curated content only.
 * Matched against lowercase, diacritic-stripped text, so Vietnamese terms are
 * written without tone marks here.
 */
const SENSITIVE_TERMS: Record<"war" | "religious" | "ethnic", string[]> = {
  war: [
    "war", "wartime", "bomb", "bombing", "bombed", "battle", "soldier", "soldiers", "veteran",
    "veterans", "dmz", "demilitari[sz]ed", "17th parallel", "geneva", "viet cong", "nva",
    "marines?", "napalm", "massacre", "casualt(y|ies)", "martyrs?", "siege", "combat", "military",
    "chien tranh", "khang chien", "bom", "tran danh", "liet si", "bo doi", "vi tuyen",
    "chien dich", "thanh co", "chien si", "quan doi", "hy sinh",
  ],
  religious: [
    "church", "basilica", "catholic", "buddhis[mt]", "pagoda", "temple", "marian", "apparition",
    "religion", "religious", "pilgrimage", "shrine", "saint",
    // "chua" alone would also match "chưa" (not yet), so only the "ngôi chùa" form is listed.
    "nha tho", "cong giao", "phat giao", "ngoi chua", "den tho", "ton giao", "duc me", "hanh huong",
  ],
  ethnic: [
    "ethnic", "minorit(y|ies)", "van kieu", "pa ko", "pa koh", "bru",
    "dan toc", "thieu so",
  ],
};

const SENSITIVE_RE = new RegExp(
  `\\b(${Object.values(SENSITIVE_TERMS).flat().join("|")})\\b`,
  "i",
);

/** Lowercase + strip Vietnamese diacritics so "Chiến tranh" matches "chien tranh". */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function isSensitiveQuery(text: string): boolean {
  return SENSITIVE_RE.test(normalizeForMatch(text));
}

/**
 * Hard rule from SYSTEM_DESIGN §5.3: war track, war/religious sites, and
 * sensitive questions must be answered only from curated chunks.
 */
export function requiresCuratedGrounding(args: {
  track: TrackKey;
  siteType?: SiteType | null;
  query: string;
}): boolean {
  if (args.track === "war") return true;
  if (args.siteType && SENSITIVE_SITE_TYPES.has(args.siteType)) return true;
  return isSensitiveQuery(args.query);
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|messages?)/gi,
  /disregard\s+(all\s+)?(the\s+)?(previous|prior|above)\s+\w+/gi,
  /<\|[^|>]{1,40}\|>/g,
  /\[\/?(INST|SYS)\]/g,
  /<\/?\s*(system|instructions?|assistant|user)\s*>/gi,
  /^\s*(system|assistant|developer)\s*:/gim,
];

/** Strip prompt-injection markers from a RAG chunk before it enters the prompt. */
export function scrubChunk(text: string): string {
  let out = text;
  for (const re of INJECTION_PATTERNS) out = out.replace(re, "");
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/** Truncate an incoming user message to the input cap. */
export function capMessage(text: string): string {
  return text.length > MAX_MESSAGE_CHARS ? text.slice(0, MAX_MESSAGE_CHARS) : text;
}

export function refusalText(lang: "vi" | "en", siteName?: string | null): string {
  if (lang === "vi") {
    return [
      `Mình chưa có tư liệu đã được kiểm chứng để trả lời câu hỏi này${siteName ? ` về ${siteName}` : ""}.`,
      "Với các chủ đề chiến tranh, tôn giáo và dân tộc, mình chỉ trả lời dựa trên nội dung đã được biên soạn và dẫn nguồn.",
      "Câu hỏi đã được ghi lại để biên tập viên bổ sung. Bạn có thể hỏi về giờ mở cửa, giá vé hoặc mẹo tham quan.",
    ].join(" ");
  }
  return [
    `I don't have verified, sourced material to answer that${siteName ? ` about ${siteName}` : ""} yet.`,
    "For war, religious and ethnic topics I only answer from curated, cited content.",
    "I've logged the question so an editor can add it. You can ask about opening hours, tickets, or visit tips instead.",
  ].join(" ");
}
