import type { LatLng } from "@/lib/geo";
import { hoursWarning, legBetween, parseHours, formatClock, type RouteSite } from "@/lib/route";
import type { TrackKey } from "@/lib/tracks";

type SiteType = "war" | "cultural" | "religious" | "nature" | "food" | "city";

export interface RecSite extends RouteSite {
  type: SiteType;
  tracks: TrackKey[];
  ticket_price_vnd: number | null;
}

export interface Recommendation {
  slug: string;
  name_vi: string;
  name_en: string;
  type: SiteType;
  distance_km: number;
  travel_min: number;
  mode: "drive" | "drive+boat";
  score: number;
  reason: { vi: string; en: string };
}

/** Sites that tell one story together; visiting one makes the others a natural next stop. */
const STORY_GROUPS: { slugs: string[]; vi: string; en: string }[] = [
  {
    slugs: ["vinh-moc", "hien-luong", "cua-tung"],
    en: "continues the 17th-parallel story",
    vi: "tiếp nối câu chuyện vĩ tuyến 17",
  },
  {
    slugs: ["khe-sanh", "truong-son", "dong-ha"],
    en: "follows Route 9 and the Trường Sơn road",
    vi: "theo đường 9 và đường Trường Sơn",
  },
  {
    slugs: ["cua-viet", "con-co", "cua-tung"],
    en: "keeps you on the coast",
    vi: "tiếp tục hành trình ven biển",
  },
];

const TYPE_REASON: Record<SiteType, { en: string; vi: string }> = {
  war: { en: "a key war-history site", vi: "di tích lịch sử chiến tranh tiêu biểu" },
  cultural: { en: "local culture and daily life", vi: "văn hóa và đời sống địa phương" },
  religious: { en: "a major place of pilgrimage", vi: "điểm hành hương lớn" },
  nature: { en: "a break outdoors", vi: "nghỉ ngơi giữa thiên nhiên" },
  food: { en: "good local food", vi: "món ngon địa phương" },
  city: { en: "food, cafés and a place to rest", vi: "ăn uống, cà phê và nghỉ chân" },
};

function formatTravel(min: number, mode: Recommendation["mode"], lang: "vi" | "en") {
  const t = min < 60 ? `${min} ${lang === "vi" ? "phút" : "min"}` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  if (mode === "drive+boat") return lang === "vi" ? `${t} (gồm tàu ra đảo)` : `${t} incl. boat`;
  return lang === "vi" ? `${t} lái xe` : `${t} drive`;
}

/**
 * Ranks where to go next. Deterministic and explainable: every point of
 * score maps to a reason the traveller can read on the card.
 *
 * - track fit (the site belongs to the traveller's track, primary or not)
 * - theme (war sites for pilgrims, variety for foreign tourists, outdoors
 *   and free entry for domestic families)
 * - story continuity with where they are now
 * - travel time, and whether it still fits the time left today
 * - whether it will be open when they get there
 */
export function recommendNext(args: {
  sites: RecSite[];
  from: ({ slug?: string } & LatLng) | null;
  track: TrackKey;
  /** Already seen or already in the plan. */
  exclude?: string[];
  /** Types of places already visited, for variety. */
  visitedTypes?: SiteType[];
  /** Minutes since midnight now; enables opening-hours checks. */
  now_min?: number;
  /** Minutes the traveller has left today. */
  time_left_min?: number;
  piers: Record<string, LatLng>;
  k?: number;
}): Recommendation[] {
  const k = args.k ?? 3;
  const exclude = new Set([...(args.exclude ?? []), ...(args.from?.slug ? [args.from.slug] : [])]);
  const seenTypes = new Set(args.visitedTypes ?? []);
  const fromGroup = args.from?.slug ? STORY_GROUPS.find((g) => g.slugs.includes(args.from!.slug!)) : undefined;

  const scored = args.sites
    .filter((s) => !exclude.has(s.slug) && s.tracks.includes(args.track))
    .map((s) => {
      const leg = args.from
        ? legBetween({ slug: args.from.slug ?? "__from", ...args.from }, s, args.piers)
        : { distance_km: 0, travel_min: 0, mode: "drive" as const };
      const en: string[] = [formatTravel(leg.travel_min, leg.mode, "en")];
      const vi: string[] = [formatTravel(leg.travel_min, leg.mode, "vi")];
      let score = s.tracks[0] === args.track ? 2 : 1;

      // theme
      if (args.track === "war" && s.type === "war") score += 3;
      if (args.track === "foreign" && !seenTypes.has(s.type)) score += 1.5;
      if (args.track === "domestic" && (s.type === "nature" || s.type === "food")) score += 1.5;
      if (args.track === "domestic" && s.ticket_price_vnd == null) score += 0.5;

      // story continuity beats a generic type reason
      const story = fromGroup && fromGroup.slugs.includes(s.slug) ? fromGroup : undefined;
      if (story) {
        score += 1.5;
        en.push(story.en);
        vi.push(story.vi);
      } else {
        en.push(TYPE_REASON[s.type].en);
        vi.push(TYPE_REASON[s.type].vi);
      }

      // distance: every half hour on the road costs a point
      score -= leg.travel_min / 30;

      // time budget
      if (args.time_left_min != null && leg.travel_min + s.visit_min > args.time_left_min) score -= 6;

      // opening hours at arrival
      if (args.now_min != null) {
        const arrive = args.now_min + leg.travel_min;
        const warn = hoursWarning(s.hours, arrive, arrive + s.visit_min);
        const w = parseHours(s.hours);
        if (warn === "closed_on_arrival") {
          score -= 4;
          en.push("closed when you'd arrive");
          vi.push("đã đóng cửa khi bạn tới");
        } else if (warn === "closes_during_visit" && w) {
          score -= 1.5;
          en.push(`closes at ${formatClock(w.close)}`);
          vi.push(`đóng cửa lúc ${formatClock(w.close)}`);
        } else if (w) {
          en.push(`open until ${formatClock(w.close)}`);
          vi.push(`mở cửa đến ${formatClock(w.close)}`);
        }
      }

      return {
        slug: s.slug,
        name_vi: s.name_vi,
        name_en: s.name_en,
        type: s.type,
        distance_km: leg.distance_km,
        travel_min: leg.travel_min,
        mode: leg.mode,
        score: Math.round(score * 100) / 100,
        reason: { en: en.join(" · "), vi: vi.join(" · ") },
      } satisfies Recommendation;
    })
    .sort((a, b) => b.score - a.score || a.travel_min - b.travel_min);

  return scored.slice(0, k);
}
