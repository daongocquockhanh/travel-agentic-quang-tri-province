"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { NextPlaceCards } from "@/components/next-places";
import { SitePhoto } from "@/components/site-photo";
import type { MapRoute } from "@/components/map-view";
import { plan, usePlan } from "@/lib/plan-store";
import type { Recommendation } from "@/lib/recommend";
import { SAMPLE_SITES } from "@/lib/sample-sites";
import type { Itinerary, Leg, Stop } from "@/lib/route";
import type { TrackKey } from "@/lib/tracks";

type Lang = "vi" | "en";

const COPY = {
  en: {
    empty: "Your plan is empty.",
    emptyHint: "Add places from the suggestions below or from any site page.",
    start: "Start",
    optimize: "Optimize order",
    optimizing: "Optimizing…",
    clear: "Clear",
    finish: "done by",
    drive: "drive",
    boat: "incl. boat",
    est: "est.",
    closed: "Likely closed on arrival",
    closes: "Closes during your visit",
    visit: "visit",
    reorder: "Drag to reorder, or use the arrow keys",
    remove: "Remove",
    error: "Couldn't build the route. Check your connection and try again.",
    suggestions: "Suggestions for your track",
    total: (h: string, km: number) => `${h} on the road · ${km} km`,
  },
  vi: {
    empty: "Lộ trình đang trống.",
    emptyHint: "Thêm địa điểm từ gợi ý bên dưới hoặc từ trang địa điểm.",
    start: "Xuất phát",
    optimize: "Sắp xếp tối ưu",
    optimizing: "Đang sắp xếp…",
    clear: "Xóa hết",
    finish: "xong lúc",
    drive: "lái xe",
    boat: "gồm tàu",
    est: "ước tính",
    closed: "Có thể đã đóng cửa khi tới",
    closes: "Đóng cửa trong lúc tham quan",
    visit: "tham quan",
    reorder: "Kéo để đổi thứ tự, hoặc dùng phím mũi tên",
    remove: "Bỏ",
    error: "Không tạo được lộ trình. Kiểm tra kết nối rồi thử lại.",
    suggestions: "Gợi ý theo hành trình của bạn",
    total: (h: string, km: number) => `${h} di chuyển · ${km} km`,
  },
};

