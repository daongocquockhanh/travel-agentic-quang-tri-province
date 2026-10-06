import { beforeEach, describe, expect, it } from "vitest";
import { SAMPLE_SITES } from "@/lib/sample-sites";
import { recommendNext, type RecSite } from "@/lib/recommend";
import {
  buildItinerary,
  driveEstimate,
  formatClock,
  hoursWarning,
  legBetween,
  optimizeOrder,
  parseHours,
} from "@/lib/route";
import { planRoute, vietnamNowMinutes } from "@/lib/planner";

const sites = SAMPLE_SITES as unknown as RecSite[];
const piers = Object.fromEntries(SAMPLE_SITES.map((s) => [s.slug, { lat: s.lat, lng: s.lng }]));
const site = (slug: string) => sites.find((s) => s.slug === slug)!;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  delete process.env.MAPBOX_SECRET_TOKEN;
});

describe("time and hours helpers", () => {
  it("parses opening windows from free-text hours", () => {
    expect(parseHours("7:00–16:30")).toEqual({ open: 420, close: 990 });
    expect(parseHours("Day tour 6:00–17:00")).toEqual({ open: 360, close: 1020 });
    expect(parseHours("Open 24h")).toBeNull();
  });
  it("flags closed-on-arrival and closes-during-visit", () => {
    expect(hoursWarning("7:00–16:30", 6 * 60, 7 * 60)).toBe("closed_on_arrival");
    expect(hoursWarning("7:00–16:30", 16 * 60, 17 * 60)).toBe("closes_during_visit");
    expect(hoursWarning("7:00–16:30", 9 * 60, 10 * 60)).toBeNull();
    expect(hoursWarning("Open 24h", 2 * 60, 3 * 60)).toBeNull();
  });
  it("formats clock times and wraps past midnight", () => {
    expect(formatClock(8 * 60 + 5)).toBe("08:05");
    expect(formatClock(25 * 60)).toBe("01:00");
  });
  it("uses Vietnam time", () => {
    expect(vietnamNowMinutes(new Date("2026-10-06T01:30:00Z"))).toBe(8 * 60 + 30);
  });
});

describe("legs", () => {
  it("estimates Dong Ha → Khe Sanh as a long inland drive", () => {
    const { distance_km, travel_min } = driveEstimate(site("dong-ha"), site("khe-sanh"));
    expect(distance_km).toBeGreaterThan(50);
    expect(travel_min).toBeGreaterThan(60);
  });
  it("routes to Con Co via the Cua Viet pier with the boat crossing", () => {
    const leg = legBetween(site("dong-ha"), site("con-co"), piers);
    expect(leg.mode).toBe("drive+boat");
    expect(leg.travel_min).toBeGreaterThan(90);
    expect(leg.geometry).toHaveLength(3); // Dong Ha → Cua Viet pier → Con Co
    expect(leg.geometry[1]).toEqual([site("cua-viet").lng, site("cua-viet").lat]);
  });
});

describe("optimizeOrder", () => {
  it("finds the shortest path, not the given order", () => {
    // Zig-zag input: north, south, north again.
    const input = [site("vinh-moc"), site("la-vang"), site("hien-luong"), site("dong-ha")];
    const cost = (a: RecSite | null, b: RecSite) => (a ? legBetween(a, b, piers).travel_min : 0);
    const total = (o: RecSite[]) => o.reduce((n, s, i) => n + cost(i ? o[i - 1] : null, s), 0);
    const best = optimizeOrder(input, cost);
    expect(total(best)).toBeLessThan(total(input));
    expect(new Set(best.map((s) => s.slug))).toEqual(new Set(input.map((s) => s.slug)));
  });

  it("handles more than 8 stops with the heuristic", () => {
    const all = sites.slice();
    const cost = (a: RecSite | null, b: RecSite) => (a ? legBetween(a, b, piers).travel_min : 0);
    const out = optimizeOrder(all, cost);
    expect(out).toHaveLength(all.length);
    expect(new Set(out.map((s) => s.slug)).size).toBe(all.length);
  });
});

describe("buildItinerary", () => {
  it("times stops from the start time with travel and visit durations", () => {
    const it1 = buildItinerary({
      sites: [site("hien-luong"), site("vinh-moc")],
      start_time: "08:00",
      piers,
    });
    expect(it1.stops[0]).toMatchObject({ slug: "hien-luong", arrive: "08:00", depart: "08:45" });
    expect(it1.legs).toHaveLength(1);
    const leg = it1.legs[0];
    expect(it1.stops[1].arrive).toBe(formatClock(8 * 60 + 45 + leg.travel_min));
    expect(it1.total_visit_min).toBe(45 + 90);
  });

  it("adds a leg from the traveller's position when a start point is given", () => {
    const it2 = buildItinerary({
      sites: [site("vinh-moc")],
      start: { lat: site("dong-ha").lat, lng: site("dong-ha").lng },
      start_time: "07:00",
      piers,
    });
    expect(it2.legs).toHaveLength(1);
    expect(it2.stops[0].arrive).not.toBe("07:00");
  });

  it("warns when a stop would be closed on arrival", () => {
    const late = buildItinerary({ sites: [site("vinh-moc")], start_time: "17:00", piers });
    expect(late.stops[0].hours_warning).toBe("closed_on_arrival");
  });
});

