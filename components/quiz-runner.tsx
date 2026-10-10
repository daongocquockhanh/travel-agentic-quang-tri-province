"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { SitePhoto } from "@/components/site-photo";
import { VisitButton } from "@/components/visit-button";
import { prepareAttempt, scoreAttempt, type AttemptQuestion } from "@/lib/quiz";
import { passport } from "@/lib/passport-store";
import type { QuizQuestion } from "@/lib/quiz-types";

export interface QuizSource {
  label: string;
  citation: string | null;
  href: string | null;
}

interface Props {
  questions: QuizQuestion[];
  lang: "vi" | "en";
  isDraft: boolean;
  /** Section → its label and citation, so each explanation shows where the answer comes from. */
  sources: Partial<Record<QuizQuestion["source"], QuizSource>>;
  site: {
    slug: string;
    name: string;
    hero_gradient: string;
    photo?: { file: string; alt_en: string; alt_vi: string };
  };
}

const T = {
  vi: {
    back: "Quay lại địa điểm",
    kicker: "Ôn lại chuyến thăm",
    progress: (i: number, n: number) => `Câu ${i} / ${n}`,
    correct: "Đúng",
    wrong: (a: string) => `Đáp án đúng: ${a}`,
    next: "Câu tiếp theo",
    finish: "Xem kết quả",
    readMore: "Đọc thêm",
    score: (s: number, n: number) => `Bạn trả lời đúng ${s} / ${n} câu`,
    perfect: "Bạn đã nhớ trọn câu chuyện của nơi này.",
    review: "Xem lại những câu chưa đúng",
    retake: "Làm lại",
    passport: "Xem hộ chiếu",
    draft: "Bộ câu hỏi này là bản nháp, đang chờ biên tập viên kiểm tra.",
    loading: "Đang chuẩn bị câu hỏi…",
  },
  en: {
    back: "Back to the site",
    kicker: "Remember your visit",
    progress: (i: number, n: number) => `Question ${i} of ${n}`,
    correct: "Correct",
    wrong: (a: string) => `The answer is: ${a}`,
    next: "Next question",
    finish: "See your result",
    readMore: "Read more",
    score: (s: number, n: number) => `You answered ${s} of ${n} correctly`,
    perfect: "You remembered the whole story of this place.",
    review: "Questions to look at again",
    retake: "Try again",
    passport: "View passport",
    draft: "These questions are a draft, waiting for an editor to check them.",
    loading: "Preparing questions…",
  },
} as const;

/**
 * A calm, untimed quiz: one question at a time, the explanation and its source
 * after every answer, and the best score saved to the passport. No confetti:
 * many of these places are memorials.
 */
