import { haversineMeters, type LatLng } from "@/lib/geo";

/**
 * Itinerary maths shared by /api/route, the agent's build_route tool and the
 * recommender. Pure functions over plain site records so they run anywhere
 * and are easy to test.
 *
 * Drive times are estimates: straight-line distance × a road factor at an
 * average speed that fits Quảng Trị's mix of QL1, QL9 and rural roads. When
 * a directions provider is configured, /api/route swaps in real figures.
 */

export const ROAD_FACTOR = 1.3;
export const AVG_SPEED_KMH = 45;

export interface RouteSite extends LatLng {
  slug: string;
  name_vi: string;
  name_en: string;
  hours: string;
  visit_min: number;
  boat?: { from: string; minutes: number };
}

export interface Leg {
  from: string;
  to: string;
  distance_km: number;
  travel_min: number;
  mode: "drive" | "drive+boat";
  /** True when the figures are our estimate rather than a directions API's. */
  estimated: boolean;
  /** [lng, lat] pairs; straight segments when estimated. */
  geometry: [number, number][];
}

export interface Stop extends LatLng {
  slug: string;
  name_vi: string;
  name_en: string;
  arrive: string; // "HH:MM"
  depart: string;
  visit_min: number;
  /** Set when the site is likely closed at the planned arrival time. */
  hours_warning: "closed_on_arrival" | "closes_during_visit" | null;
}

export interface Itinerary {
  stops: Stop[];
  legs: Leg[];
  total_travel_min: number;
  total_visit_min: number;
  total_distance_km: number;
  start_time: string;
  end_time: string;
}

export const START_KEY = "__start";

const round1 = (n: number) => Math.round(n * 10) / 10;

export function driveEstimate(a: LatLng, b: LatLng): { distance_km: number; travel_min: number } {
  const distance_km = (haversineMeters(a, b) / 1000) * ROAD_FACTOR;
  return {
    distance_km: round1(distance_km),
    travel_min: Math.max(1, Math.round((distance_km / AVG_SPEED_KMH) * 60)),
  };
}

/**
 * Travel between two points, routing through the pier for boat-only sites
 * (Cồn Cỏ is a 90-minute boat ride from Cửa Việt).
 */
export function legBetween(
  from: { slug: string } & LatLng & Partial<Pick<RouteSite, "boat">>,
  to: { slug: string } & LatLng & Partial<Pick<RouteSite, "boat">>,
  piers: Record<string, LatLng>,
): Leg {
  const fromPier = from.boat ? piers[from.boat.from] : undefined;
  const toPier = to.boat ? piers[to.boat.from] : undefined;
  const a = fromPier ?? from;
  const b = toPier ?? to;
  const drive = driveEstimate(a, b);
  const seaKm =
    (fromPier ? haversineMeters(fromPier, from) : 0) / 1000 +
    (toPier ? haversineMeters(toPier, to) : 0) / 1000;
  const boatMin =
    (from.boat && fromPier ? from.boat.minutes : 0) + (to.boat && toPier ? to.boat.minutes : 0);
  const geometry: [number, number][] = [[from.lng, from.lat]];
  if (fromPier) geometry.push([fromPier.lng, fromPier.lat]);
  if (toPier) geometry.push([toPier.lng, toPier.lat]);
  geometry.push([to.lng, to.lat]);
  return {
    from: from.slug,
    to: to.slug,
    distance_km: round1(drive.distance_km + seaKm),
    travel_min: drive.travel_min + boatMin,
    mode: boatMin ? "drive+boat" : "drive",
    estimated: true,
    geometry,
  };
}

// ── time helpers ─────────────────────────────────────────────────