function duration(min: number) {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

/**
 * The day plan as route cards. Owns fetching the itinerary for the current
 * plan and reports it upward so the map can draw the same route.
 */
export function PlanPanel({
  lang,
  track,
  names,
  onRoute,
}: {
  lang: Lang;
  track: TrackKey;
  /** slug → names, for stops the API returns (keeps cards rendering while refetching). */
  names: Record<string, { vi: string; en: string }>;
  onRoute: (route: MapRoute | null) => void;
}) {
  const t = COPY[lang];
  const slugs = usePlan();
  const key = slugs.join(",");
  const [startTime, setStartTime] = useState("08:00");
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [error, setError] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [suggestions, setSuggestions] = useState<Recommendation[]>([]);

  useEffect(() => {
    if (!slugs.length) {
      setItinerary(null);
      onRoute(null);
      return;
    }
    const ctrl = new AbortController();
    fetch("/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slugs, start_time: startTime, optimize: false }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Itinerary;
        setItinerary(data);
        setError(false);
        onRoute({ stops: data.stops, legs: data.legs });
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") setError(true);
      });
    return () => ctrl.abort();
    // `slugs` is captured through `key`; onRoute is stable from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, startTime]);

  // Suggestions continue from the last stop, skipping what's already planned.
  const last = slugs.at(-1);
  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ track, k: "3" });
    if (last) q.set("from", last);
    if (key) q.set("exclude", key);
    fetch(`/api/recommend?${q}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { recommendations: [] }))
      .then((d: { recommendations: Recommendation[] }) => setSuggestions(d.recommendations))
      .catch(() => {});
    return () => ctrl.abort();
  }, [track, key, last]);

  const optimize = async () => {
    setOptimizing(true);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slugs, start_time: startTime, optimize: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as Itinerary;
        plan.set(data.stops.map((s) => s.slug));
      }
    } finally {
      setOptimizing(false);
    }
  };

  const nameOf = (slug: string) => names[slug]?.[lang] ?? slug;

  // Drag-to-reorder by a stop's grip: the lifted card follows the finger and the
  // others slide aside; the new order is saved on release.
  const listRef = useRef<HTMLOListElement | null>(null);
  const [drag, setDrag] = useState<{
    slug: string;
    from: number;
    startY: number;
    dy: number;
    to: number;
    mids: number[];
    height: number;
  } | null>(null);
  const beginDrag = (slug: string, from: number, e: React.PointerEvent) => {
    const items = [...(listRef.current?.children ?? [])].map((li) => li.getBoundingClientRect());
    if (!items[from]) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      slug,
      from,
      startY: e.clientY,
      dy: 0,
      to: from,
      mids: items.map((r) => r.top + r.height / 2),
      height: items[from].height,
    });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const y = drag.mids[drag.from] + dy;
    const to = drag.mids.filter((m, i) => i !== drag.from && m < y).length;
    setDrag({ ...drag, dy, to });
  };
  const endDrag = () => {
    if (drag && drag.to !== drag.from) plan.moveTo(drag.slug, drag.to);
    setDrag(null);
  };
  const dragOffset = (i: number) => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.height;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.height;
    return 0;
  };
  // While a changed plan is refetching, show the new list without stale times.
  const current =
    itinerary && itinerary.stops.map((s) => s.slug).join(",") === key ? itinerary : null;

  return (
    <div className="flex flex-col gap-4">
      {slugs.length === 0 ? (
        <div className="border-border bg-paper-card rounded-[10px] border border-dashed p-4 text-center">
          <p className="font-display text-fg text-lg">{t.empty}</p>
          <p className="text-fg-muted mt-1 text-sm">{t.emptyHint}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="border-border bg-paper-card text-fg inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px]">
              <Icon name="clock" size={14} className="text-fg-muted" />
              {t.start}
              <input
                type="time"
                value={startTime}
                onChange={(e) => e.target.value && setStartTime(e.target.value)}
                className="bg-transparent font-mono text-[13px] outline-none"
              />
            </label>
            {slugs.length > 2 && (
              <button
                type="button"
                onClick={optimize}
                disabled={optimizing}
                className="bg-primary text-paper inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium disabled:opacity-60"
              >
                <Icon name="route" size={14} />
                {optimizing ? t.optimizing : t.optimize}
              </button>
            )}
            <button
              type="button"
              onClick={() => plan.clear()}
              className="text-fg-muted hover:text-fg ml-auto rounded-full px-2 py-1.5 text-[13px]"
            >
              {t.clear}
            </button>
          </div>

          {current && (
            <p className="text-fg-muted text-[12px]">
              {t.total(duration(current.total_travel_min), current.total_distance_km)} · {t.finish}{" "}
              <span className="font-mono">{current.end_time}</span>
            </p>
          )}
          {error && (
            <p className="text-fg-muted text-sm" role="alert">
              {t.error}
            </p>
          )}

          <ol ref={listRef} className="flex flex-col">
            {(
              current?.stops ?? slugs.map((slug) => ({ slug }) as Partial<Stop> & { slug: string })
            ).map((stop, i) => {
              const leg: Leg | undefined = current?.legs[i - 1];
              return (
                <li
                  key={stop.slug}
                  className={drag?.slug === stop.slug ? "relative z-10" : "relative"}
                  style={{
                    transform: `translateY(${dragOffset(i)}px)`,
                    transition: drag?.slug === stop.slug ? "none" : "transform 200ms ease",
                  }}
                >
                  {/* travel times are stale while dragging; they come back with the new order */}
                  {leg && !drag && <LegRow leg={leg} t={t} />}
                  <StopCard
                    n={i + 1}
                    stop={stop}
                    name={nameOf(stop.slug)}
                    altName={names[stop.slug]?.[lang === "vi" ? "en" : "vi"]}
                    lang={lang}
                    lifted={drag?.slug === stop.slug}
                    onGripDown={(e) => beginDrag(stop.slug, i, e)}
                    onGripMove={moveDrag}
                    onGripUp={endDrag}
                    t={t}
                  />
                </li>
              );
            })}
          </ol>
        </>
      )}

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-fg-muted text-[11px] font-medium tracking-[0.08em] uppercase">
            {t.suggestions}
          </p>
          <NextPlaceCards items={suggestions} lang={lang} track={track} showViewPlan={false} />
        </section>
      )}
    </div>
  );
}

function LegRow({ leg, t }: { leg: Leg; t: (typeof COPY)[Lang] }) {
  return (
    <div className="border-border text-fg-muted ml-[15px] flex items-center gap-2 border-l-2 border-dashed py-2 pl-5 text-[12px]">
      <Icon name={leg.mode === "drive+boat" ? "boat" : "car"} size={14} />
      <span>
        {duration(leg.travel_min)} {leg.mode === "drive+boat" ? t.boat : t.drive} ·{" "}
        {leg.distance_km} km
        {leg.estimated && <span className="text-fg-subtle"> ({t.est})</span>}
      </span>
    </div>
  );
}

function StopCard({
  n,
  stop,
  name,
  altName,
  lang,
  lifted,
  onGripDown,
  onGripMove,
  onGripUp,
  t,
}: {
  n: number;
  stop: Partial<Stop> & { slug: string };
  name: string;
  altName?: string;
  lang: Lang;
  lifted: boolean;
  onGripDown: (e: React.PointerEvent) => void;
  onGripMove: (e: React.PointerEvent) => void;
  onGripUp: () => void;
  t: (typeof COPY)[Lang];
}) {
  const site = SAMPLE_SITES.find((x) => x.slug === stop.slug);
  const warn =
    stop.hours_warning === "closed_on_arrival"
      ? t.closed
      : stop.hours_warning === "closes_during_visit"
        ? t.closes
        : null;
  return (
    <div
      className={
        "bg-paper-card flex items-start gap-3 rounded-[12px] border p-2.5 transition-shadow " +
        (lifted ? "border-primary shadow-lift" : "border-border")
      }
    >
      <div className="relative shrink-0">
        <SitePhoto
          photo={site?.photo}
          gradient={site?.hero_gradient ?? "var(--primary)"}
          lang={lang}
          width={160}
          decorative
          className="size-14 rounded-[8px]"
        />
        <span
          aria-hidden
          className="bg-primary text-paper ring-paper absolute -top-1.5 -left-1.5 grid size-6 place-items-center rounded-full font-sans text-[12px] font-semibold ring-2"
        >
          {n}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/site/${stop.slug}`}
          className="font-display text-fg block truncate text-[17px] leading-tight"
        >
          {name}
        </Link>
        {altName && (
          <p className="font-display text-fg-muted truncate text-[12px] italic">{altName}</p>
        )}
        {stop.arrive && (
          <p className="text-fg-muted mt-1 text-[12px]">
            <span className="text-fg font-mono">
              {stop.arrive}–{stop.depart}
            </span>{" "}
            · {duration(stop.visit_min ?? 0)} {t.visit}
          </p>
        )}
        {warn && (
          <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--warning)" }}>
            {warn}
          </p>
        )}
      </div>
      <IconButton label={t.remove} icon="x" onClick={() => plan.remove(stop.slug)} />
      <button
        type="button"
        aria-label={`${t.reorder}: ${name}`}
        title={t.reorder}
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            plan.move(stop.slug, e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        className="text-fg-muted hover:bg-paper-sunk hover:text-fg -mr-1 grid h-14 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-md active:cursor-grabbing"
      >
        <Icon name="grip" size={18} />
      </button>
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: "x";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="text-fg-muted hover:bg-paper-sunk hover:text-fg grid size-7 place-items-center rounded-full disabled:opacity-25"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
