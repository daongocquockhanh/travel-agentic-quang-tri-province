"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useChat, type Message } from "@ai-sdk/react";
import { Citation } from "@/components/citation";
import { Icon } from "@/components/icon";
import { TrackChip } from "@/components/track-chip";
import { arrivalStoryPrompt } from "@/lib/agent/system-prompts";
import type { AgentAnnotation } from "@/lib/agent/types";
import { TRACKS, TRACK_COLOR, TRACK_STORAGE_KEY, isTrackKey, type TrackKey } from "@/lib/tracks";

type Lang = "vi" | "en";

interface Props {
  initialTrack: TrackKey;
  /** If false, prefer the track saved in localStorage over `initialTrack`. */
  trackFromUrl: boolean;
  initialLang: Lang;
  site: { slug: string; name_vi: string; name_en: string } | null;
  intent?: "arrival_story";
  initialQuestion?: string;
}

const COPY = {
  en: {
    placeholder: "Ask about a place, route, or history…",
    send: "Send",
    thinking: "Thinking…",
    searching: "Checking curated sources…",
    grounded: "Answered from curated, cited sources",
    offline: "Offline mode",
    error: "Something went wrong.",
    retry: "Try again",
    readInstead: "Read the curated page instead",
    emptyTitle: "Ask your guide",
    emptyBody: "History, culture, opening hours, what to see next. War and religious topics are answered only from cited sources.",
    context: "Asking about",
    back: "Back",
    language: "Switch language",
  },
  vi: {
    placeholder: "Hỏi về địa điểm, lộ trình hay lịch sử…",
    send: "Gửi",
    thinking: "Đang suy nghĩ…",
    searching: "Đang tra cứu tư liệu đã biên soạn…",
    grounded: "Trả lời từ nguồn đã biên soạn và dẫn nguồn",
    offline: "Chế độ ngoại tuyến",
    error: "Đã có lỗi xảy ra.",
    retry: "Thử lại",
    readInstead: "Đọc trang thông tin thay thế",
    emptyTitle: "Hỏi hướng dẫn viên",
    emptyBody: "Lịch sử, văn hóa, giờ mở cửa, nên đi đâu tiếp. Chủ đề chiến tranh và tôn giáo chỉ được trả lời từ nguồn có dẫn chứng.",
    context: "Đang hỏi về",
    back: "Quay lại",
    language: "Đổi ngôn ngữ",
  },
} as const;

function quickReplies(lang: Lang, track: TrackKey, siteName: string | null): string[] {
  if (lang === "vi") {
    return [
      siteName ? `Kể về lịch sử ${siteName}` : "Kể về chiến tranh ở đây",
      track === "domestic" ? "Giờ mở cửa và giá vé?" : "Lên kế hoạch cho ngày mai",
      "Tìm quán ăn gần đây",
    ];
  }
  return [
    siteName ? `Tell me the history of ${siteName}` : "Tell me about the war here",
    track === "domestic" ? "Opening hours and tickets?" : "Plan tomorrow",
    "Find food nearby",
  ];
}

const NEARBY_RE = /near(by| me)|gần (đây|tôi|mình)/i;