describe("recommendNext", () => {
  it("keeps a war pilgrim on the 17th-parallel story after Vinh Moc", () => {
    const recs = recommendNext({
      sites,
      from: site("vinh-moc"),
      track: "war",
      now_min: 10 * 60,
      piers,
    });
    expect(recs[0].slug).toBe("hien-luong");
    expect(recs[0].reason.en).toMatch(/17th-parallel/);
    expect(recs[0].reason.vi).toMatch(/vĩ tuyến 17/);
    expect(recs.every((r) => r.slug !== "vinh-moc")).toBe(true);
    // war track only sees war-track sites
    expect(recs.every((r) => site(r.slug).tracks.includes("war"))).toBe(true);
  });

  it("never suggests excluded (visited or planned) sites", () => {
    const recs = recommendNext({
      sites,
      from: site("vinh-moc"),
      track: "war",
      exclude: ["hien-luong"],
      piers,
    });
    expect(recs.map((r) => r.slug)).not.toContain("hien-luong");
  });

  it("pushes down places that will be closed on arrival", () => {
    const evening = recommendNext({ sites, from: site("dong-ha"), track: "foreign", now_min: 18 * 60, piers, k: 10 });
    const laVang = evening.find((r) => r.slug === "la-vang")!; // open to 20:00
    const vinhMoc = evening.find((r) => r.slug === "vinh-moc")!; // closes 16:30
    expect(laVang.score).toBeGreaterThan(vinhMoc.score);
    expect(vinhMoc.reason.en).toMatch(/closed/);
  });

  it("respects the time budget", () => {
    const recs = recommendNext({ sites, from: site("dong-ha"), track: "foreign", time_left_min: 60, piers });
    expect(recs.map((r) => r.slug)).not.toContain("con-co");
  });

  it("explains each suggestion with travel time", () => {
    const recs = recommendNext({ sites, from: site("dong-ha"), track: "domestic", piers });
    for (const r of recs) expect(r.reason.en).toMatch(/drive|boat/);
  });
});

describe("planRoute (server)", () => {
  it("skips unknown slugs and de-duplicates", async () => {
    const { itinerary, unknown } = await planRoute({ slugs: ["vinh-moc", "nowhere", "vinh-moc", "hien-luong"] });
    expect(unknown).toEqual(["nowhere"]);
    expect(itinerary.stops.map((s) => s.slug)).toEqual(["vinh-moc", "hien-luong"]);
    expect(itinerary.legs.every((l) => l.estimated)).toBe(true);
  });
});

describe("planner APIs", () => {
  it("POST /api/route returns timed stops and legs", async () => {
    const { POST } = await import("@/app/api/route/route");
    const res = await POST(
      new Request("http://x/api/route", {
        method: "POST",
        body: JSON.stringify({ slugs: ["vinh-moc", "dong-ha", "hien-luong"], optimize: true, start_time: "08:30" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stops).toHaveLength(3);
    expect(body.legs).toHaveLength(2);
    expect(body.start_time).toBe("08:30");
    // Optimised: the two DMZ sites sit next to each other in the order.
    const order = body.stops.map((s: { slug: string }) => s.slug);
    expect(Math.abs(order.indexOf("vinh-moc") - order.indexOf("hien-luong"))).toBe(1);
  });

  it("POST /api/route validates input", async () => {
    const { POST } = await import("@/app/api/route/route");
    const bad = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ slugs: [] }) }));
    expect(bad.status).toBe(400);
    const missing = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ slugs: ["atlantis"] }) }));
    expect(missing.status).toBe(404);
  });

  it("GET /api/recommend requires a track and returns ranked suggestions", async () => {
    const { GET } = await import("@/app/api/recommend/route");
    expect((await GET(new Request("http://x/api/recommend"))).status).toBe(400);
    const res = await GET(new Request("http://x/api/recommend?track=war&from=vinh-moc&exclude=hien-luong&k=2"));
    const { recommendations } = await res.json();
    expect(recommendations).toHaveLength(2);
    expect(recommendations.map((r: { slug: string }) => r.slug)).not.toContain("hien-luong");
  });
});

describe("itinerary details", () => {
  it("counts the sea crossing in a boat leg's distance", () => {
    const leg = legBetween(site("cua-viet"), site("con-co"), piers);
    expect(leg.distance_km).toBeGreaterThan(20);
  });

  it("starts an optimised day from the end nearer Dong Ha, not on the island", async () => {
    const { itinerary } = await planRoute({ slugs: ["con-co", "dong-ha", "cua-viet", "la-vang"], optimize: true });
    const order = itinerary.stops.map((s) => s.slug);
    expect(order[0]).not.toBe("con-co");
    expect(order.at(-1)).toBe("con-co");
  });
});
