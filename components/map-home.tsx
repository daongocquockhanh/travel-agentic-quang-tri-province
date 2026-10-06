"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapView, type MapRoute, type MapSite } from "@/components/map-view";
import { PlanPanel } from "@/components/plan-panel";
import { TrackChip } from "@/components/track-chip";
import { SiteCard, type SiteCardData } from "@/components/site-card";
import { GeofenceBanner } from "@/components/geofence-banner";
import { Icon } from "@/components/icon";
import { plan, usePlan } from "@/lib/plan-store";
import { TRACK_STORAGE_KEY, type TrackKey } from "@/lib/tracks";

interface Props {
  initialTrack: TrackKey;
  sites: MapSite[];
  cards: SiteCardData[];
  /** Optional geofence demo: if non-null, banner shows for this site. */
  demoBanner?: { slug: string; name_vi: string; name_en: string; track: TrackKey } | null;
  initialLang?: "vi" | "en";
  initialTab?: "nearby" | "plan";
  /** From `/map?plan=a,b,c` (e.g. a route card in chat): replaces the saved plan. */
  sharedPlan?: string[] | null;
}

const TRACK_CYCLE: TrackKey[] = ["war", "foreign", "domestic"];

export function MapHome({
  initialTrack,
  sites,
  cards,
  demoBanner,
  initialLang = "en",
  initialTab = "nearby",
  sharedPlan,
}: Props) {
  const router = useRouter();
  const [track, setTrack] = useState<TrackKey>(initialTrack);
  const [lang, setLang] = useState<"vi" | "en">(initialLang);
  const [tab, setTab] = useState<"nearby" | "plan">(sharedPlan?.length ? "plan" : initialTab);
  const [route, setRoute] = useState<MapRoute | null>(null);
  const planned = usePlan();
  const onRoute = useCallback((r: MapRoute | null) => setRoute(r), []);
  const names = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.slug, { vi: s.name_vi, en: s.name_en }])),
    [sites],
  );

  useEffect(() => {
    if (sharedPlan?.length) plan.set(sharedPlan);
  }, [sharedPlan]);
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
        route={planned.length ? route : null}
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
            onPlay={() =>
              router.push(`/chat?site=${demoBanner.slug}&intent=arrival_story&track=${track}`)
            }
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
          <Link
            href={`/chat?track=${track}`}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-paper-card px-3.5 py-2.5"
          >
            <Icon name="mic" size={18} className="text-fg-muted" />
            <span className="flex-1 truncate font-sans text-[15px] text-fg-muted">
              Ask about a place, route, or history…
            </span>
            <Icon name="arrowUp" size={16} className="text-fg-muted" />
          </Link>
        </div>

        <div role="tablist" className="mx-4 mb-2 grid grid-cols-2 gap-1 rounded-full bg-paper-sunk p-1">
          {(["nearby", "plan"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={
                "rounded-full py-1.5 text-[13px] font-medium transition " +
                (tab === key ? "bg-paper-card text-fg shadow-[0_1px_3px_rgba(31,36,40,.12)]" : "text-fg-muted")
              }
            >
              {key === "nearby"
                ? `${lang === "vi" ? "Gần đây" : "Nearby"} · ${filteredCards.length}`
                : `${lang === "vi" ? "Lộ trình" : "My plan"}${planned.length ? ` · ${planned.length}` : ""}`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6" role="tabpanel">
          {tab === "nearby" ? (
            <ul className="flex flex-col gap-2">
              {filteredCards.map((card) => (
                <li key={card.slug}>
                  <SiteCard site={card} />
                </li>
              ))}
            </ul>
          ) : (
            <PlanPanel lang={lang} track={track} names={names} onRoute={onRoute} />
          )}
        </div>
      </section>
    </div>
  );
}
