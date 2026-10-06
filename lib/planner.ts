import "server-only";
import type { LatLng } from "@/lib/geo";
import { refineLegs } from "@/lib/directions";
import { recommendNext, type RecSite } from "@/lib/recommend";
import { buildItinerary, formatClock, hoursWarning, parseClock, type Itinerary } from "@/lib/route";
import { listSites, type Site } from "@/lib/sites";
import type { TrackKey } from "@/lib/tracks";

/** Planner-facing view of the site catalogue (sample data until Supabase holds it). */
async function catalogue() {
  const sites = await listSites();
  const piers = Object.fromEntries(sites.map((s) => [s.slug, { lat: s.lat, lng: s.lng }]));
  return { sites, piers };
}

/** Current time in Vietnam (UTC+7, no DST), as minutes since midnight. */
export function vietnamNowMinutes(now = new Date()): number {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 7 * 60) % 1440;
}

export async function planRoute(args: {
  slugs: string[];
  start?: LatLng | null;
  start_time?: string;
  optimize?: boolean;
}): Promise<{ itinerary: Itinerary; unknown: string[] }> {
  const { sites, piers } = await catalogue();
  const bySlug = new Map(sites.map((s) => [s.slug, s]));
  const unique = [...new Set(args.slugs)];
  const unknown = unique.filter((s) => !bySlug.has(s));
  const chosen = unique.map((s) => bySlug.get(s)).filter(Boolean) as Site[];

  const draft = buildItinerary({
    sites: chosen,
    start: args.start,
    start_time: args.start_time,
    optimize: args.optimize,
    piers,
    hub: piers["dong-ha"] ?? null,
  });

  const legs = await refineLegs(draft.legs);
  if (legs.every((l, i) => l === draft.legs[i])) return { itinerary: draft, unknown };

  // Real drive times shift the clock: re-time the stops along the same order.
  let clock = parseClock(draft.start_time)!;
  const stops = draft.stops.map((stop, i) => {
    const legIndex = args.start ? i : i - 1;
    if (legIndex >= 0) clock += legs[legIndex].travel_min;
    const arrive = clock;
    clock += stop.visit_min;
    const site = bySlug.get(stop.slug)!;
    return {
      ...stop,
      arrive: formatClock(arrive),
      depart: formatClock(clock),
      hours_warning: hoursWarning(site.hours, arrive, clock),
    };
  });
  return {
    itinerary: {
      ...draft,
      stops,
      legs,
      total_travel_min: legs.reduce((n, l) => n + l.travel_min, 0),
      total_distance_km: Math.round(legs.reduce((n, l) => n + l.distance_km, 0) * 10) / 10,
      end_time: formatClock(clock),
    },
    unknown,
  };
}

export async function nextPlaces(args: {
  from_slug?: string | null;
  from?: LatLng | null;
  track: TrackKey;
  exclude?: string[];
  time_left_min?: number;
  k?: number;
  now_min?: number;
}) {
  const { sites, piers } = await catalogue();
  const fromSite = args.from_slug ? sites.find((s) => s.slug === args.from_slug) : undefined;
  const from = fromSite
    ? { slug: fromSite.slug, lat: fromSite.lat, lng: fromSite.lng }
    : args.from
      ? { lat: args.from.lat, lng: args.from.lng }
      : null;
  const excluded = new Set(args.exclude ?? []);
  return recommendNext({
    sites: sites as RecSite[],
    from,
    track: args.track,
    exclude: [...excluded],
    visitedTypes: sites.filter((s) => excluded.has(s.slug) || s.slug === fromSite?.slug).map((s) => s.type),
    now_min: args.now_min ?? vietnamNowMinutes(),
    time_left_min: args.time_left_min,
    piers,
    k: args.k,
  });
}
