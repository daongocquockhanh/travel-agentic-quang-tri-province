import Link from "next/link";
import { TRACK_COLOR, type TrackKey } from "@/lib/tracks";
import { Icon } from "@/components/icon";

export interface SiteCardData {
  slug: string;
  name_vi: string;
  name_en: string;
  distance_km?: number;
  hours?: string;
  primary_track: TrackKey;
}

interface Props {
  site: SiteCardData;
}

export function SiteCard({ site }: Props) {
  return (
    <Link
      href={`/site/${site.slug}`}
      className="group flex items-stretch gap-3 rounded-[10px] border border-border bg-paper-card p-3 transition hover:border-border-strong"
    >
      <div
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-[8px] text-paper"
        style={{ background: TRACK_COLOR[site.primary_track] }}
      >
        <Icon name="pin" size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[17px] leading-tight text-fg">{site.name_vi}</p>
        <p className="truncate font-display text-[13px] italic text-fg-muted">{site.name_en}</p>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          {site.distance_km != null && (
            <>
              {site.distance_km < 1
                ? `${Math.round((site.distance_km * 1000) / 10) * 10} m`
                : `${site.distance_km.toFixed(site.distance_km < 10 ? 1 : 0)} km`}
            </>
          )}
          {site.distance_km != null && site.hours && <span aria-hidden> · </span>}
          {site.hours}
        </p>
      </div>
      <div className="self-center" style={{ color: TRACK_COLOR[site.primary_track] }}>
        <Icon name="arrow" size={18} />
      </div>
    </Link>
  );
}
