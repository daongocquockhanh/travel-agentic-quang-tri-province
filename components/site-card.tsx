import Link from "next/link";
import { Icon } from "@/components/icon";
import { SitePhoto } from "@/components/site-photo";
import { formatHours } from "@/lib/format";
import { SITE_TYPE_LABEL, TRACK_COLOR, type TrackKey } from "@/lib/tracks";

export interface SiteCardData {
  slug: string;
  name_vi: string;
  name_en: string;
  type: string;
  tracks: TrackKey[];
  distance_km?: number;
  hours?: string;
  primary_track: TrackKey;
  hero_gradient: string;
  photo?: { file: string; alt_en: string; alt_vi: string };
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** A place in the list: photo, name in the reader's language first, what kind of place, how far, when open. */
export function SiteCard({ site, lang }: { site: SiteCardData; lang: "vi" | "en" }) {
  const primary = lang === "vi" ? site.name_vi : site.name_en;
  const secondary = lang === "vi" ? site.name_en : site.name_vi;
  return (
    <Link
      href={`/site/${site.slug}`}
      className="group flex items-stretch gap-3 rounded-[12px] border border-border bg-paper-card p-2 pr-3 transition hover:border-border-strong"
    >
      <SitePhoto
        photo={site.photo}
        gradient={site.hero_gradient}
        lang={lang}
        width={200}
        decorative
        className="size-[72px] shrink-0 rounded-[8px]"
      />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.06em]" style={{ color: TRACK_COLOR[site.primary_track] }}>
          {SITE_TYPE_LABEL[site.type]?.[lang] ?? site.type}
        </p>
        <p className="truncate font-display text-[17px] leading-tight text-fg">{primary}</p>
        <p className="truncate font-display text-[12.5px] italic text-fg-muted">{secondary}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[12px] text-fg-muted">
          {site.distance_km != null && <span>{formatDistance(site.distance_km)}</span>}
          {site.distance_km != null && site.hours && <span aria-hidden>·</span>}
          {site.hours && (
            <>
              <Icon name="clock" size={11} />
              <span className="truncate">{formatHours(site.hours, lang)}</span>
            </>
          )}
        </p>
      </div>
      <div className="self-center text-fg-muted transition group-hover:translate-x-0.5" aria-hidden>
        <Icon name="arrow" size={18} />
      </div>
    </Link>
  );
}
