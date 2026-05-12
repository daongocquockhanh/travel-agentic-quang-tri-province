import { MapHome } from "@/components/map-home";
import { listSites } from "@/lib/sites";
import { isTrackKey, type TrackKey } from "@/lib/tracks";
import type { MapSite } from "@/components/map-view";
import type { SiteCardData } from "@/components/site-card";

interface Props {
  searchParams: Promise<{ track?: string; demo?: string }>;
}

function primaryTrack(tracks: TrackKey[]): TrackKey {
  return tracks[0] ?? "foreign";
}

export default async function MapPage({ searchParams }: Props) {
  const { track: trackParam, demo } = await searchParams;
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
    distance_km: s.distance_from_dong_ha_km,
    hours: s.hours,
    primary_track: primaryTrack(s.tracks),
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
    />
  );
}
