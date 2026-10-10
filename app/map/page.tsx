import { getLocale } from "next-intl/server";
import { MapHome } from "@/components/map-home";
import { listSites } from "@/lib/sites";
import { isTrackKey, type TrackKey } from "@/lib/tracks";
import type { MapSite } from "@/components/map-view";
import type { SiteCardData } from "@/components/site-card";

interface Props {
  searchParams: Promise<{ track?: string; demo?: string; plan?: string; tab?: string }>;
}

function primaryTrack(tracks: TrackKey[]): TrackKey {
  return tracks[0] ?? "foreign";
}

export default async function MapPage({ searchParams }: Props) {
  const { track: trackParam, demo, plan: planParam, tab } = await searchParams;
  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  const initialTrack: TrackKey =
    trackParam && isTrackKey(trackParam) ? trackParam : "foreign";

  const sites = await listSites();

  const mapSites: MapSite[] = sites.map((s) => ({
    slug: s.slug,
    name_vi: s.name_vi,
    name_en: s.name_en,
    lat: s.lat,
    lng: s.lng,
    primary_track: primaryTrack(s.tracks),
  }));

  const cards: SiteCardData[] = sites.map((s) => ({
    slug: s.slug,
    name_vi: s.name_vi,
    name_en: s.name_en,
    type: s.type,
    tracks: s.tracks,
    distance_km: s.distance_from_dong_ha_km,
    hours: s.hours,
    primary_track: primaryTrack(s.tracks),
    hero_gradient: s.hero_gradient,
    photo: s.photo,
  }));

  // Optional demo banner: /map?demo=vinh-moc shows the "you're here" banner.
  let demoBanner = null;
  if (demo) {
    const found = sites.find((s) => s.slug === demo);
    if (found) {
      demoBanner = {
        slug: found.slug,
        name_vi: found.name_vi,
        name_en: found.name_en,
        track: primaryTrack(found.tracks),
      };
    }
  }

  return (
    <MapHome
      initialTrack={initialTrack}
      sites={mapSites}
      cards={cards}
      demoBanner={demoBanner}
      initialLang={lang}
      initialTab={tab === "plan" ? "plan" : "nearby"}
      sharedPlan={
        planParam
          ? planParam
              .split(",")
              .filter((slug) => sites.some((s) => s.slug === slug))
              .slice(0, 10)
          : null
      }
    />
  );
}
