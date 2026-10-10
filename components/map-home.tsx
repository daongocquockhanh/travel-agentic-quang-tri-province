"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapView, type MapRoute, type MapSite } from "@/components/map-view";
import { PlanPanel } from "@/components/plan-panel";
import { ModeMenu } from "@/components/mode-menu";
import { SiteCard, type SiteCardData } from "@/components/site-card";
import { GeofenceBanner } from "@/components/geofence-banner";
import { Icon } from "@/components/icon";
import { haversineMeters } from "@/lib/geo";
import { plan, usePlan } from "@/lib/plan-store";
import { useLocation } from "@/lib/use-location";
import { type TrackKey } from "@/lib/tracks";
import { useLang } from "@/lib/use-lang";

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

/** "You're here" radius (SYSTEM_DESIGN §7.1) and the "nearby" radius before we fall back to nearest. */
const GEOFENCE_M = 300;
const NEARBY_M = 2000;

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
  const { lang, toggle: toggleLang } = useLang(initialLang);
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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { status: locStatus, position, start: startLocation } = useLocation();

  // Distances from the traveller, once we know where they are.
  const distanceTo = useMemo(() => {
    if (!position) return null;
    return new Map(sites.map((s) => [s.slug, haversineMeters(position, s)]));
  }, [position, sites]);

  // Real geofence: the nearest site within 300 m; the ?demo= banner otherwise.
  const here = useMemo(() => {
    if (!distanceTo) return null;
    const nearest = sites
      .filter((s) => (distanceTo.get(s.slug) ?? Infinity) <= GEOFENCE_M)
      .sort((a, b) => distanceTo.get(a.slug)! - distanceTo.get(b.slug)!)[0];
    return nearest
      ? {
          slug: nearest.slug,
          name_vi: nearest.name_vi,
          name_en: nearest.name_en,
          track: nearest.primary_track,
        }
      : null;
  }, [distanceTo, sites]);
  const banner = here ?? demoBanner ?? null;

  // Each mode lists the places that belong to it.
  const trackCards = cards.filter((c) => c.tracks.includes(track));
  // With a position: real distances, nearest first, and whether anything is within 2 km.
  const filteredCards = distanceTo
    ? trackCards
        .map((c) => ({ ...c, distance_km: (distanceTo.get(c.slug) ?? 0) / 1000 }))
        .sort((a, b) => a.distance_km - b.distance_km)
    : trackCards;
  const nothingClose =
    distanceTo != null &&
    !filteredCards.some((c) => (c.distance_km ?? Infinity) * 1000 <= NEARBY_M);
  const vi = lang === "vi";

  return (
    <div className="relative h-screen overflow-hidden bg-[#2F4549]">
      <MapView
        sites={sites}
        activeTrack={track}
        onSitePick={(slug) => router.push(`/site/${slug}`)}
        route={planned.length ? route : null}
        you={position}
        lang={lang}
        bottomInset={0.55}
      />

      {/* top chrome */}
      <div className="absolute inset-x-3.5 top-[calc(0.875rem+var(--safe-top))] z-30 flex items-start justify-between gap-2">
        <ModeMenu track={track} lang={lang} onChange={setTrack} glass />
        <span className="flex-1" />
        <button
          type="button"
          onClick={startLocation}
          aria-label={vi ? "Dùng vị trí của tôi" : "Use my location"}
          aria-pressed={locStatus === "watching"}
          className={
            "border-border grid size-[34px] cursor-pointer place-items-center rounded-full border backdrop-blur-md " +
            (locStatus === "watching"
              ? "bg-primary text-paper"
              : "text-fg bg-[rgba(247,244,238,0.86)]")
          }
        >
          <Icon
            name="pin"
            size={16}
            className={locStatus === "locating" ? "animate-pulse" : undefined}
          />
        </button>
        <button
          type="button"
          onClick={toggleLang}
          aria-label={vi ? "Switch to English" : "Chuyển sang tiếng Việt"}
          className="border-border text-fg inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-[rgba(247,244,238,0.86)] px-3 py-1.5 font-sans text-[13px] font-medium backdrop-blur-md"
        >
          <Icon name="globe" size={14} />
          {vi ? "EN" : "VI"}
        </button>
        <Link
          href="/about"
          aria-label={vi ? "Giới thiệu và quyền riêng tư" : "About and privacy"}
          className="border-border text-fg grid size-[34px] place-items-center rounded-full border bg-[rgba(247,244,238,0.86)] backdrop-blur-md"
        >
          <Icon name="info" size={16} />
        </Link>
      </div>

      {/* geofence banner */}
      {banner && !dismissed.has(banner.slug) && (
        <div className="absolute inset-x-3.5 top-[calc(4rem+var(--safe-top))] z-20">
          <GeofenceBanner
            track={banner.track}
            nameVi={banner.name_vi}
            nameEn={banner.name_en}
            lang={lang}
            onPlay={() => router.push(`/site/${banner.slug}/tour`)}
            onRead={() => router.push(`/site/${banner.slug}`)}
            onDismiss={() => setDismissed((d) => new Set(d).add(banner.slug))}
          />
        </div>
      )}

      {/* bottom sheet (half height) */}
      <section
        className="bg-paper absolute inset-x-0 bottom-0 z-10 flex h-[55vh] flex-col overflow-hidden rounded-t-3xl shadow-[0_-16px_40px_-12px_rgba(31,36,40,.18)]"
        aria-label={vi ? "Địa điểm" : "Places"}
      >
        <button type="button" aria-label="Drag handle" className="pt-2.5 pb-1.5" tabIndex={-1}>
          <span className="bg-ink/20 mx-auto block h-1 w-9 rounded-full" />
        </button>

        <div className="px-4 pt-1 pb-3">
          <Link
            href={`/chat?track=${track}`}
            className="bg-primary text-paper shadow-soft flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-3"
          >
            <span className="bg-paper/15 grid size-9 shrink-0 place-items-center rounded-full">
              <Icon name="mic" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">
                {vi ? "Hỏi hướng dẫn viên" : "Ask the guide"}
              </span>
              <span className="block truncate text-[12.5px] opacity-80">
                {vi
                  ? "Lịch sử, lộ trình, giờ mở cửa — gõ hoặc nói"
                  : "History, routes, opening hours — type or talk"}
              </span>
            </span>
            <Icon name="arrow" size={18} />
          </Link>
        </div>

        <div
          role="tablist"
          className="bg-paper-sunk mx-4 mb-2 grid grid-cols-2 gap-1 rounded-full p-1"
        >
          {(["nearby", "plan"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={
                "rounded-full py-1.5 text-[13px] font-medium transition " +
                (tab === key
                  ? "bg-paper-card text-fg shadow-[0_1px_3px_rgba(31,36,40,.12)]"
                  : "text-fg-muted")
              }
            >
              {key === "nearby"
                ? `${vi ? "Địa điểm" : "Places"} · ${filteredCards.length}`
                : `${lang === "vi" ? "Lộ trình" : "My plan"}${planned.length ? ` · ${planned.length}` : ""}`}
            </button>
          ))}
        </div>

        <div
          className="flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+var(--safe-bottom))]"
          role="tabpanel"
        >
          {tab === "nearby" ? (
            <>
              <LocationNote
                status={locStatus}
                nothingClose={nothingClose}
                vi={vi}
                onRetry={startLocation}
              />
              <p className="text-fg-muted mb-2 text-[11px] font-medium tracking-[0.08em] uppercase">
                {distanceTo
                  ? vi
                    ? "Gần bạn nhất trước"
                    : "Nearest to you first"
                  : vi
                    ? "Khoảng cách tính từ Đông Hà"
                    : "Distances from Đông Hà"}
              </p>
              <ul className="flex flex-col gap-2">
                {filteredCards.map((card) => (
                  <li key={card.slug}>
                    <SiteCard site={card} lang={lang} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <PlanPanel lang={lang} track={track} names={names} onRoute={onRoute} />
          )}
        </div>
      </section>
    </div>
  );
}

/** Calm, actionable copy for location states (design brief: friendly, not alarmed). */
function LocationNote({
  status,
  nothingClose,
  vi,
  onRetry,
}: {
  status: ReturnType<typeof useLocation>["status"];
  nothingClose: boolean;
  vi: boolean;
  onRetry: () => void;
}) {
  let text: string | null = null;
  let action: string | null = null;
  if (status === "idle") {
    text = vi
      ? "Bật vị trí để biết bạn đang ở gần đâu."
      : "Turn on location to see what's near you.";
    action = vi ? "Dùng vị trí" : "Use my location";
  } else if (status === "locating") {
    text = vi ? "Đang xác định vị trí…" : "Finding where you are…";
  } else if (status === "denied") {
    text = vi
      ? "Vị trí đang tắt. Bạn vẫn có thể xem bản đồ và chọn một địa điểm bên dưới."
      : "Location is off. You can still browse the map and pick a place below.";
  } else if (status === "unavailable") {
    text = vi
      ? "Chưa xác định được vị trí. Bạn có thể chọn địa điểm bên dưới."
      : "Couldn't get your location. Pick a place below instead.";
    action = vi ? "Thử lại" : "Try again";
  } else if (nothingClose) {
    text = vi
      ? "Không có địa điểm nào trong vòng 2 km. Đây là những nơi gần bạn nhất."
      : "No sites within 2 km of you. These are the nearest.";
  }
  if (!text) return null;
  return (
    <div
      className="bg-paper-sunk text-fg-muted mb-2.5 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px]"
      role="status"
    >
      <Icon name="pin" size={14} className="shrink-0" />
      <span className="flex-1">{text}</span>
      {action && (
        <button type="button" onClick={onRetry} className="text-primary shrink-0 font-medium">
          {action}
        </button>
      )}
    </div>
  );
}
