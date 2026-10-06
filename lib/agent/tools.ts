import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { nextPlaces, planRoute } from "@/lib/planner";
import { findNearby, getSite } from "@/lib/sites";
import { searchCurated } from "@/lib/agent/retrieval";
import type { CitationRef, CuratedChunk, Lang } from "@/lib/agent/types";
import type { TrackKey } from "@/lib/tracks";

/**
 * Numbers every chunk the model sees during one request, so `[n]` markers in
 * the answer line up with the citation chips the client renders.
 */
export class CitationRegistry {
  private byKey = new Map<string, number>();
  private refs: CitationRef[] = [];
  constructor(private onAdd?: (ref: CitationRef) => void) {}

  /** Returns the 1-based ref number for a chunk, registering it if new. */
  register(c: CuratedChunk): number {
    const key = `${c.site_slug}:${c.section}:${c.lang}:${c.body.slice(0, 64)}`;
    const existing = this.byKey.get(key);
    if (existing) return existing;
    const ref = {
      n: this.refs.length + 1,
      site_slug: c.site_slug,
      section: c.section,
      source: c.source_citation ?? "Curated content",
    };
    this.byKey.set(key, ref.n);
    this.refs.push(ref);
    this.onAdd?.(ref);
    return ref.n;
  }

  list(): CitationRef[] {
    return [...this.refs];
  }
}

export function buildTools(ctx: {
  lang: Lang;
  track: TrackKey;
  registry: CitationRegistry;
  /** Site in context and traveller position, used as the default "from". */
  site_slug?: string | null;
  location?: { lat: number; lng: number } | null;
}) {
  return {
    search_curated: tool({
      description:
        "Search the curated, editor-reviewed content about Quảng Trị sites. Returns numbered chunks with source citations.",
      parameters: z.object({
        query: z.string().min(2).describe("What to look for, in the traveller's words."),
        site_slug: z.string().optional().describe("Limit to one site, e.g. 'vinh-moc'."),
        section: z.enum(["overview", "history", "visit_tips", "culture_notes"]).optional(),
      }),
      execute: async ({ query, site_slug, section }) => {
        const chunks = await searchCurated({ query, site_slug, section, lang: ctx.lang, k: 4 });
        if (!chunks.length) return { results: [], note: "No curated content matched." };
        return {
          results: chunks.map((c) => ({
            ref: ctx.registry.register(c),
            site_slug: c.site_slug,
            section: c.section,
            source: c.source_citation,
            text: c.body,
          })),
        };
      },
    }),

    get_site: tool({
      description: "Structured facts for one site: names, type, opening hours, ticket price, coordinates.",
      parameters: z.object({ slug: z.string() }),
      execute: async ({ slug }) => {
        const site = await getSite(slug);
        if (!site) return { error: `No site with slug "${slug}".` };
        return {
          slug: site.slug,
          name_vi: site.name_vi,
          name_en: site.name_en,
          type: site.type,
          tracks: site.tracks,
          hours: site.hours,
          ticket_price_vnd: site.ticket_price_vnd,
          distance_from_dong_ha_km: site.distance_from_dong_ha_km,
          lat: site.lat,
          lng: site.lng,
        };
      },
    }),

    find_nearby: tool({
      description: "Sites within a radius of a point, nearest first. Filtered to the traveller's track.",
      parameters: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radius_km: z.number().positive().max(200).default(10),
      }),
      execute: async ({ lat, lng, radius_km }) => {
        // Broaden once when nothing is close (SYSTEM_DESIGN §8.1).
        let sites = await findNearby({ lat, lng, radius_km, track: ctx.track });
        let searched_km = radius_km;
        if (!sites.length && radius_km < 30) {
          searched_km = 30;
          sites = await findNearby({ lat, lng, radius_km: searched_km, track: ctx.track });
        }
        return {
          searched_km,
          sites: sites.slice(0, 8).map((s) => ({
            slug: s.slug,
            name_vi: s.name_vi,
            name_en: s.name_en,
            type: s.type,
            distance_km: Math.round(s.distance_m / 100) / 10,
            hours: s.hours,
          })),
        };
      },
    }),

    recommend_next: tool({
      description:
        "Suggest the next places to visit, ranked for the traveller's track, travel time, story continuity and opening hours. " +
        "The app shows the results as cards with an 'Add to plan' button, so keep your text brief.",
      parameters: z.object({
        from_slug: z.string().optional().describe("Where the traveller is now or will finish. Defaults to the site in context."),
        exclude: z.array(z.string()).optional().describe("Slugs already visited or planned."),
        time_left_min: z.number().int().positive().max(1440).optional().describe("Minutes left today, if the traveller said."),
      }),
      execute: async ({ from_slug, exclude, time_left_min }) => {
        const recommendations = await nextPlaces({
          track: ctx.track,
          from_slug: from_slug ?? ctx.site_slug ?? null,
          from: ctx.location ?? null,
          exclude,
          time_left_min,
          k: 3,
        });
        return { recommendations };
      },
    }),

    build_route: tool({
      description:
        "Order a list of sites into a day plan with arrival times, travel legs (including the boat to Cồn Cỏ) and opening-hours warnings. " +
        "The app shows it as a route card that opens on the map.",
      parameters: z.object({
        slugs: z.array(z.string()).min(1).max(10),
        start_time: z
          .string()
          .regex(/^\d{1,2}:\d{2}$/)
          .optional()
          .describe("HH:MM, default 08:00."),
        optimize: z.boolean().default(true).describe("Reorder for the shortest day. False keeps the given order."),
        from_current_location: z.boolean().default(false),
      }),
      execute: async ({ slugs, start_time, optimize, from_current_location }) => {
        const { itinerary, unknown } = await planRoute({
          slugs,
          start_time,
          optimize,
          start: from_current_location ? ctx.location ?? null : null,
        });
        return { ...itinerary, unknown };
      },
    }),
  };
}