export function ChatScreen({ initialTrack, trackFromUrl, initialLang, site, intent, initialQuestion }: Props) {
  const [track, setTrack] = useState<TrackKey>(initialTrack);
  const [lang, setLang] = useState<Lang>(initialLang);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const t = COPY[lang];
  const siteName = site ? (lang === "vi" ? site.name_vi : site.name_en) : null;

  // Restore the saved track unless the URL pinned one.
  useEffect(() => {
    if (trackFromUrl) return;
    try {
      const saved = window.localStorage.getItem(TRACK_STORAGE_KEY);
      if (isTrackKey(saved)) setTrack(saved);
    } catch {
      /* private mode */
    }
  }, [trackFromUrl]);

  // Use location only if the user already granted it — never prompt on page load.
  useEffect(() => {
    if (!("geolocation" in navigator) || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "granted") requestLocation();
      })
      .catch(() => {});
  }, []);

  function requestLocation(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          resolve(c);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      );
    });
  }

  const { messages, input, setInput, append, status, error, reload, stop } = useChat({
    api: "/api/agent/chat",
    body: {
      track,
      lang,
      site_slug: site?.slug,
      intent,
      ...(coords ?? {}),
    },
  });

  const busy = status === "submitted" || status === "streaming";

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    // "near me" questions are the one place we ask for location on demand.
    const position = coords ?? (NEARBY_RE.test(content) ? await requestLocation() : null);
    await append({ role: "user", content }, position ? { body: position } : undefined);
  }

  // Auto-start: arrival story from the geofence banner, or a question passed in the URL.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    const first =
      intent === "arrival_story" && site
        ? arrivalStoryPrompt(lang, lang === "vi" ? site.name_vi : site.name_en)
        : initialQuestion;
    if (!first) return;
    started.current = true;
    void append({ role: "user", content: first });
  }, [append, initialQuestion, intent, lang, site]);

  // Keep the newest message in view.
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const cycleTrack = () => {
    const next = TRACKS[(TRACKS.indexOf(track) + 1) % TRACKS.length];
    setTrack(next);
    try {
      window.localStorage.setItem(TRACK_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  };

  const toggleLang = () => {
    const next = lang === "en" ? "vi" : "en";
    setLang(next);
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  };

  const backHref = site ? `/site/${site.slug}` : `/map?track=${track}`;
  const last = messages[messages.length - 1];
  const waitingForFirstToken = status === "submitted" || (status === "streaming" && last?.role === "user");

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[420px] flex-col bg-paper text-fg">
      {/* top chrome */}
      <header className="flex items-center gap-2 border-b border-border px-3.5 pb-3 pt-3.5">
        <Link
          href={backHref}
          aria-label={t.back}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-paper-card text-fg"
        >
          <Icon name="back" size={18} />
        </Link>
        <TrackChip track={track} lang={lang} onClick={cycleTrack} />
        <span className="flex-1" />
        <button
          type="button"
          onClick={toggleLang}
          aria-label={t.language}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-paper-card px-3 py-1.5 text-[13px] font-medium text-fg"
        >
          <Icon name="globe" size={14} />
          {lang.toUpperCase()}
        </button>
      </header>

      {site && (
        <div
          className="mx-3.5 mt-3 rounded-[10px] border border-border bg-paper-card px-3 py-2"
          style={{ borderLeft: `3px solid ${TRACK_COLOR[track]}` }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-fg-muted">{t.context}</p>
          <p className="truncate font-display text-[15px] leading-tight">
            {site.name_vi} <span className="italic text-fg-muted">· {site.name_en}</span>
          </p>
        </div>
      )}

      {/* thread */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="mt-8 px-2 text-center">
            <p className="font-display text-2xl">{t.emptyTitle}</p>
            <p className="mt-2 text-sm text-fg-muted">{t.emptyBody}</p>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id}>
              {m.role === "user" ? (
                <UserBubble text={m.content} />
              ) : (
                <AssistantBubble message={m} track={track} t={t} />
              )}
            </li>
          ))}
        </ul>

        {waitingForFirstToken && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-fg-muted">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-fg-muted" />
            {t.thinking}
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-[10px] border border-border bg-paper-card p-3 text-sm" role="alert">
            <p className="text-fg">{t.error}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-full bg-primary px-3 py-1.5 text-[13px] font-medium text-paper"
              >
                {t.retry}
              </button>
              {site && (
                <Link
                  href={`/site/${site.slug}`}
                  className="rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-fg"
                >
                  {t.readInstead}
                </Link>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="border-t border-border bg-paper px-3.5 pb-4 pt-2.5">
        {!busy && (
          <div className="-mx-3.5 mb-2.5 flex gap-2 overflow-x-auto px-3.5 pb-0.5">
            {quickReplies(lang, track, siteName).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                className="shrink-0 rounded-full border border-border bg-paper-card px-3 py-1.5 text-[13px] text-fg"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.placeholder}
            rows={1}
            maxLength={4000}
            aria-label={t.placeholder}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-paper-card px-3.5 py-2.5 text-[15px] text-fg outline-none placeholder:text-fg-muted focus:border-border-strong"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-paper-card text-fg"
            >
              <Icon name="x" size={18} />
            </button>
          ) : (
            <button
              type="submit"
              aria-label={t.send}
              disabled={!input.trim()}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-paper disabled:opacity-40"
            >
              <Icon name="arrowUp" size={18} />
            </button>
          )}
        </form>
      </div>
    </main>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[15px] leading-[1.5] text-paper">
        {text}
      </p>
    </div>
  );
}

function readAnnotations(m: Message) {
  const anns = (m.annotations ?? []) as AgentAnnotation[];
  const citations = anns.filter((a): a is Extract<AgentAnnotation, { type: "citation" }> => a?.type === "citation");
  const mode = anns.find((a): a is Extract<AgentAnnotation, { type: "mode" }> => a?.type === "mode");
  return { citations, mode };
}

function AssistantBubble({
  message,
  track,
  t,
}: {
  message: Message;
  track: TrackKey;
  t: (typeof COPY)[Lang];
}) {
  const { citations, mode } = readAnnotations(message);
  const searching = message.parts?.some(
    (p) => p.type === "tool-invocation" && p.toolInvocation.state !== "result",
  );

  // Show the sources the answer actually cites; if it cites none, show all it was given.
  const cited = new Set([...message.content.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1])));
  const chips = cited.size ? citations.filter((c) => cited.has(c.n)) : citations;

  return (
    <div className="flex flex-col items-start gap-1.5">
      {(mode?.offline || (mode?.grounded && !mode.refused)) && (
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-fg-muted">
          <Icon name="book" size={12} />
          {mode.offline ? t.offline : t.grounded}
        </p>
      )}
      {message.content ? (
        <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-paper-card px-3.5 py-2.5 text-[15px] leading-[1.55] text-fg">
          {message.content
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, i) => (
              <p key={i} className={i ? "mt-2.5 whitespace-pre-wrap" : "whitespace-pre-wrap"}>
                <WithRefs text={para} known={new Set(citations.map((c) => c.n))} />
              </p>
            ))}
        </div>
      ) : null}
      {searching && <p className="text-[13px] text-fg-muted">{t.searching}</p>}
      {chips.length > 0 && (
        <div className="flex max-w-[92%] flex-wrap gap-1.5">
          {chips.map((c) => (
            <Citation key={c.n} source={`[${c.n}] ${c.source}`} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders `[n]` markers as small superscript refs when `n` is a known citation. */
function WithRefs({ text, known }: { text: string; known: Set<number> }) {
  const pieces = text.split(/(\[\d+\])/g);
  return (
    <>
      {pieces.map((piece, i) => {
        const match = /^\[(\d+)\]$/.exec(piece);
        if (match && known.has(Number(match[1]))) {
          return (
            <sup key={i} className="ml-0.5 font-mono text-[10px] text-fg-muted">
              {match[1]}
            </sup>
          );
        }
        return <span key={i}>{piece}</span>;
      })}
    </>
  );
}
