"use client";

import { useSyncExternalStore } from "react";
import { toSpeakable, type TtsVoice } from "@/lib/voice/config";

/**
 * Offline tours: a downloaded tour's pages, photo and narration live in one
 * Cache Storage bucket that the service worker serves when the network is
 * gone (public/sw.js), and that never expires on its own. Signal is weak at
 * Khe Sanh and on Cồn Cỏ, so travellers download before they go.
 */
export const DOWNLOADS_CACHE = "qt-downloads";
const REGISTRY_KEY = "qt.downloads";

export interface DownloadRecord {
  lang: "vi" | "en";
  savedAt: number;
  bytes: number;
  /** False when server TTS was unavailable: offline, the device's own voice reads the tour. */
  audio: boolean;
  /** Every cache key this download wrote, so removing it is exact. */
  keys: string[];
}

type Registry = Record<string, DownloadRecord>;
const EMPTY: Registry = {};
let cache: Registry | null = null;
const listeners = new Set<() => void>();

function readRegistry(): Registry {
  if (cache) return cache;
  try {
    cache = JSON.parse(window.localStorage.getItem(REGISTRY_KEY) ?? "{}") as Registry;
  } catch {
    cache = {};
  }
  return cache;
}

function writeRegistry(next: Registry) {
  cache = next;
  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable: the cache still works for this session */
  }
  listeners.forEach((l) => l());
}

export function useDownloads(): Registry {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readRegistry,
    () => EMPTY,
  );
}

export const offlineSupported = () => typeof window !== "undefined" && "caches" in window;

/** Cache key for one narrated piece; the same text, language and voice always map to it. */
export async function speechKey(text: string, lang: "vi" | "en", voice: TtsVoice): Promise<string> {
  const data = new TextEncoder().encode(`${lang}|${voice}|${toSpeakable(text)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `/offline-audio/${hex.slice(0, 32)}`;
}

/** Saved narration for a piece, if this tour was downloaded. */
export async function savedSpeech(
  text: string,
  lang: "vi" | "en",
  voice: TtsVoice,
): Promise<Blob | null> {
  if (!offlineSupported()) return null;
  try {
    const hit = await (
      await caches.open(DOWNLOADS_CACHE)
    ).match(await speechKey(text, lang, voice));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

/**
 * Saves a tour for offline use. Reports progress from 0 to 1. Pages and the
 * photo come first, so a download interrupted mid-audio still opens offline.
 */
export async function downloadTour(args: {
  slug: string;
  lang: "vi" | "en";
  voice: TtsVoice;
  pieces: string[];
  photoUrl?: string | null;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<DownloadRecord> {
  const store = await caches.open(DOWNLOADS_CACHE);
  const keys: string[] = [];
  let bytes = 0;
  const steps = 3 + args.pieces.length;
  let done = 0;
  const tick = () => args.onProgress?.(++done / steps);

  const put = async (key: string, res: Response) => {
    const copy = res.clone();
    await store.put(key, res);
    keys.push(key);
    // Opaque (cross-origin) responses don't expose their size.
    if (copy.type !== "opaque") bytes += (await copy.blob()).size;
  };

  for (const page of [`/site/${args.slug}/tour`, `/site/${args.slug}`]) {
    const res = await fetch(page, { credentials: "same-origin", signal: args.signal });
    if (!res.ok) throw new Error(`page ${res.status}`);
    await put(page, res);
    tick();
  }

  if (args.photoUrl) {
    try {
      await put(
        args.photoUrl,
        await fetch(args.photoUrl, { mode: "no-cors", signal: args.signal }),
      );
    } catch {
      /* the illustrated stand-in shows instead */
    }
  }
  tick();

  let audio = true;
  for (const piece of args.pieces) {
    if (audio) {
      const key = await speechKey(piece, args.lang, args.voice);
      if (await store.match(key)) {
        keys.push(key);
      } else {
        const res = await fetch("/api/agent/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: toSpeakable(piece), lang: args.lang, voice: args.voice }),
          signal: args.signal,
        });
        if (res.ok) {
          await put(
            key,
            new Response(await res.blob(), { headers: { "content-type": "audio/mpeg" } }),
          );
        } else if (res.status === 503) {
          audio = false; // no server voice configured: the device voice reads it offline
        } else {
          throw new Error(`tts ${res.status}`);
        }
      }
    }
    tick();
  }

  const record: DownloadRecord = { lang: args.lang, savedAt: Date.now(), bytes, audio, keys };
  writeRegistry({ ...readRegistry(), [args.slug]: record });
  return record;
}

/** Removes a downloaded tour, keeping anything another download still uses. */
export async function removeDownload(slug: string): Promise<void> {
  const reg = { ...readRegistry() };
  const record = reg[slug];
  if (!record) return;
  delete reg[slug];
  const stillUsed = new Set(Object.values(reg).flatMap((r) => r.keys));
  if (offlineSupported()) {
    const store = await caches.open(DOWNLOADS_CACHE);
    await Promise.all(record.keys.filter((k) => !stillUsed.has(k)).map((k) => store.delete(k)));
  }
  writeRegistry(reg);
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
