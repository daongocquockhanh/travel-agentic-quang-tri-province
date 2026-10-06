import "server-only";
import { SAMPLE_SITES, type SampleSite } from "@/lib/sample-sites";
import { haversineMeters } from "@/lib/geo";
import type { TrackKey } from "@/lib/tracks";

export interface Site {
  slug: string;
  name_vi: string;
  name_en: string;
  type: SampleSite["type"];
  tracks: TrackKey[];
  lat: number;
  lng: number;
  hero_gradient: string;
  hours: string;
  ticket_price_vnd: number | null;
  distance_from_dong_ha_km: number;
  visit_min: number;
  boat?: { from: string; minutes: number };
}

export interface NearbySite extends Site {
  distance_m: number;
}

export interface SiteContentSection {
  section: "overview" | "history" | "visit_tips" | "culture_notes";
  body: string;
  source_citation: string | null;
}

export interface SiteWithContent extends Site {
  content: Record<"vi" | "en", SiteContentSection[]>;
}

/** Whether a Supabase project is configured. Until then, we serve sample data. */
export const hasSupabase = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function toSite(row: SampleSite): Site {
  return { ...row };
}

export async function listSites(filters?: { track?: TrackKey }): Promise<Site[]> {
  const rows = SAMPLE_SITES.filter((s) =>
    filters?.track ? s.tracks.includes(filters.track) : true,
  );
  // TODO(M3): when hasSupabase(), query public.sites instead of the sample set.
  return rows.map(toSite);
}

export async function getSite(slug: string): Promise<Site | null> {
  const found = SAMPLE_SITES.find((s) => s.slug === slug) ?? null;
  return found ? toSite(found) : null;
}

export async function findNearby(args: {
  lat: number;
  lng: number;
  radius_km: number;
  track?: TrackKey;
}): Promise<NearbySite[]> {
  const { lat, lng, radius_km, track } = args;
  const candidates = await listSites(track ? { track } : undefined);
  return candidates
    .map((s) => ({ ...s, distance_m: haversineMeters({ lat, lng }, { lat: s.lat, lng: s.lng }) }))
    .filter((s) => s.distance_m <= radius_km * 1000)
    .sort((a, b) => a.distance_m - b.distance_m);
}

/**
 * Returns the site plus its curated content sections, read from
 * `content/sites/<slug>/<lang>/*.md`. Sites without markdown return empty
 * arrays (the detail page falls back to "content coming soon").
 */
export async function getSiteWithContent(slug: string): Promise<SiteWithContent | null> {
  const site = await getSite(slug);
  if (!site) return null;

  const { readSiteContent } = await import("@/lib/content");
  return { ...site, content: await readSiteContent(slug) };
}
