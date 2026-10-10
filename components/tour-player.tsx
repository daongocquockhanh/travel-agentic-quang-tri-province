"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { SitePhoto } from "@/components/site-photo";
import { commonsImageUrl } from "@/lib/photos";
import { formatMinutes, listenSeconds, speechPieces, type Tour } from "@/lib/tours";
import type { TtsVoice } from "@/lib/voice/config";
import { SpeechPlayer, type PlayerState } from "@/lib/voice/player";

type Lang = "vi" | "en";
type Photo = { file: string; alt_en: string; alt_vi: string };

const COPY = {
  en: {
    eyebrow: "Audio tour",
    stops: (n: number) => `${n} stops`,
    stopOf: (i: number, n: number) => `Stop ${i} of ${n}`,
    allStops: "All stops",
    play: "Play",
    pause: "Pause",
    prev: "Previous stop",
    next: "Next stop",
    back: "Back to the place",
    draft:
      "This tour is a draft, retold from the place's sources and waiting for an editor's check.",
    auto: "Read from this place's sections; a narrated script is coming.",
    blocked: "Tap play to start the audio.",
    failed: "Audio isn't available right now. You can read along instead.",
    doneTitle: "Tour complete",
    doneBody: "Have a question about what you just heard?",
    ask: "Ask the guide",
    restart: "Start again",
    sources: "Sources",
    resumed: (i: number) => `Picking up at stop ${i}.`,
  },
  vi: {
    eyebrow: "Thuyết minh",
    stops: (n: number) => `${n} điểm dừng`,
    stopOf: (i: number, n: number) => `Điểm ${i}/${n}`,
    allStops: "Các điểm dừng",
    play: "Phát",
    pause: "Tạm dừng",
    prev: "Điểm trước",
    next: "Điểm tiếp theo",
    back: "Về trang địa điểm",
    draft:
      "Bài thuyết minh này là bản nháp, kể lại từ các nguồn của địa điểm và đang chờ biên tập viên kiểm tra.",
    auto: "Đọc từ các mục của địa điểm; bài thuyết minh riêng sẽ sớm có.",
    blocked: "Nhấn Phát để bắt đầu nghe.",
    failed: "Hiện chưa phát được âm thanh. Bạn có thể đọc theo bên dưới.",
    doneTitle: "Đã nghe hết",
    doneBody: "Bạn còn câu hỏi về những gì vừa nghe?",
    ask: "Hỏi hướng dẫn viên",
    restart: "Nghe lại từ đầu",
    sources: "Nguồn tư liệu",
    resumed: (i: number) => `Tiếp tục từ điểm ${i}.`,
  },
} as const;

/** Each stop's text as paragraphs of speakable pieces, so the transcript can follow the voice. */
function piecesOf(body: string) {
  let n = 0;
  return body
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((para) => speechPieces(para).map((text) => ({ text, index: n++ })));
}

/**
 * Plays a site's audio tour stop by stop (SmartGuide / Rick Steves style):
 * chapters, a transcript that follows the voice, auto-advance, lock-screen
 * controls where the browser supports them, and resume on return.
 */
