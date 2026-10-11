"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { SitePhoto } from "@/components/site-photo";
import { stampState, type StampState } from "@/lib/passport";
import { passport, usePassport } from "@/lib/passport-store";

export interface PassportSite {
  slug: string;
  name: string;
  hero_gradient: string;
  photo?: { file: string; alt_en: string; alt_vi: string };
  hasQuiz: boolean;
}

const T = {
  vi: {
    title: "Hộ chiếu du lịch",
    lead: "Mỗi địa điểm được đóng dấu khi bạn đã đến nơi và làm xong bài ôn tập.",
    progress: (s: number, n: number) => `${s} / ${n} địa điểm đã có dấu`,
    state: {
      none: "Chưa đến",
      visited: "Đã đến · chưa làm bài",
      quizzed: "Đã làm bài · chưa đến",
      stamped: "Đã đóng dấu",
    } satisfies Record<StampState, string>,
    best: (b: number, t: number) => `Điểm cao nhất ${b}/${t}`,
    self: "tự xác nhận",
    quiz: "Làm bài",
    noQuiz: "Chưa có bài ôn tập",
    device: "Hộ chiếu chỉ lưu trên thiết bị này. Xoá dữ liệu trình duyệt sẽ xoá hộ chiếu.",
    clear: "Xoá hộ chiếu",
    confirm: "Xoá toàn bộ dấu và điểm trên thiết bị này?",
    back: "Quay lại bản đồ",
  },
  en: {
    title: "Travel passport",
    lead: "Each place gets a stamp once you've been there and finished its quiz.",
    progress: (s: number, n: number) => `${s} of ${n} places stamped`,
    state: {
      none: "Not visited yet",
      visited: "Visited · quiz to do",
      quizzed: "Quiz done · not visited yet",
      stamped: "Stamped",
    } satisfies Record<StampState, string>,
    best: (b: number, t: number) => `Best score ${b}/${t}`,
    self: "self-reported",
    quiz: "Take the quiz",
    noQuiz: "No quiz yet",
    device: "Your passport lives on this device only. Clearing browser data clears it.",
    clear: "Clear passport",
    confirm: "Clear every stamp and score on this device?",
    back: "Back to the map",
  },
} as const;

export function PassportGrid({ sites, lang }: { sites: PassportSite[]; lang: "vi" | "en" }) {
  const t = T[lang];
  const p = usePassport();
  const stamped = sites.filter((s) => stampState(p, s.slug) === "stamped").length;
  const hasAny = Object.keys(p.visits).length > 0 || Object.keys(p.quizzes).length > 0;

  return (
    <main className="bg-paper text-fg mx-auto min-h-dvh w-full max-w-[420px] px-4 pt-[calc(1rem+var(--safe-top))] pb-[calc(3rem+var(--safe-bottom))]">
      <Link
        href="/map"
        aria-label={t.back}
        className="border-border bg-paper-card grid size-9 place-items-center rounded-full border"
      >
        <Icon name="back" size={18} />
      </Link>
      <h1 className="font-display mt-4 text-[28px] leading-tight">{t.title}</h1>
      <p className="text-fg-muted mt-1 text-[14px]">{t.lead}</p>

      <div className="mt-4" aria-live="polite">
        <p className="text-[14px] font-medium">{t.progress(stamped, sites.length)}</p>
        <div className="bg-paper-sunk mt-2 h-2 overflow-hidden rounded-full" aria-hidden>
          <div
            className="bg-primary h-full rounded-full transition-[width]"
            style={{ width: `${sites.length ? (stamped / sites.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3">
        {sites.map((site) => {
          const state = stampState(p, site.slug);
          const quiz = p.quizzes[site.slug];
          const visit = p.visits[site.slug];
          return (
            <li
              key={site.slug}
              className={`border-border bg-paper-card overflow-hidden rounded-2xl border ${state === "none" ? "opacity-75" : ""}`}
            >
              <Link href={`/site/${site.slug}`} className="relative block">
                <SitePhoto
                  photo={site.photo}
                  gradient={site.hero_gradient}
                  lang={lang}
                  width={400}
                  decorative
                  className={`h-24 w-full ${state === "none" ? "grayscale" : ""}`}
                />
                {state === "stamped" && (
                  <span
                    className="border-paper bg-primary text-paper shadow-soft absolute top-2 right-2 grid size-9 rotate-[-12deg] place-items-center rounded-full border-2"
                    aria-hidden
                  >
                    <Icon name="check" size={18} />
                  </span>
                )}
              </Link>
              <div className="p-2.5">
                <p className="font-display truncate text-[15px] leading-tight">{site.name}</p>
                <p className="text-fg-muted mt-0.5 text-[11.5px]">
                  {t.state[state]}
                  {visit?.method === "self" && ` · ${t.self}`}
                </p>
                {quiz && (
                  <p className="text-fg-muted text-[11.5px]">{t.best(quiz.best, quiz.total)}</p>
                )}
                {site.hasQuiz ? (
                  state !== "stamped" &&
                  !quiz && (
                    <Link
                      href={`/site/${site.slug}/quiz`}
                      className="text-primary mt-1.5 inline-block text-[12.5px] font-medium"
                    >
                      {t.quiz}
                    </Link>
                  )
                ) : (
                  <p className="text-fg-muted mt-1.5 text-[11.5px] italic">{t.noQuiz}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-fg-muted mt-6 text-center text-[12px]">{t.device}</p>
      {hasAny && (
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t.confirm)) passport.clear();
            }}
            className="text-fg-muted text-[12.5px] underline underline-offset-2"
          >
            {t.clear}
          </button>
        </div>
      )}
    </main>
  );
}
