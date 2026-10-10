"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { SitePhoto } from "@/components/site-photo";
import { SAMPLE_SITES } from "@/lib/sample-sites";
import { plan, usePlan } from "@/lib/plan-store";
import type { Recommendation } from "@/lib/recommend";
import { TRACK_COLOR, TRACK_STORAGE_KEY, isTrackKey, type TrackKey } from "@/lib/tracks";

type Lang = "vi" | "en";

const COPY = {
  en: {
    title: "Where next",
    add: "Add to plan",
    added: "In plan",
    loading: "Finding good next stops…",
    view: "View plan on map",
  },
  vi: {
    title: "Đi đâu tiếp",
    add: "Thêm vào lộ trình",
    added: "Đã thêm",
    loading: "Đang tìm điểm đến tiếp theo…",
    view: "Xem lộ trình trên bản đồ",
  },
};

const siteOf = (slug: string) => SAMPLE_SITES.find((s) => s.slug === slug);

/** Three "next place" cards: drive time, why it fits, and Add to plan. */
export function NextPlaceCards({
  items,
  lang,
  track,
  showViewPlan = true,
}: {
  items: Recommendation[];
  lang: Lang;
  track: TrackKey;
  showViewPlan?: boolean;
}) {
  const planned = usePlan();
  const t = COPY[lang];
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {items.map((r) => {
          const inPlan = planned.includes(r.slug);
          return (
            <li
              key={r.slug}
              className="border-border bg-paper-card flex w-[78%] max-w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-[12px] border"
            >
              <SitePhoto
                photo={siteOf(r.slug)?.photo}
                gradient={siteOf(r.slug)?.hero_gradient ?? TRACK_COLOR[track]}
                lang={lang}
                width={400}
                decorative
                className="h-24 w-full"
              />
              <div className="flex flex-1 flex-col p-3">
                <Link href={`/site/${r.slug}`} className="min-w-0">
                  <p className="font-display text-fg truncate text-[17px] leading-tight">
                    {lang === "vi" ? r.name_vi : r.name_en}
                  </p>
                  <p className="font-display text-fg-muted truncate text-[12px] italic">
                    {lang === "vi" ? r.name_en : r.name_vi}
                  </p>
                </Link>
                <p className="text-fg-muted mt-1.5 flex-1 text-[12.5px] leading-snug">
                  {r.reason[lang]}
                </p>
                <button
                  type="button"
                  onClick={() => plan.toggle(r.slug)}
                  aria-pressed={inPlan}
                  className={
                    "mt-2.5 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium " +
                    (inPlan ? "border-border text-fg border" : "bg-primary text-paper")
                  }
                >
                  <Icon name={inPlan ? "check" : "plus"} size={14} />
                  {inPlan ? t.added : t.add}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {showViewPlan && planned.length > 0 && (
        <Link
          href={`/map?track=${track}&tab=plan`}
          className="text-primary inline-flex items-center gap-1.5 self-start text-[13px] font-medium"
        >
          <Icon name="pin" size={14} />
          {t.view} ({planned.length})
        </Link>
      )}
    </div>
  );
}

/** Self-loading section for site pages: suggestions from this site for the saved track. */
export function NextPlaces({
  fromSlug,
  lang,
  fallbackTrack,
}: {
  fromSlug: string;
  lang: Lang;
  fallbackTrack: TrackKey;
}) {
  const [track, setTrack] = useState<TrackKey>(fallbackTrack);
  const [items, setItems] = useState<Recommendation[] | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TRACK_STORAGE_KEY);
      if (isTrackKey(saved)) setTrack(saved);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    // Planned stops stay in the results so their cards show "In plan".
    const q = new URLSearchParams({ track, from: fromSlug, k: "3" });
    fetch(`/api/recommend?${q}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { recommendations: [] }))
      .then((d: { recommendations: Recommendation[] }) => setItems(d.recommendations))
      .catch(() => {});
    return () => ctrl.abort();
  }, [fromSlug, track]);

  const t = COPY[lang];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">{t.title}</h2>
      {items === null ? (
        <p className="text-fg-muted text-sm">{t.loading}</p>
      ) : (
        <NextPlaceCards items={items} lang={lang} track={track} />
      )}
    </section>
  );
}
