"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { NextPlaceCards } from "@/components/next-places";
import type { MapRoute } from "@/components/map-view";
import { plan, usePlan } from "@/lib/plan-store";
import type { Recommendation } from "@/lib/recommend";
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
    up: "Move earlier",
    down: "Move later",
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
    up: "Lên trước",
    down: "Xuống sau",
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
  // While a changed plan is refetching, show the new list without stale times.
  const current = itinerary && itinerary.stops.map((s) => s.slug).join(",") === key ? itinerary : null;

  return (
    <div className="flex flex-col gap-4">
      {slugs.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-paper-card p-4 text-center">
          <p className="font-display text-lg text-fg">{t.empty}</p>
          <p className="mt-1 text-sm text-fg-muted">{t.emptyHint}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper-card px-3 py-1.5 text-[13px] text-fg">
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
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-medium text-paper disabled:opacity-60"
              >
                <Icon name="route" size={14} />
                {optimizing ? t.optimizing : t.optimize}
              </button>
            )}
            <button
              type="button"
              onClick={() => plan.clear()}
              className="ml-auto rounded-full px-2 py-1.5 text-[13px] text-fg-muted hover:text-fg"
            >
              {t.clear}
            </button>
          </div>

          {current && (
            <p className="text-[12px] text-fg-muted">
              {t.total(duration(current.total_travel_min), current.total_distance_km)} · {t.finish}{" "}
              <span className="font-mono">{current.end_time}</span>
            </p>
          )}
          {error && (
            <p className="text-sm text-fg-muted" role="alert">
              {t.error}
            </p>
          )}

          <ol className="flex flex-col">
            {(current?.stops ?? slugs.map((slug) => ({ slug }) as Partial<Stop> & { slug: string })).map((stop, i) => {
              const leg: Leg | undefined = current?.legs[i - 1];
              return (
                <li key={stop.slug}>
                  {leg && <LegRow leg={leg} t={t} />}
                  <StopCard
                    n={i + 1}
                    stop={stop}
                    name={nameOf(stop.slug)}
                    altName={names[stop.slug]?.[lang === "vi" ? "en" : "vi"]}
                    first={i === 0}
                    last={i === slugs.length - 1}
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
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">{t.suggestions}</p>
          <NextPlaceCards items={suggestions} lang={lang} track={track} showViewPlan={false} />
        </section>
      )}
    </div>
  );
}

function LegRow({ leg, t }: { leg: Leg; t: (typeof COPY)[Lang] }) {
  return (
    <div className="ml-[15px] flex items-center gap-2 border-l-2 border-dashed border-border py-2 pl-5 text-[12px] text-fg-muted">
      <Icon name={leg.mode === "drive+boat" ? "boat" : "car"} size={14} />
      <span>
        {duration(leg.travel_min)} {leg.mode === "drive+boat" ? t.boat : t.drive} · {leg.distance_km} km
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
  first,
  last,
  t,
}: {
  n: number;
  stop: Partial<Stop> & { slug: string };
  name: string;
  altName?: string;
  first: boolean;
  last: boolean;
  t: (typeof COPY)[Lang];
}) {
  const warn = stop.hours_warning === "closed_on_arrival" ? t.closed : stop.hours_warning === "closes_during_visit" ? t.closes : null;
  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-border bg-paper-card p-3">
      <span
        aria-hidden
        className="grid size-[30px] shrink-0 place-items-center rounded-full bg-primary font-sans text-[13px] font-semibold text-paper"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/site/${stop.slug}`} className="block truncate font-display text-[17px] leading-tight text-fg">
          {name}
        </Link>
        {altName && <p className="truncate font-display text-[12px] italic text-fg-muted">{altName}</p>}
        {stop.arrive && (
          <p className="mt-1 text-[12px] text-fg-muted">
            <span className="font-mono text-fg">
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
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <IconButton label={t.up} icon="chevronUp" disabled={first} onClick={() => plan.move(stop.slug, -1)} />
        <IconButton label={t.down} icon="chevronDown" disabled={last} onClick={() => plan.move(stop.slug, 1)} />
      </div>
      <IconButton label={t.remove} icon="x" onClick={() => plan.remove(stop.slug)} />
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
  icon: "chevronUp" | "chevronDown" | "x";
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
      className="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-paper-sunk hover:text-fg disabled:opacity-25"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
