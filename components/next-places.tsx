"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { plan, usePlan } from "@/lib/plan-store";
import type { Recommendation } from "@/lib/recommend";
import { TRACK_COLOR, TRACK_STORAGE_KEY, isTrackKey, type TrackKey } from "@/lib/tracks";

type Lang = "vi" | "en";

const COPY = {
  en: { title: "Where next", add: "Add to plan", added: "In plan", loading: "Finding good next stops…", view: "View plan on map" },
  vi: { title: "Đi đâu tiếp", add: "Thêm vào lộ trình", added: "Đã thêm", loading: "Đang tìm điểm đến tiếp theo…", view: "Xem lộ trình trên bản đồ" },
};

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
              className="flex w-[78%] max-w-[280px] shrink-0 snap-start flex-col rounded-[12px] border border-border bg-paper-card p-3"
              style={{ borderTop: `3px solid ${TRACK_COLOR[track]}` }}
            >
              <Link href={`/site/${r.slug}`} className="min-w-0">
                <p className="truncate font-display text-[17px] leading-tight text-fg">
                  {lang === "vi" ? r.name_vi : r.name_en}
                </p>
                <p className="truncate font-display text-[12px] italic text-fg-muted">
                  {lang === "vi" ? r.name_en : r.name_vi}
                </p>
              </Link>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-snug text-fg-muted">{r.reason[lang]}</p>
              <button
                type="button"
                onClick={() => plan.toggle(r.slug)}
                aria-pressed={inPlan}
                className={
                  "mt-2.5 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium " +
                  (inPlan ? "border border-border text-fg" : "bg-primary text-paper")
                }
              >
                <Icon name={inPlan ? "check" : "plus"} size={14} />
                {inPlan ? t.added : t.add}
              </button>
            </li>
          );
        })}
      </ul>
      {showViewPlan && planned.length > 0 && (
        <Link
          href={`/map?track=${track}&tab=plan`}
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-primary"
        >
          <Icon name="pin" size={14} />
          {t.view} ({planned.length})
        </Link>
      )}
    </div>
  );
}

/** Self-loading section for site pages: suggestions from this site for the saved track. */
export function NextPlaces({ fromSlug, lang, fallbackTrack }: { fromSlug: string; lang: Lang; fallbackTrack: TrackKey }) {
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
      {items === null ? <p className="text-sm text-fg-muted">{t.loading}</p> : <NextPlaceCards items={items} lang={lang} track={track} />}
    </section>
  );
}
