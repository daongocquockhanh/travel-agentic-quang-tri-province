"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useChat, type Message } from "@ai-sdk/react";
import { AnswerPlaces } from "@/components/answer-places";
import { Citation } from "@/components/citation";
import { ReportAnswer } from "@/components/report-answer";
import { TabBar } from "@/components/tab-bar";
import { Icon } from "@/components/icon";
import { ModeMenu } from "@/components/mode-menu";
import { SitePhoto } from "@/components/site-photo";
import { NextPlaceCards, NextPlaces } from "@/components/next-places";
import { RouteCard } from "@/components/route-card";
import { OverviewFallback } from "@/components/overview-fallback";
import { VoiceButton } from "@/components/voice-button";
import { arrivalStoryPrompt } from "@/lib/agent/system-prompts";
import type { AgentAnnotation } from "@/lib/agent/types";
import type { Recommendation } from "@/lib/recommend";
import type { Itinerary } from "@/lib/route";
import { TRACK_STORAGE_KEY, isTrackKey, type TrackKey } from "@/lib/tracks";
import { currentPosition, locationPermission } from "@/lib/location";
import { placesInAnswer } from "@/lib/site-mentions";
import { useLang } from "@/lib/use-lang";
import { defaultVoice } from "@/lib/voice/config";
import { SpeechPlayer, type PlayerState } from "@/lib/voice/player";
import { SentenceBuffer } from "@/lib/voice/sentences";
import { useRecorder, type RecorderError } from "@/lib/voice/use-recorder";
import { clearThread, loadThread, saveThread } from "@/lib/chat-thread";

type Lang = "vi" | "en";

interface Props {
  initialTrack: TrackKey;
  /** If false, prefer the track saved in localStorage over `initialTrack`. */
  trackFromUrl: boolean;
  initialLang: Lang;
  site: {
    slug: string;
    name_vi: string;
    name_en: string;
    hero_gradient: string;
    photo?: { file: string; alt_en: string; alt_vi: string };
  } | null;
  intent?: "arrival_story";
  initialQuestion?: string;
}

