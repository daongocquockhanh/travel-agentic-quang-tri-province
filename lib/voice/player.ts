"use client";

import { toSpeakable, type TtsVoice } from "@/lib/voice/config";

type Lang = "vi" | "en";

/** 0.1 s of silence. Played inside a user gesture to unlock audio on iOS Safari. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

export type PlayerState = { speaking: boolean; key: string | null; error: string | null };

interface QueueItem {
  text: string;
  audio: Promise<Blob | null>;
}

/**
 * Plays TTS for a stream of text pieces in order. Each piece is fetched from
 * /api/agent/tts as soon as it is queued, so the next sentence downloads
 * while the current one plays. Falls back to the browser's speechSynthesis
 * when server TTS is unavailable (no key, or a 5xx).
 */
export class SpeechPlayer {
  private el: HTMLAudioElement | null = null;
  private queue: QueueItem[] = [];
  private generation = 0;
  private draining = false;
  private interruptCurrent: (() => void) | null = null;
  private browserFallback = false;
  private state: PlayerState = { speaking: false, key: null, error: null };

  constructor(
    private opts: { lang: () => Lang; voice: () => TtsVoice; onChange: (s: PlayerState) => void },
  ) {}

  /** Call synchronously inside a click/pointer handler before any async work. */
  unlock(): void {
    if (typeof window === "undefined") return;
    this.el ??= new Audio();
    this.el.src = SILENT_WAV;
    this.el.play().catch(() => {});
    if ("speechSynthesis" in window) {
      // iOS also gates speechSynthesis behind a gesture.
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    }
  }

  /** Start a new utterance group (e.g. one assistant message). Stops anything playing. */
  begin(key: string): void {
    this.stop();
    this.set({ key, error: null });
  }

  enqueue(text: string): void {
    // A lone "[2]" left at the end of a stream has nothing to say.
    const clean = toSpeakable(text);
    if (!/[\p{L}\p{N}]/u.test(clean)) return;
    this.queue.push({ text: clean, audio: this.fetchSpeech(clean) });
    if (!this.draining) void this.drain();
  }

  stop(): void {
    this.generation++;
    this.queue = [];
    this.interruptCurrent?.();
    this.interruptCurrent = null;
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute("src");
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    this.set({ speaking: false, key: null });
  }

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    this.opts.onChange(this.state);
  }

  private async fetchSpeech(text: string): Promise<Blob | null> {
    if (this.browserFallback) return null;
    try {
      const res = await fetch("/api/agent/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang: this.opts.lang(), voice: this.opts.voice() }),
      });
      if (res.ok) return await res.blob();
      if (res.status >= 500) this.browserFallback = true;
      return null;
    } catch {
      return null;
    }
  }

  private async drain() {
    const gen = this.generation;
    this.draining = true;
    this.set({ speaking: true });
    try {
      while (this.queue.length && gen === this.generation) {
        const item = this.queue.shift()!;
        const blob = await item.audio;
        if (gen !== this.generation) break;
        if (blob) {
          if (!(await this.playBlob(blob))) {
            // Autoplay blocked (no recent gesture). Surface it so the UI offers "Listen".
            this.queue = [];
            this.set({ error: "blocked" });
          }
        } else if (this.browserFallback && "speechSynthesis" in window) {
          await this.speakInBrowser(item.text);
        } else {
          this.set({ error: "tts_failed" });
        }
      }
    } finally {
      this.draining = false;
      if (gen === this.generation) this.set({ speaking: false });
      // Items queued after a stop() while we were awaiting belong to a new group.
      else if (this.queue.length) void this.drain();
    }
  }

  /** Resolves false if the browser refused to start playback. */
  private playBlob(blob: Blob): Promise<boolean> {
    this.el ??= new Audio();
    const el = this.el;
    const url = URL.createObjectURL(blob);
    return new Promise<boolean>((resolve) => {
      const finish = (played: boolean) => {
        el.removeEventListener("ended", onEnd);
        el.removeEventListener("error", onEnd);
        URL.revokeObjectURL(url);
        this.interruptCurrent = null;
        resolve(played);
      };
      const onEnd = () => finish(true);
      this.interruptCurrent = onEnd;
      el.addEventListener("ended", onEnd);
      el.addEventListener("error", onEnd);
      el.src = url;
      el.play().catch((err: unknown) => {
        finish(!(err instanceof DOMException && err.name === "NotAllowedError"));
      });
    });
  }

  private speakInBrowser(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.opts.lang() === "vi" ? "vi-VN" : "en-US";
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
      if (voice) u.voice = voice;
      const done = () => {
        this.interruptCurrent = null;
        resolve();
      };
      this.interruptCurrent = done;
      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
    });
  }
}