export function parseClock(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Opening window from strings like "7:00–16:30" or "Day tour 6:00–17:00". Null = always open / unknown. */
export function parseHours(hours: string): { open: number; close: number } | null {
  const m = /(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/.exec(hours);
  if (!m) return null;
  return { open: Number(m[1]) * 60 + Number(m[2]), close: Number(m[3]) * 60 + Number(m[4]) };
}

export function hoursWarning(hours: string, arrive: number, depart: number): Stop["hours_warning"] {
  const w = parseHours(hours);
  if (!w) return null;
  if (arrive < w.open || arrive >= w.close) return "closed_on_arrival";
  if (depart > w.close) return "closes_during_visit";
  return null;
}

// ── ordering ─────────────────────────────────────────────────────

/**
 * Shortest open path through all sites (start fixed, end free). Exact
 * search up to 8 sites, which covers a day in the province; nearest-
 * neighbour plus 2-opt above that.
 */
export function optimizeOrder<
  T extends { slug: string } & LatLng & Partial<Pick<RouteSite, "boat">>,
>(sites: T[], cost: (a: T | null, b: T) => number): T[] {
  if (sites.length <= 1) return sites.slice();
  const pathCost = (order: T[]) =>
    order.reduce((sum, s, i) => sum + cost(i ? order[i - 1] : null, s), 0);

  if (sites.length <= 8) {
    let best = sites.slice();
    let bestCost = pathCost(best);
    const permute = (prefix: T[], rest: T[], acc: number) => {
      if (acc >= bestCost) return;
      if (!rest.length) {
        best = prefix;
        bestCost = acc;
        return;
      }
      for (let i = 0; i < rest.length; i++) {
        const next = rest[i];
        permute(
          [...prefix, next],
          [...rest.slice(0, i), ...rest.slice(i + 1)],
          acc + cost(prefix.at(-1) ?? null, next),
        );
      }
    };
    permute([], sites, 0);
    return best;
  }

  // nearest neighbour
  const remaining = sites.slice();
  const order: T[] = [];
  let prev: T | null = null;
  while (remaining.length) {
    let bi = 0;
    for (let i = 1; i < remaining.length; i++)
      if (cost(prev, remaining[i]) < cost(prev, remaining[bi])) bi = i;
    prev = remaining.splice(bi, 1)[0];
    order.push(prev);
  }
  // 2-opt
  let improved = true;
  let current = order;
  let currentCost = pathCost(current);
  while (improved) {
    improved = false;
    for (let i = 0; i < current.length - 1; i++) {
      for (let k = i + 1; k < current.length; k++) {
        const candidate = [
          ...current.slice(0, i),
          ...current.slice(i, k + 1).reverse(),
          ...current.slice(k + 1),
        ];
        const c = pathCost(candidate);
        if (c < currentCost - 1e-9) {
          current = candidate;
          currentCost = c;
          improved = true;
        }
      }
    }
  }
  return current;
}

// ── itinerary ────────────────────────────────────────────────────

export function buildItinerary(args: {
  sites: RouteSite[];
  /** Where the day starts; defaults to the first site. */
  start?: LatLng | null;
  start_time?: string;
  optimize?: boolean;
  /** Every site's coordinates, so boat legs can route via the pier. */
  piers: Record<string, LatLng>;
  /** Where days usually begin when no start point is given. */
  hub?: LatLng | null;
}): Itinerary {
  const startTime = parseClock(args.start_time ?? "") ?? 8 * 60;
  const startPoint = args.start ? { slug: START_KEY, ...args.start } : null;

  const travel = (a: RouteSite | null, b: RouteSite) =>
    a
      ? legBetween(a, b, args.piers).travel_min
      : startPoint
        ? legBetween(startPoint, b, args.piers).travel_min
        : 0;
  let ordered = args.optimize ? optimizeOrder(args.sites, travel) : args.sites.slice();
  // With no start point the best path costs the same in both directions:
  // begin from the end nearer the hub, where travellers sleep (Đông Hà).
  if (args.optimize && !startPoint && args.hub && ordered.length > 1) {
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (
      legBetween({ slug: START_KEY, ...args.hub }, last, args.piers).travel_min <
      legBetween({ slug: START_KEY, ...args.hub }, first, args.piers).travel_min
    ) {
      ordered = ordered.slice().reverse();
    }
  }

  const legs: Leg[] = [];
  const stops: Stop[] = [];
  let clock = startTime;
  ordered.forEach((site, i) => {
    const prev = i ? ordered[i - 1] : startPoint;
    if (prev) {
      const leg = legBetween(prev, site, args.piers);
      legs.push(leg);
      clock += leg.travel_min;
    }
    const arrive = clock;
    const depart = arrive + site.visit_min;
    stops.push({
      slug: site.slug,
      lat: site.lat,
      lng: site.lng,
      name_vi: site.name_vi,
      name_en: site.name_en,
      arrive: formatClock(arrive),
      depart: formatClock(depart),
      visit_min: site.visit_min,
      hours_warning: hoursWarning(site.hours, arrive, depart),
    });
    clock = depart;
  });

  const total_travel_min = legs.reduce((n, l) => n + l.travel_min, 0);
  return {
    stops,
    legs,
    total_travel_min,
    total_visit_min: ordered.reduce((n, s) => n + s.visit_min, 0),
    total_distance_km: round1(legs.reduce((n, l) => n + l.distance_km, 0)),
    start_time: formatClock(startTime),
    end_time: formatClock(clock),
  };
}