const COPY = {
  en: {
    placeholder: "Ask about a place or its history…",
    send: "Send",
    thinking: "Thinking…",
    searching: "Checking curated sources…",
    grounded: "Answered from curated, cited sources",
    offline: "Offline mode",
    error: "Something went wrong.",
    rateLimited:
      "You're asking faster than the guide can answer. Please wait a minute and try again.",
    retry: "Try again",
    readInstead: "Read the curated page instead",
    emptyTitle: "Ask your guide",
    emptyBody:
      "History, customs, opening hours, what to see next. Answers about war and religion come only from cited sources.",
    tryAsking: "Try asking",
    micHint: "Or hold the mic button and speak",
    context: "Asking about",
    back: "Back",
    newChat: "New chat",
    language: "Switch language",
    holdToTalk: "Hold to talk",
    releaseToSend: "Release to send",
    transcribing: "Transcribing…",
    listen: "Listen",
    stopListening: "Stop",
    speaking: "Speaking…",
    voiceErrors: {
      unsupported: "Voice isn't supported in this browser. Please type instead.",
      denied: "Microphone access is blocked. Allow it in your browser settings, or type instead.",
      too_short: "Hold the button while you speak.",
      too_large: "That recording was too long. Keep it under 30 seconds.",
      failed: "Couldn't use the microphone. Please type instead.",
      not_configured: "Voice input isn't set up on this server yet. Please type instead.",
      empty: "Couldn't hear that. Try again, or type instead.",
      stt_failed: "Couldn't hear that. Try again, or type instead.",
      blocked: "Tap Listen to hear the answer.",
      tts_failed: "Couldn't play the voice. The text is above.",
      rate_limited: "Too many voice questions in a row. Please wait a minute, or type instead.",
    },
  },
  vi: {
    placeholder: "Hỏi về địa điểm, lịch sử…",
    send: "Gửi",
    thinking: "Đang suy nghĩ…",
    searching: "Đang tra cứu tư liệu đã biên soạn…",
    grounded: "Trả lời từ nguồn đã biên soạn và dẫn nguồn",
    offline: "Chế độ ngoại tuyến",
    error: "Đã có lỗi xảy ra.",
    rateLimited: "Bạn hỏi nhanh hơn hướng dẫn viên kịp trả lời. Vui lòng đợi một phút rồi thử lại.",
    retry: "Thử lại",
    readInstead: "Đọc trang thông tin thay thế",
    emptyTitle: "Hỏi hướng dẫn viên",
    emptyBody:
      "Lịch sử, phong tục, giờ mở cửa, nên đi đâu tiếp. Câu trả lời về chiến tranh và tôn giáo chỉ dựa trên nguồn có dẫn chứng.",
    tryAsking: "Gợi ý câu hỏi",
    micHint: "Hoặc giữ nút micro và nói",
    context: "Đang hỏi về",
    back: "Quay lại",
    newChat: "Hỏi mới",
    language: "Đổi ngôn ngữ",
    holdToTalk: "Giữ để nói",
    releaseToSend: "Thả tay để gửi",
    transcribing: "Đang nhận dạng giọng nói…",
    listen: "Nghe",
    stopListening: "Dừng",
    speaking: "Đang đọc…",
    voiceErrors: {
      unsupported: "Trình duyệt chưa hỗ trợ giọng nói. Vui lòng nhập bằng chữ.",
      denied: "Micro đang bị chặn. Hãy cho phép trong cài đặt trình duyệt, hoặc nhập bằng chữ.",
      too_short: "Hãy giữ nút trong lúc nói.",
      too_large: "Đoạn ghi âm quá dài. Vui lòng nói dưới 30 giây.",
      failed: "Không dùng được micro. Vui lòng nhập bằng chữ.",
      not_configured: "Máy chủ chưa bật nhận dạng giọng nói. Vui lòng nhập bằng chữ.",
      empty: "Mình chưa nghe rõ. Thử lại hoặc nhập bằng chữ nhé.",
      stt_failed: "Mình chưa nghe rõ. Thử lại hoặc nhập bằng chữ nhé.",
      blocked: "Nhấn Nghe để nghe câu trả lời.",
      tts_failed: "Không phát được giọng đọc. Nội dung ở phía trên.",
      rate_limited:
        "Bạn đã hỏi bằng giọng nói nhiều lần liên tiếp. Vui lòng đợi một phút hoặc nhập bằng chữ.",
    },
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

type StarterIcon = "book" | "route" | "clock" | "pin";

/** First-visit suggestions: one per kind of question the guide handles well. */
function starterQuestions(
  lang: Lang,
  track: TrackKey,
  siteName: string | null,
): { icon: StarterIcon; text: string }[] {
  const vi = lang === "vi";
  if (siteName) {
    return [
      {
        icon: "book",
        text: vi ? `Kể cho tôi câu chuyện của ${siteName}` : `Tell me the story of ${siteName}`,
      },
      {
        icon: "clock",
        text: vi
          ? "Giờ mở cửa, giá vé và nên dành bao lâu?"
          : "Opening hours, tickets, and how long to stay?",
      },
      {
        icon: "pin",
        text: vi ? "Khi tham quan cần lưu ý gì?" : "What should I know before visiting?",
      },
      { icon: "route", text: vi ? "Sau đây nên đi đâu tiếp?" : "Where should I go next?" },
    ];
  }
  const history =
    track === "war"
      ? vi
        ? "Vĩ tuyến 17 chia cắt đất nước như thế nào?"
        : "How did the 17th parallel divide the country?"
      : vi
        ? "Quảng Trị có những điểm nào nên đến?"
        : "What are the must-see places in Quảng Trị?";
  return [
    { icon: "book", text: history },
    { icon: "route", text: vi ? "Lên lịch trình một ngày cho tôi" : "Plan a day for me" },
    {
      icon: "clock",
      text: vi ? "Địa đạo Vĩnh Mốc mở cửa lúc mấy giờ?" : "When are the Vinh Moc tunnels open?",
    },
    { icon: "pin", text: vi ? "Ở Đông Hà nên ăn món gì?" : "What should I eat in Đông Hà?" },
  ];
}

const NEARBY_RE = /near(by| me)|gần (đây|tôi|mình)/i;

export function ChatScreen({
  initialTrack,
  trackFromUrl,
  initialLang,
  site,
  intent,
  initialQuestion,
}: Props) {
  const [track, setTrack] = useState<TrackKey>(initialTrack);
  const { lang, toggle: toggleLang } = useLang(initialLang);
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
    locationPermission().then((state) => {
      if (state === "granted") requestLocation();
    });
  }, []);

  async function requestLocation(): Promise<{ lat: number; lng: number } | null> {
    const c = await currentPosition();
    if (c) setCoords(c);
    return c;
  }

  const { messages, setMessages, input, setInput, append, status, error, reload, stop } = useChat({
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

  // Restore the last thread for this context, unless the page was opened to start a new one.
  const threadContext = site ? `site:${site.slug}` : "general";
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (intent || initialQuestion) return;
    const saved = loadThread(threadContext);
    if (saved?.length) setMessages(saved);
  }, [threadContext, intent, initialQuestion, setMessages]);
  useEffect(() => {
    if (status === "ready" && messages.length) saveThread(threadContext, messages);
  }, [status, messages, threadContext]);

  // ── voice: playback ─────────────────────────────────────────────
  const [playerState, setPlayerState] = useState<PlayerState>({
    speaking: false,
    key: null,
    error: null,
    item: 0,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const voiceCtx = useRef({ lang, track });
  voiceCtx.current = { lang, track };
  const playerRef = useRef<SpeechPlayer | null>(null);
  const getPlayer = useCallback(() => {
    playerRef.current ??= new SpeechPlayer({
      lang: () => voiceCtx.current.lang,
      voice: () => defaultVoice(voiceCtx.current.track),
      onChange: setPlayerState,
    });
    return playerRef.current;
  }, []);
  useEffect(() => () => playerRef.current?.stop(), []);

  useEffect(() => {
    if (!playerState.error) return;
    setNotice(t.voiceErrors[playerState.error as keyof typeof t.voiceErrors] ?? null);
  }, [playerState.error, t]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  /**
   * When a turn should be spoken (voice question, arrival story), speak the
   * answer sentence by sentence as it streams instead of waiting for the end.
   */
  const autoSpeak = useRef<{
    armed: boolean;
    messageId: string | null;
    buffer: SentenceBuffer;
  } | null>(null);
  const armAutoSpeak = () => {
    autoSpeak.current = { armed: true, messageId: null, buffer: new SentenceBuffer() };
  };
  useEffect(() => {
    const a = autoSpeak.current;
    if (!a?.armed) return;
    if (status === "error") {
      autoSpeak.current = null;
      return;
    }
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;
    const player = getPlayer();
    if (!a.messageId) {
      a.messageId = lastMsg.id;
      player.begin(lastMsg.id);
    }
    if (lastMsg.id !== a.messageId) return;
    const done = status === "ready";
    const pieces = a.buffer.push(lastMsg.content);
    if (done) pieces.push(...a.buffer.flush(lastMsg.content));
    pieces.forEach((p) => player.enqueue(p));
    if (done) autoSpeak.current = null;
  }, [messages, status, getPlayer]);

  const listenTo = (m: Message) => {
    const player = getPlayer();
    if (playerState.key === m.id && playerState.speaking) {
      player.stop();
      return;
    }
    player.unlock();
    player.begin(m.id);
    const buf = new SentenceBuffer(200);
    [...buf.push(m.content), ...buf.flush(m.content)].forEach((p) => player.enqueue(p));
  };

  // ── voice: push-to-talk ─────────────────────────────────────────
  const [transcribing, setTranscribing] = useState(false);
  const voiceError = (code: RecorderError | string) =>
    setNotice(t.voiceErrors[code as keyof typeof t.voiceErrors] ?? t.voiceErrors.failed);

  const recorder = useRecorder({
    onError: voiceError,
    onAudio: async (audio) => {
      setTranscribing(true);
      try {
        const form = new FormData();
        const ext = audio.type.includes("mp4")
          ? "mp4"
          : audio.type.includes("ogg")
            ? "ogg"
            : "webm";
        form.append("audio", audio, `speech.${ext}`);
        form.append("lang", voiceCtx.current.lang);
        const res = await fetch("/api/agent/voice", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { transcript?: string; code?: string };
        if (!res.ok || !data.transcript) {
          voiceError(data.code ?? "stt_failed");
          return;
        }
        armAutoSpeak();
        await send(data.transcript);
      } catch {
        voiceError("stt_failed");
      } finally {
        setTranscribing(false);
      }
    },
  });

  const pressStart = () => {
    // Unlock audio inside the gesture so the spoken reply can autoplay on iOS.
    const player = getPlayer();
    player.stop();
    player.unlock();
    setNotice(null);
    void recorder.start();
  };

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
    // The banner's "Play" means hear it: speak the arrival story as it streams.
    if (intent === "arrival_story") armAutoSpeak();
    void append({ role: "user", content: first });
  }, [append, initialQuestion, intent, lang, site]);

  // Keep the newest message in view.
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

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
  const waitingForFirstToken =
    status === "submitted" || (status === "streaming" && last?.role === "user");

  return (
    <main className="bg-paper text-fg mx-auto flex h-dvh w-full max-w-[420px] flex-col">
      {/* top chrome */}
      <header className="border-border flex items-center gap-2 border-b px-3.5 pt-[calc(0.875rem+var(--safe-top))] pb-3">
        <Link
          href={backHref}
          aria-label={t.back}
          className="border-border bg-paper-card text-fg grid size-9 shrink-0 place-items-center rounded-full border"
        >
          <Icon name="back" size={18} />
        </Link>
        <ModeMenu track={track} lang={lang} onChange={setTrack} compact />
        <span className="flex-1" />
        {messages.length > 0 && !busy && (
          <button
            type="button"
            onClick={() => {
              getPlayer().stop();
              setMessages([]);
              clearThread();
            }}
            className="text-fg-muted hover:text-fg rounded-full px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap"
          >
            {t.newChat}
          </button>
        )}
        <button
          type="button"
          onClick={toggleLang}
          aria-label={t.language}
          className="border-border bg-paper-card text-fg inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium"
        >
          <Icon name="globe" size={14} />
          {lang.toUpperCase()}
        </button>
      </header>

      {site && messages.length > 0 && (
        <Link
          href={`/site/${site.slug}`}
          className="border-border bg-paper-card mx-3.5 mt-3 flex items-center gap-2.5 rounded-[12px] border p-1.5 pr-3"
        >
          <SitePhoto
            photo={site.photo}
            gradient={site.hero_gradient}
            lang={lang}
            width={120}
            decorative
            className="size-10 shrink-0 rounded-[8px]"
          />
          <span className="min-w-0 flex-1">
            <span className="text-fg-muted block text-[10px] font-medium tracking-[0.08em] uppercase">
              {t.context}
            </span>
            <span className="font-display block truncate text-[15px] leading-tight">
              {lang === "vi" ? site.name_vi : site.name_en}
            </span>
          </span>
          <Icon name="arrow" size={16} className="text-fg-muted" />
        </Link>
      )}

      {/* thread */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col gap-4">
            {site ? (
              <div className="border-border bg-paper-card overflow-hidden rounded-[16px] border">
                <SitePhoto
                  photo={site.photo}
                  gradient={site.hero_gradient}
                  lang={lang}
                  width={700}
                  credit
                  className="h-32 w-full"
                />
                <div className="p-3.5">
                  <p className="text-fg-muted text-[10.5px] font-medium tracking-[0.08em] uppercase">
                    {t.context}
                  </p>
                  <p className="font-display text-[20px] leading-tight">
                    {lang === "vi" ? site.name_vi : site.name_en}
                  </p>
                  <p className="text-fg-muted mt-1.5 text-[13px] leading-snug">{t.emptyBody}</p>
                </div>
              </div>
            ) : (
              <div className="px-1 pt-2">
                <p className="font-display text-[26px] leading-tight">{t.emptyTitle}</p>
                <p className="text-fg-muted mt-1.5 text-[14px] leading-snug">{t.emptyBody}</p>
              </div>
            )}

            <div>
              <p className="text-fg-muted mb-2 px-1 text-[11px] font-medium tracking-[0.08em] uppercase">
                {t.tryAsking}
              </p>
              <ul className="flex flex-col gap-2">
                {starterQuestions(lang, track, siteName).map((q) => (
                  <li key={q.text}>
                    <button
                      type="button"
                      onClick={() => void send(q.text)}
                      className="border-border bg-paper-card text-fg hover:border-border-strong flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left text-[14px]"
                    >
                      <span className="bg-paper-sunk text-primary grid size-8 shrink-0 place-items-center rounded-full">
                        <Icon name={q.icon} size={15} />
                      </span>
                      <span className="flex-1">{q.text}</span>
                      <Icon name="arrowUp" size={14} className="text-fg-muted rotate-45" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-fg-muted flex items-center justify-center gap-1.5 text-[12.5px]">
              <Icon name="mic" size={13} />
              {t.micHint}
            </p>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <li key={m.id}>
              {m.role === "user" ? (
                <UserBubble text={m.content} />
              ) : (
                <AssistantBubble
                  message={m}
                  track={track}
                  lang={lang}
                  t={t}
                  speaking={playerState.speaking && playerState.key === m.id}
                  onListen={status === "ready" || m.id !== last?.id ? () => listenTo(m) : undefined}
                  question={messages[i - 1]?.role === "user" ? messages[i - 1].content : ""}
                  siteSlug={site?.slug}
                />
              )}
            </li>
          ))}
        </ul>

        {intent === "arrival_story" && site && status === "ready" && messages.length >= 2 && (
          <div className="mt-4">
            <NextPlaces fromSlug={site.slug} lang={lang} fallbackTrack={track} />
          </div>
        )}

        {waitingForFirstToken && (
          <p className="text-fg-muted mt-3 flex items-center gap-2 text-[13px]">
            <span className="bg-fg-muted inline-block size-1.5 animate-pulse rounded-full" />
            {t.thinking}
          </p>
        )}

        {error && (
          <div
            className="border-border bg-paper-card mt-3 rounded-[10px] border p-3 text-sm"
            role="alert"
          >
            <p className="text-fg">
              {error.message.includes("rate_limited") ? t.rateLimited : t.error}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void reload()}
                className="bg-primary text-paper rounded-full px-3 py-1.5 text-[13px] font-medium"
              >
                {t.retry}
              </button>
              {site && (
                <Link
                  href={`/site/${site.slug}`}
                  className="border-border text-fg rounded-full border px-3 py-1.5 text-[13px] font-medium"
                >
                  {t.readInstead}
                </Link>
              )}
            </div>
            {site && !error.message.includes("rate_limited") && (
              <OverviewFallback slug={site.slug} lang={lang} track={track} />
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="border-border bg-paper border-t px-3.5 pt-2.5 pb-2.5">
        {!busy && messages.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {quickReplies(lang, track, siteName).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                className="border-border bg-paper-card text-fg rounded-full border px-3 py-1.5 text-[13px]"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {(notice || recorder.recording || transcribing || playerState.speaking) && (
          <div
            className="text-fg-muted mb-2 flex items-center justify-between gap-2 text-[13px]"
            aria-live="polite"
          >
            <span>
              {recorder.recording
                ? `${t.releaseToSend} · ${Math.ceil(recorder.elapsedMs / 1000)}s`
                : transcribing
                  ? t.transcribing
                  : (notice ?? t.speaking)}
            </span>
            {playerState.speaking && !recorder.recording && (
              <button
                type="button"
                onClick={() => getPlayer().stop()}
                className="border-border text-fg rounded-full border px-2.5 py-1 text-[12px] font-medium"
              >
                {t.stopListening}
              </button>
            )}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={recorder.recording ? t.releaseToSend : t.placeholder}
            rows={1}
            maxLength={4000}
            aria-label={t.placeholder}
            disabled={recorder.recording || transcribing}
            className="border-border bg-paper-card text-fg placeholder:text-fg-muted focus:border-border-strong mb-1.5 max-h-32 min-h-11 flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-[15px] outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              className="border-border bg-paper-card text-fg mb-1.5 grid size-11 shrink-0 place-items-center rounded-full border"
            >
              <Icon name="x" size={18} />
            </button>
          ) : input.trim() ? (
            <button
              type="submit"
              aria-label={t.send}
              className="bg-primary text-paper mb-1.5 grid size-11 shrink-0 place-items-center rounded-full"
            >
              <Icon name="arrowUp" size={18} />
            </button>
          ) : (
            <VoiceButton
              label={t.holdToTalk}
              recording={recorder.recording}
              transcribing={transcribing}
              elapsedMs={recorder.elapsedMs}
              disabled={transcribing}
              onPressStart={pressStart}
              onPressEnd={(cancel) => recorder.stop(cancel)}
            />
          )}
        </form>
      </div>
      <TabBar lang={lang} />
    </main>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="bg-primary text-paper max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[15px] leading-[1.5] whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

function readAnnotations(m: Message) {
  const anns = (m.annotations ?? []) as AgentAnnotation[];
  const citations = anns.filter(
    (a): a is Extract<AgentAnnotation, { type: "citation" }> => a?.type === "citation",
  );
  const mode = anns.find(
    (a): a is Extract<AgentAnnotation, { type: "mode" }> => a?.type === "mode",
  );
  return { citations, mode };
}

function AssistantBubble({
  message,
  track,
  lang,
  t,
  speaking,
  onListen,
  question,
  siteSlug,
}: {
  message: Message;
  track: TrackKey;
  lang: Lang;
  t: (typeof COPY)[Lang];
  speaking: boolean;
  /** Absent while the message is still streaming. */
  onListen?: () => void;
  /** The user turn this answers, sent along with a report. */
  question: string;
  siteSlug?: string | null;
}) {
  const { citations, mode } = readAnnotations(message);
  const searching = message.parts?.some(
    (p) => p.type === "tool-invocation" && p.toolInvocation.state !== "result",
  );

  // Show the sources the answer actually cites; if it cites none, show all it was given.
  const cited = new Set([...message.content.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1])));
  const shown = cited.size ? citations.filter((c) => cited.has(c.n)) : citations;
  // Sections of one site often share a citation: one chip per source, listing every ref number.
  const chips: { source: string; ns: number[]; draft: boolean }[] = [];
  for (const c of shown) {
    const chip = chips.find((x) => x.source === c.source);
    if (chip) {
      chip.ns.push(c.n);
      chip.draft ||= c.draft;
    } else {
      chips.push({ source: c.source, ns: [c.n], draft: c.draft });
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {(mode?.offline || (mode?.grounded && !mode.refused)) && (
        <p className="text-fg-muted flex items-center gap-1.5 text-[11px] font-medium tracking-[0.06em] uppercase">
          <Icon name="book" size={12} />
          {mode.offline ? t.offline : t.grounded}
        </p>
      )}
      {message.content ? (
        <div className="border-border bg-paper-card text-fg max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[15px] leading-[1.55]">
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
      {searching && <p className="text-fg-muted text-[13px]">{t.searching}</p>}
      <ToolCards message={message} lang={lang} track={track} />
      {/* once the answer is complete: cards for the places it talks about */}
      {onListen && message.content && (
        <AnswerPlaces
          slugs={placesInAnswer(message.content, [
            ...toolSlugs(message),
            ...(siteSlug ? [siteSlug] : []),
          ])}
          lang={lang}
        />
      )}
      {chips.length > 0 && (
        <div className="flex max-w-[92%] flex-wrap gap-1.5">
          {chips.map((c) => (
            <Citation
              key={c.source}
              source={`[${c.ns.join(", ")}] ${c.source}${c.draft ? (lang === "vi" ? " · bản nháp" : " · draft") : ""}`}
              track={track}
            />
          ))}
        </div>
      )}
      {onListen && message.content && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button
            type="button"
            onClick={onListen}
            aria-pressed={speaking}
            className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-[12px] font-medium"
          >
            <Icon name={speaking ? "x" : "play"} size={12} />
            {speaking ? t.stopListening : t.listen}
          </button>
          <ReportAnswer
            question={question}
            answer={message.content}
            track={track}
            lang={lang}
            siteSlug={siteSlug}
          />
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
            <sup key={i} className="text-fg-muted ml-0.5 font-mono text-[10px]">
              {match[1]}
            </sup>
          );
        }
        return <span key={i}>{piece}</span>;
      })}
    </>
  );
}

/** Places already shown by planner tool cards, so the answer doesn't card them twice. */
function toolSlugs(message: Message): string[] {
  return (message.parts ?? []).flatMap((p) => {
    if (p.type !== "tool-invocation" || p.toolInvocation.state !== "result") return [];
    const r = p.toolInvocation.result as {
      recommendations?: { slug: string }[];
      stops?: { slug: string }[];
    };
    return [...(r?.recommendations ?? []), ...(r?.stops ?? [])].map((x) => x.slug);
  });
}

/** Planner tool results render as cards under the answer. */
function ToolCards({ message, lang, track }: { message: Message; lang: Lang; track: TrackKey }) {
  const results = (message.parts ?? []).flatMap((p) =>
    p.type === "tool-invocation" && p.toolInvocation.state === "result" ? [p.toolInvocation] : [],
  );
  return (
    <>
      {results.map((inv) => {
        if (inv.toolName === "recommend_next") {
          const items =
            (inv.result as { recommendations?: Recommendation[] })?.recommendations ?? [];
          return (
            <div key={inv.toolCallId} className="w-full">
              <NextPlaceCards items={items} lang={lang} track={track} />
            </div>
          );
        }
        if (inv.toolName === "build_route") {
          const itinerary = inv.result as Itinerary & { stops?: unknown[] };
          if (!itinerary?.stops?.length) return null;
          return <RouteCard key={inv.toolCallId} itinerary={itinerary} lang={lang} track={track} />;
        }
        return null;
      })}
    </>
  );
}