export function TourPlayer({
  tour,
  site,
  lang,
  voice,
}: {
  tour: Tour;
  site: { slug: string; name: string; hero_gradient: string; photo?: Photo | null };
  lang: Lang;
  voice: TtsVoice;
}) {
  const t = COPY[lang];
  const storageKey = `qt.tour.${site.slug}.${lang}`;
  const stops = tour.stops;
  const paragraphs = useMemo(() => stops.map((s) => piecesOf(s.body)), [stops]);
  const pieces = useMemo(() => paragraphs.map((ps) => ps.flat().map((p) => p.text)), [paragraphs]);
  const durations = useMemo(() => stops.map((s) => listenSeconds(s.body, lang)), [stops, lang]);
  const total = durations.reduce((a, b) => a + b, 0);

  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [piece, setPiece] = useState(0);
  const [heard, setHeard] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Mutable playback bookkeeping the player callback reads without re-subscribing.
  const run = useRef({ stop: 0, offset: 0, started: false, userStopped: false });
  const playerRef = useRef<SpeechPlayer | null>(null);
  const advance = useRef<(from: number) => void>(() => {});

  const onPlayerChange = useCallback(
    (s: PlayerState) => {
      const r = run.current;
      if (s.speaking) {
        r.started = true;
        setPiece(r.offset + s.item);
      }
      if (s.error === "blocked") {
        setPlaying(false);
        setNotice(t.blocked);
      } else if (s.error === "tts_failed") {
        setNotice(t.failed);
      }
      // The group drained on its own: the stop is finished.
      if (!s.speaking && r.started && !r.userStopped) {
        r.started = false;
        setHeard((h) => new Set(h).add(r.stop));
        advance.current(r.stop);
      }
    },
    [t],
  );

  const getPlayer = useCallback(() => {
    playerRef.current ??= new SpeechPlayer({
      lang: () => lang,
      voice: () => voice,
      onChange: onPlayerChange,
    });
    return playerRef.current;
  }, [lang, voice, onPlayerChange]);

  const playStop = useCallback(
    (index: number, fromPiece = 0) => {
      const player = getPlayer();
      run.current = { stop: index, offset: fromPiece, started: false, userStopped: false };
      setCurrent(index);
      setPiece(fromPiece);
      setPlaying(true);
      setDone(false);
      setNotice(null);
      player.begin(`${site.slug}:${index}`);
      pieces[index].slice(fromPiece).forEach((p) => player.enqueue(p));
    },
    [getPlayer, pieces, site.slug],
  );

  const pause = useCallback(() => {
    run.current.userStopped = true;
    playerRef.current?.stop();
    setPlaying(false);
  }, []);

  advance.current = (from: number) => {
    if (from + 1 < stops.length) {
      playStop(from + 1);
    } else {
      setPlaying(false);
      setDone(true);
    }
  };

  const toggle = () => {
    if (playing) return pause();
    getPlayer().unlock(); // inside the tap, before any await
    playStop(current, done ? 0 : piece);
  };

  const jump = (index: number) => {
    if (index < 0 || index >= stops.length) return;
    if (playing) {
      getPlayer().unlock();
      playStop(index);
    } else {
      run.current.userStopped = true;
      setCurrent(index);
      setPiece(0);
      setDone(false);
    }
  };

  // Resume where the traveller left off.
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      if (saved > 0 && saved < stops.length) {
        setCurrent(saved);
        setNotice(t.resumed(saved + 1));
      }
    } catch {
      /* storage unavailable */
    }
  }, [storageKey, stops.length, t]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(done ? 0 : current));
    } catch {
      /* storage unavailable */
    }
  }, [current, done, storageKey]);

  // Keep what is being heard on screen: the new stop as playback moves on, then the end card.
  const stopCard = useRef<HTMLElement | null>(null);
  const doneCard = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (playing) stopCard.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current, playing]);
  useEffect(() => {
    if (done) doneCard.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [done]);

  // Stop the voice when leaving the page.
  useEffect(() => () => playerRef.current?.stop(), []);

  // Lock-screen / headset controls (Media Session API), where supported.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: stops[current].title,
      artist: site.name,
      album: t.eyebrow,
      artwork: site.photo ? [{ src: commonsImageUrl(site.photo.file, 512), sizes: "512x512" }] : [],
    });
    ms.playbackState = playing ? "playing" : "paused";
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => playStop(run.current.stop, piece)],
      ["pause", pause],
      ["previoustrack", () => jump(current - 1)],
      ["nexttrack", () => jump(current + 1)],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* action unsupported */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* action unsupported */
        }
      }
    };
  });

  const stop = stops[current];

  return (
    <main className="bg-paper text-fg mx-auto min-h-dvh w-full max-w-[420px] pb-[calc(9rem+var(--safe-bottom))]">
      <header className="relative">
        <SitePhoto
          photo={site.photo}
          gradient={site.hero_gradient}
          lang={lang}
          width={900}
          credit
          creditAt="top-right"
          priority
          className="h-52 w-full"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(31,36,40,.85), rgba(31,36,40,.1) 60%, rgba(31,36,40,.3))",
          }}
        />
        <Link
          href={`/site/${site.slug}`}
          aria-label={t.back}
          className="text-fg absolute top-[calc(0.875rem+var(--safe-top))] left-3.5 z-10 grid size-9 place-items-center rounded-full bg-[rgba(247,244,238,0.9)] backdrop-blur-md"
        >
          <Icon name="back" size={18} />
        </Link>
        <div className="text-paper absolute inset-x-5 bottom-4">
          <p
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase"
            style={{ color: "#F2C27A" }}
          >
            <Icon name="headphones" size={13} />
            {t.eyebrow}
          </p>
          <h1 className="font-display mt-1 text-[26px] leading-[1.1] font-medium tracking-tight">
            {site.name}
          </h1>
          <p className="mt-1 text-[13px] opacity-85">
            {t.stops(stops.length)} · {formatMinutes(total, lang)}
          </p>
        </div>
      </header>

      <div className="px-4">
        {(tour.review_status === "draft" || !tour.authored) && (
          <p className="bg-paper-sunk text-fg-muted mt-4 flex gap-2 rounded-[10px] px-3 py-2 text-[12.5px]">
            <Icon name="book" size={14} className="mt-0.5 shrink-0" />
            {tour.authored ? t.draft : t.auto}
          </p>
        )}

        {/* the stop being heard, with a transcript that follows the voice */}
        <section
          ref={stopCard}
          aria-live="polite"
          className="border-border bg-paper-card mt-4 scroll-mt-[calc(1rem+var(--safe-top))] rounded-[16px] border p-4"
        >
          <p className="text-fg-muted text-[12px] font-medium tracking-[0.06em] uppercase">
            {t.stopOf(current + 1, stops.length)} · {formatMinutes(durations[current], lang)}
          </p>
          <h2 className="font-display mt-1 text-[22px] leading-tight">{stop.title}</h2>
          {stop.cue && (
            <p className="text-primary mt-1.5 flex items-center gap-1.5 text-[13.5px] font-medium">
              <Icon name="pin" size={14} />
              {stop.cue}
            </p>
          )}
          <div className="mt-3 space-y-3 text-[16px] leading-[1.65]">
            {paragraphs[current].map((para, i) => (
              <p key={i}>
                {para.map((p) => (
                  <span
                    key={p.index}
                    className={
                      playing && p.index === piece
                        ? "rounded-[3px] bg-yellow-300/40 transition-colors"
                        : "transition-colors"
                    }
                  >
                    {p.text}{" "}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </section>

        {done && (
          <section ref={doneCard} className="bg-primary text-paper mt-4 rounded-[16px] p-4">
            <p className="font-display text-[20px]">{t.doneTitle}</p>
            <p className="mt-1 text-[14px] opacity-90">{t.doneBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/chat?site=${site.slug}`}
                className="bg-paper text-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium"
              >
                <Icon name="mic" size={15} />
                {t.ask}
              </Link>
              <button
                type="button"
                onClick={() => {
                  getPlayer().unlock();
                  setHeard(new Set());
                  playStop(0);
                }}
                className="border-paper/50 rounded-full border px-4 py-2 text-[14px] font-medium"
              >
                {t.restart}
              </button>
            </div>
          </section>
        )}

        {/* chapters */}
        <h3 className="font-display mt-6 text-[18px]">{t.allStops}</h3>
        <ol className="border-border bg-paper-card divide-border mt-2 divide-y rounded-[14px] border">
          {stops.map((s, i) => {
            const isCurrent = i === current;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => jump(i)}
                  aria-current={isCurrent ? "step" : undefined}
                  className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
                >
                  <span
                    className={
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold " +
                      (isCurrent
                        ? "bg-primary text-paper"
                        : heard.has(i)
                          ? "bg-paper-sunk text-primary"
                          : "border-border text-fg-muted border")
                    }
                  >
                    {heard.has(i) && !isCurrent ? <Icon name="check" size={14} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        "block text-[15px] leading-snug " + (isCurrent ? "font-medium" : "")
                      }
                    >
                      {s.title}
                    </span>
                    {s.cue && (
                      <span className="text-fg-muted mt-0.5 block text-[12.5px]">{s.cue}</span>
                    )}
                  </span>
                  <span className="text-fg-muted shrink-0 pt-0.5 text-[12px]">
                    {formatMinutes(durations[i], lang)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {tour.citations.length > 0 && (
          <details className="border-border bg-paper-card mt-5 rounded-[12px] border p-3 text-[13px]">
            <summary className="text-fg flex cursor-pointer list-none items-center gap-2 font-medium">
              <Icon name="book" size={14} className="text-fg-muted" />
              {t.sources} ({tour.citations.length})
              <Icon name="chevronDown" size={14} className="text-fg-muted ml-auto" />
            </summary>
            <ul className="text-fg mt-2.5 flex flex-col gap-2">
              {tour.citations.map((c) => (
                <li key={c.citation}>{c.citation}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* player bar, always within thumb reach */}
      <div className="border-border bg-paper/95 fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[420px] border-t px-4 pt-2.5 pb-[calc(0.875rem+var(--safe-bottom))] backdrop-blur-md">
        <div className="flex gap-1" aria-hidden>
          {stops.map((_, i) => (
            <span
              key={i}
              className={
                "h-1 flex-1 rounded-full " +
                (i < current || heard.has(i)
                  ? "bg-primary"
                  : i === current
                    ? "bg-primary/50"
                    : "bg-ink/10")
              }
            />
          ))}
        </div>
        {notice && <p className="text-fg-muted mt-1.5 text-center text-[12px]">{notice}</p>}
        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => jump(current - 1)}
            disabled={current === 0}
            aria-label={t.prev}
            className="text-fg grid size-11 place-items-center rounded-full disabled:opacity-30"
          >
            <Icon name="skipBack" size={20} />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? t.pause : t.play}
            className="bg-primary text-paper shadow-lift flex h-14 flex-1 items-center justify-center gap-2.5 rounded-full text-[16px] font-medium"
          >
            <Icon name={playing ? "pause" : "play"} size={20} />
            {playing ? t.pause : t.play}
          </button>
          <button
            type="button"
            onClick={() => jump(current + 1)}
            disabled={current === stops.length - 1}
            aria-label={t.next}
            className="text-fg grid size-11 place-items-center rounded-full disabled:opacity-30"
          >
            <Icon name="skipForward" size={20} />
          </button>
        </div>
      </div>
    </main>
  );
}
