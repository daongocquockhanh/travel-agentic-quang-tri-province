"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapView, type MapSite } from "@/components/map-view";
import { TrackChip } from "@/components/track-chip";
import { SiteCard, type SiteCardData } from "@/components/site-card";
import { GeofenceBanner } from "@/components/geofence-banner";
import { Icon } from "@/components/icon";
import { TRACK_STORAGE_KEY, type TrackKey } from "@/lib/tracks";

interface Props {
  initialTrack: TrackKey;
  sites: MapSite[];
  cards: SiteCardData[];
  /** Optional geofence demo: if non-null, banner shows for this site. */
  demoBanner?: { slug: string; name_vi: string; name_en: string; track: TrackKey } | null;
}

const TRACK_CYCLE: TrackKey[] = ["war", "foreign", "domestic"];

export function MapHome({ initialTrack, sites, cards, demoBanner }: Props) {
  const router = useRouter();
  const [track, setTrack] = useState<TrackKey>(initialTrack);
  const [lang, setLang] = useState<"vi" | "en">("en");
  const [bannerOpen, setBannerOpen] = useState<boolean>(Boolean(demoBanner));

  const cycleTrack = () => {
    const next = TRACK_CYCLE[(TRACK_CYCLE.indexOf(track) + 1) % TRACK_CYCLE.length];
    setTrack(next);
    try {
      window.localStorage.setItem(TRACK_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  };
  const cycleLang = () => setLang((l) => (l === "en" ? "vi" : "en"));

  const filteredCards =
    track === "war" ? cards.filter((c) => c.primary_track === "war") : cards;

  return (
    <div className="relative h-screen overflow-hidden bg-[#2F4549]">
      <MapView
        sites={sites}
        activeTrack={track}
        onSitePick={(slug) => router.push(`/site/${slug}`)}
      />

      {/* top chrome */}
      <div className="absolute inset-x-3.5 top-3.5 z-30 flex items-start justify-between gap-2">
        <TrackChip track={track} lang={lang} glass onClick={cycleTrack} />
        <button
          type="button"
          onClick={cycleLang}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-[rgba(247,244,238,0.86)] px-3 py-1.5 font-sans text-[13px] font-medium text-fg backdrop-blur-md"
        >
          <Icon name="globe" size={14} />
          {lang.toUpperCase()}
        </button>
      </div>

      {/* geofence banner */}
      {bannerOpen && demoBanner && (
        <div className="absolute inset-x-3.5 top-16 z-20">
          <GeofenceBanner
            track={demoBanner.track}
            nameVi={demoBanner.name_vi}
            nameEn={demoBanner.name_en}
            onPlay={() => router.push(`/site/${demoBanner.slug}`)}
            onRead={() => router.push(`/site/${demoBanner.slug}`)}
            onDismiss={() => setBannerOpen(false)}
          />
        </div>
      )}

      {/* bottom sheet (half height) */}
      <section
        className="absolute inset-x-0 bottom-0 z-10 flex h-[55vh] flex-col overflow-hidden rounded-t-3xl bg-paper shadow-[0_-16px_40px_-12px_rgba(31,36,40,.18)]"
        aria-label="Nearby sites"
      >
        <button
          type="button"
          aria-label="Drag handle"
          className="pt-2.5 pb-1.5"
          tabIndex={-1}
        >
          <span className="mx-auto block h-1 w-9 rounded-full bg-ink/20" />
        </button>

        <div className="px-4 pb-3 pt-1">
          <div className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-paper-card px-3.5 py-2.5">
            <Icon name="mic" size={18} className="text-fg-muted" />
            <span className="flex-1 truncate font-sans text-[15px] text-fg-muted">
              Ask about a place, route, or history…
            </span>
            <Icon name="arrowUp" size={16} className="text-fg-muted" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
            Nearby · {filteredCards.length} places
          </p>
          <ul className="flex flex-col gap-2">
            {filteredCards.map((card) => (
              <li key={card.slug}>
                <SiteCard site={card} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
