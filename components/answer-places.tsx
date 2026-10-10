"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { SitePhoto } from "@/components/site-photo";
import { plan, usePlan } from "@/lib/plan-store";
import { SAMPLE_SITES } from "@/lib/sample-sites";
import { SITE_TYPE_LABEL, TRACK_COLOR } from "@/lib/tracks";

/**
 * Cards for the places named in a guide answer (Mindtrip-style): photo, what
 * it is, and the next steps (audio tour, add to plan) one tap away.
 */
export function AnswerPlaces({ slugs, lang }: { slugs: string[]; lang: "vi" | "en" }) {
  const planned = usePlan();
  const vi = lang === "vi";
  const sites = slugs.map((s) => SAMPLE_SITES.find((x) => x.slug === s)).filter((s) => s != null);
  if (!sites.length) return null;

  return (
    <ul className="-mx-1 flex w-full snap-x gap-2 overflow-x-auto px-1 pb-1">
      {sites.map((s) => {
        const inPlan = planned.includes(s.slug);
        return (
          <li
            key={s.slug}
            className={
              "border-border bg-paper-card flex shrink-0 snap-start gap-2.5 rounded-[12px] border p-2 " +
              (sites.length === 1 ? "w-full" : "w-[82%] max-w-[300px]")
            }
          >
            <Link href={`/site/${s.slug}`} className="shrink-0">
              <SitePhoto
                photo={s.photo}
                gradient={s.hero_gradient}
                lang={lang}
                width={200}
                decorative
                className="size-[68px] rounded-[8px]"
              />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/site/${s.slug}`} className="min-w-0">
                <p
                  className="text-[10px] font-medium tracking-[0.06em] uppercase"
                  style={{ color: TRACK_COLOR[s.tracks[0] ?? "foreign"] }}
                >
                  {SITE_TYPE_LABEL[s.type]?.[lang] ?? s.type}
                </p>
                <p className="font-display text-fg truncate text-[16px] leading-tight">
                  {vi ? s.name_vi : s.name_en}
                </p>
              </Link>
              <div className="mt-auto flex gap-1.5 pt-1.5">
                <Link
                  href={`/site/${s.slug}/tour`}
                  className="bg-primary text-paper inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium"
                >
                  <Icon name="headphones" size={12} />
                  {vi ? "Nghe" : "Tour"}
                </Link>
                <button
                  type="button"
                  onClick={() => plan.toggle(s.slug)}
                  aria-pressed={inPlan}
                  className="border-border text-fg aria-pressed:border-primary aria-pressed:text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium"
                >
                  <Icon name={inPlan ? "check" : "plus"} size={12} />
                  {inPlan ? (vi ? "Đã thêm" : "Added") : vi ? "Lộ trình" : "Plan"}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
