"use client";

import Link from "next/link";
import { AddToPlanButton } from "@/components/add-to-plan";
import { Icon } from "@/components/icon";
import { formatDistance, type SiteCardData } from "@/components/site-card";
import { SitePhoto } from "@/components/site-photo";
import { formatHours } from "@/lib/format";
import { SITE_TYPE_LABEL, TRACK_COLOR } from "@/lib/tracks";

/**
 * What a tapped pin opens in the map's bottom sheet: enough to decide
 * (photo, what it is, how far, when open) and the next steps, without
 * leaving the map.
 */
export function PlacePreview({
  site,
  lang,
  distanceBasis,
  onClose,
}: {
  site: SiteCardData;
  lang: "vi" | "en";
  /** "you" when distances are from the traveller, else from Đông Hà. */
  distanceBasis: "you" | "dong-ha";
  onClose: () => void;
}) {
  const vi = lang === "vi";
  const primary = vi ? site.name_vi : site.name_en;
  const secondary = vi ? site.name_en : site.name_vi;
  const distance =
    site.distance_km != null
      ? `${formatDistance(site.distance_km)} ${
          distanceBasis === "you"
            ? vi
              ? "từ bạn"
              : "from you"
            : vi
              ? "từ Đông Hà"
              : "from Đông Hà"
        }`
      : null;

  return (
    <div className="px-4 pb-[calc(1rem+var(--safe-bottom))]">
      <div className="flex items-start gap-3">
        <SitePhoto
          photo={site.photo}
          gradient={site.hero_gradient}
          lang={lang}
          width={300}
          decorative
          className="size-[88px] shrink-0 rounded-[12px]"
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-[10.5px] font-medium tracking-[0.06em] uppercase"
            style={{ color: TRACK_COLOR[site.primary_track] }}
          >
            {SITE_TYPE_LABEL[site.type]?.[lang] ?? site.type}
          </p>
          <h2 className="font-display text-fg text-[20px] leading-tight">{primary}</h2>
          <p className="font-display text-fg-muted truncate text-[13px] italic">{secondary}</p>
          <p className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px]">
            {distance && <span>{distance}</span>}
            {distance && site.hours && <span aria-hidden>·</span>}
            {site.hours && (
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" size={11} />
                {formatHours(site.hours, lang)}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={vi ? "Đóng" : "Close"}
          className="text-fg-muted hover:text-fg bg-paper-sunk -mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <Link
          href={`/site/${site.slug}/tour`}
          className="bg-primary text-paper flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-[14px] font-medium"
        >
          <Icon name="headphones" size={16} />
          {vi ? "Nghe thuyết minh" : "Audio tour"}
        </Link>
        <Link
          href={`/site/${site.slug}`}
          className="border-border bg-paper-card text-fg flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-[14px] font-medium"
        >
          <Icon name="book" size={15} />
          {vi ? "Xem chi tiết" : "Details"}
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <AddToPlanButton slug={site.slug} lang={lang} />
        <Link
          href={`/chat?site=${site.slug}`}
          className="border-border bg-paper-card text-fg flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-[14px] font-medium"
        >
          <Icon name="mic" size={15} />
          {vi ? "Hỏi về nơi này" : "Ask about it"}
        </Link>
      </div>
    </div>
  );
}
