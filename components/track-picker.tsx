"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/icon";
import { SitePhoto } from "@/components/site-photo";
import { TrackIcon } from "@/components/track-icon";
import { SAMPLE_SITES } from "@/lib/sample-sites";
import {
  TRACKS,
  TRACK_COLOR,
  TRACK_DESCRIPTION,
  TRACK_LABEL_EN,
  TRACK_LABEL_VI,
  TRACK_PHOTO_SITE,
  TRACK_STORAGE_KEY,
  type TrackKey,
} from "@/lib/tracks";
import { useLang, type Lang } from "@/lib/use-lang";

const COPY = {
  en: {
    eyebrow: "Quảng Trị · Vietnam",
    title: "Your guide to Quảng Trị",
    lead: "Stories of the places you stand on, a map of the province, and plans for your day, in English and Vietnamese.",
    how: [
      { icon: "pin", text: "Arrive at a site and hear its story" },
      { icon: "book", text: "Ask anything; history answers cite sources" },
      { icon: "route", text: "Get a day plan with travel times" },
    ],
    choose: "What brings you here?",
    chooseHint: "This sets the guide's tone and what it puts first. You can change it anytime.",
    browse: "Skip and browse the map",
    switchTo: "Tiếng Việt",
  },
  vi: {
    eyebrow: "Quảng Trị · Việt Nam",
    title: "Hướng dẫn viên Quảng Trị của bạn",
    lead: "Câu chuyện về nơi bạn đang đứng, bản đồ toàn tỉnh và lịch trình cho chuyến đi, bằng tiếng Việt và tiếng Anh.",
    how: [
      { icon: "pin", text: "Đến di tích là nghe kể chuyện nơi đó" },
      { icon: "book", text: "Hỏi bất cứ điều gì; câu trả lời lịch sử có dẫn nguồn" },
      { icon: "route", text: "Nhận lịch trình kèm thời gian di chuyển" },
    ],
    choose: "Bạn đến Quảng Trị vì điều gì?",
    chooseHint: "Lựa chọn này quyết định giọng kể và nội dung ưu tiên. Bạn có thể đổi bất cứ lúc nào.",
    browse: "Bỏ qua, xem bản đồ",
    switchTo: "English",
  },
} as const;

const site = (slug: string) => SAMPLE_SITES.find((s) => s.slug === slug)!;

export function TrackPicker({ initialLang, redirectTo = "/map" }: { initialLang: Lang; redirectTo?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { lang, toggle } = useLang(initialLang);
  const t = COPY[lang];
  const hero = site("hien-luong");

  function pick(track: TrackKey) {
    try {
      window.localStorage.setItem(TRACK_STORAGE_KEY, track);
    } catch {
      // storage may be unavailable (private mode) — non-fatal
    }
    startTransition(() => router.push(`${redirectTo}?track=${track}`));
  }

  return (
    <div className="flex flex-col pb-8">
      {/* hero */}
      <header className="relative">
        <SitePhoto
          photo={hero.photo}
          gradient={hero.hero_gradient}
          lang={lang}
          width={900}
          credit
          priority
          className="h-64 w-full"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(31,36,40,.78), rgba(31,36,40,.1) 60%)" }}
        />
        <button
          type="button"
          onClick={toggle}
          className="absolute right-3.5 top-3.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-paper/40 bg-ink/35 px-3 py-1.5 text-[13px] font-medium text-paper backdrop-blur-md"
        >
          <Icon name="globe" size={14} />
          {t.switchTo}
        </button>
        <div className="absolute inset-x-5 bottom-5 text-paper">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] opacity-85">{t.eyebrow}</p>
          <h1 className="mt-1 font-display text-[30px] leading-[1.1] tracking-tight">{t.title}</h1>
        </div>
      </header>

      <div className="px-5 pt-4">
        <p className="text-[15px] leading-[1.55] text-fg">{t.lead}</p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {t.how.map((h) => (
            <li key={h.text} className="flex items-center gap-3 text-[14px] text-fg">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper-sunk text-primary">
                <Icon name={h.icon} size={16} />
              </span>
              {h.text}
            </li>
          ))}
        </ul>

        <h2 className="mt-7 font-display text-[22px] leading-tight">{t.choose}</h2>
        <p className="mt-1 text-[13px] text-fg-muted">{t.chooseHint}</p>

        <ul className="mt-3.5 flex flex-col gap-3">
          {TRACKS.map((track) => {
            const s = site(TRACK_PHOTO_SITE[track]);
            return (
              <li key={track}>
                <button
                  type="button"
                  onClick={() => pick(track)}
                  disabled={isPending}
                  className="group flex w-full items-stretch overflow-hidden rounded-[14px] border border-border bg-paper-card text-left transition hover:border-border-strong disabled:opacity-60"
                >
                  <SitePhoto
                    photo={s.photo}
                    gradient={s.hero_gradient}
                    lang={lang}
                    width={240}
                    decorative
                    className="w-24 shrink-0"
                  />
                  <div className="flex-1 p-3.5">
                    <p className="flex items-center gap-1.5 font-display text-[18px] leading-tight text-fg">
                      <span style={{ color: TRACK_COLOR[track] }} className="inline-flex">
                        <TrackIcon track={track} size={16} />
                      </span>
                      {lang === "vi" ? TRACK_LABEL_VI[track] : TRACK_LABEL_EN[track]}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-fg-muted">{TRACK_DESCRIPTION[track][lang]}</p>
                  </div>
                  <span className="self-center pr-3 text-fg-muted transition group-hover:translate-x-0.5" aria-hidden>
                    <Icon name="arrow" size={18} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <Link href="/map" className="mt-5 block text-center text-[14px] font-medium text-primary">
          {t.browse}
        </Link>
      </div>
    </div>
  );
}