export function QuizRunner({ questions, lang, isDraft, sources, site }: Props) {
  const t = T[lang];
  // Shuffled after mount so server and client render the same first frame.
  const [attempt, setAttempt] = useState<AttemptQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const start = () => {
    setAttempt(prepareAttempt(questions, lang));
    setIndex(0);
    setPicks([]);
    setDone(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- shuffle once per visit to the page
  useEffect(start, []);

  const current = attempt?.[index];
  const picked = picks[index];
  const answered = picked !== undefined;
  const result = done && attempt ? scoreAttempt(attempt, picks) : null;

  const choose = (i: number) => {
    if (answered || !attempt) return;
    const next = [...picks];
    next[index] = i;
    setPicks(next);
  };

  const advance = () => {
    if (!attempt) return;
    if (index + 1 < attempt.length) {
      setIndex(index + 1);
      return;
    }
    const { score, total } = scoreAttempt(attempt, picks);
    passport.recordQuiz(site.slug, score, total);
    setDone(true);
  };

  return (
    <main className="bg-paper text-fg mx-auto min-h-dvh w-full max-w-[420px] pb-[calc(3rem+var(--safe-bottom))]">
      <header className="relative">
        <SitePhoto
          photo={site.photo}
          gradient={site.hero_gradient}
          lang={lang}
          width={900}
          decorative
          className="h-40 w-full"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(31,36,40,.85), rgba(31,36,40,.15) 70%)" }}
        />
        <Link
          href={`/site/${site.slug}`}
          aria-label={t.back}
          className="text-fg absolute top-[calc(0.875rem+var(--safe-top))] left-3.5 z-10 grid size-9 place-items-center rounded-full bg-[rgba(247,244,238,0.9)] backdrop-blur-md"
        >
          <Icon name="back" size={18} />
        </Link>
        <div className="text-paper absolute inset-x-5 bottom-4">
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase opacity-90">{t.kicker}</p>
          <h1 className="font-display text-[24px] leading-tight font-medium">{site.name}</h1>
        </div>
      </header>

      <div className="px-4 pt-4">
        {isDraft && (
          <p className="bg-paper-sunk text-fg-muted mb-4 flex gap-2 rounded-[10px] px-3 py-2 text-[12.5px]">
            <Icon name="book" size={14} className="mt-0.5 shrink-0" />
            {t.draft}
          </p>
        )}

        {!attempt && <p className="text-fg-muted py-10 text-center text-[14px]">{t.loading}</p>}

        {attempt && current && !done && (
          <section aria-labelledby="quiz-q">
            <div className="flex items-center justify-between">
              <p className="text-fg-muted text-[12.5px]">{t.progress(index + 1, attempt.length)}</p>
              <div className="flex gap-1" aria-hidden>
                {attempt.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-5 rounded-full ${i < index || (i === index && answered) ? "bg-primary" : "bg-border"}`}
                  />
                ))}
              </div>
            </div>

            <h2 id="quiz-q" className="font-display mt-3 text-[21px] leading-snug">
              {current.q}
            </h2>

            <ul className="mt-4 flex flex-col gap-2">
              {current.options.map((option, i) => {
                const isRight = answered && i === current.correct;
                const isWrongPick = answered && i === picked && i !== current.correct;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => choose(i)}
                      disabled={answered}
                      aria-pressed={picked === i}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-[15px] transition-colors ${
                        isRight
                          ? "border-primary bg-primary/10"
                          : isWrongPick
                            ? "border-fg-muted bg-paper-sunk"
                            : "border-border bg-paper-card"
                      } ${answered ? "" : "active:bg-paper-sunk"}`}
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full border text-[12px] ${
                          isRight ? "border-primary bg-primary text-paper" : "border-border"
                        }`}
                        aria-hidden
                      >
                        {isRight ? <Icon name="check" size={14} /> : String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-0 flex-1">{option}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div aria-live="polite">
              {answered && (
                <div className="border-border bg-paper-card mt-4 rounded-2xl border p-3.5">
                  <p className="text-[14px] font-medium">
                    {picked === current.correct ? t.correct : t.wrong(current.options[current.correct])}
                  </p>
                  <p className="text-fg mt-1 text-[14px] leading-relaxed">{current.explain}</p>
                  <SourceLine source={sources[current.source]} readMore={t.readMore} slug={site.slug} />
                </div>
              )}
            </div>

            {answered && (
              <button
                type="button"
                onClick={advance}
                className="bg-primary text-paper shadow-soft mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[15px] font-medium"
              >
                {index + 1 < attempt.length ? t.next : t.finish}
                <Icon name="arrow" size={16} />
              </button>
            )}
          </section>
        )}

        {result && (
          <section aria-live="polite">
            <p className="font-display text-center text-[22px] leading-snug">{t.score(result.score, result.total)}</p>
            {result.missed.length === 0 ? (
              <p className="text-fg-muted mt-2 text-center text-[14px]">{t.perfect}</p>
            ) : (
              <div className="mt-5">
                <h2 className="text-fg-muted text-[12px] font-semibold tracking-[0.08em] uppercase">{t.review}</h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {result.missed.map((m) => (
                    <li key={m.id} className="border-border bg-paper-card rounded-2xl border p-3.5">
                      <p className="text-[14px] font-medium">{m.q}</p>
                      <p className="text-primary mt-1 text-[14px]">{m.options[m.correct]}</p>
                      <p className="text-fg-muted mt-1 text-[13.5px] leading-relaxed">{m.explain}</p>
                      <SourceLine source={sources[m.source]} readMore={t.readMore} slug={site.slug} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5">
              <VisitButton slug={site.slug} lang={lang} />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={start}
                className="border-border bg-paper-card flex-1 rounded-full border px-4 py-3 text-[14.5px] font-medium"
              >
                {t.retake}
              </button>
              <Link
                href="/passport"
                className="bg-primary text-paper flex flex-1 items-center justify-center rounded-full px-4 py-3 text-[14.5px] font-medium"
              >
                {t.passport}
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function SourceLine({ source, readMore, slug }: { source?: QuizSource; readMore: string; slug: string }) {
  if (!source) return null;
  return (
    <p className="text-fg-muted mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px]">
      <Icon name="book" size={13} />
      <Link href={`/site/${slug}`} className="text-primary underline-offset-2 hover:underline">
        {readMore}: {source.label}
      </Link>
      {source.citation &&
        (source.href ? (
          <a href={source.href} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
            · {source.citation}
          </a>
        ) : (
          <span>· {source.citation}</span>
        ))}
    </p>
  );
}
