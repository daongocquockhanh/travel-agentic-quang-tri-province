"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import {
  downloadTour,
  formatBytes,
  offlineSupported,
  removeDownload,
  useDownloads,
} from "@/lib/offline";
import type { TtsVoice } from "@/lib/voice/config";

const COPY = {
  en: {
    download: "Download for offline",
    downloading: (p: number) => `Downloading… ${p}%`,
    saved: "Available offline",
    savedNoAudio: "Saved offline · device voice",
    remove: "Remove download",
    failed: "Download failed. Try again on Wi-Fi.",
  },
  vi: {
    download: "Tải về nghe ngoại tuyến",
    downloading: (p: number) => `Đang tải… ${p}%`,
    saved: "Đã tải về",
    savedNoAudio: "Đã tải · giọng của máy",
    remove: "Xoá bản tải",
    failed: "Tải không thành công. Hãy thử lại khi có Wi-Fi.",
  },
} as const;

/**
 * Saves a tour (pages, photo, narration) so it plays without signal, e.g.
 * on the boat to Cồn Cỏ or at Khe Sanh.
 */
export function DownloadTour({
  slug,
  lang,
  voice,
  pieces,
  photoUrl,
}: {
  slug: string;
  lang: "vi" | "en";
  voice: TtsVoice;
  pieces: string[];
  photoUrl?: string | null;
}) {
  const t = COPY[lang];
  const record = useDownloads()[slug];
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [supported, setSupported] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => setSupported(offlineSupported()), []);
  useEffect(() => () => abort.current?.abort(), []);
  if (!supported) return null;

  const start = async () => {
    abort.current = new AbortController();
    setFailed(false);
    setProgress(0);
    try {
      await downloadTour({
        slug,
        lang,
        voice,
        pieces,
        photoUrl,
        signal: abort.current.signal,
        onProgress: (f) => setProgress(Math.round(f * 100)),
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setFailed(true);
    } finally {
      setProgress(null);
    }
  };

  const pill =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium backdrop-blur-sm";

  if (progress != null) {
    return (
      <span className={`${pill} bg-paper/90 text-fg`} role="status">
        <span className="relative size-3.5">
          <svg viewBox="0 0 36 36" className="size-3.5 -rotate-90" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeOpacity=".2"
              strokeWidth="5"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeDasharray={`${(progress / 100) * 94.2} 94.2`}
            />
          </svg>
        </span>
        {t.downloading(progress)}
      </span>
    );
  }

  if (record && record.lang === lang) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`${pill} bg-paper/90 text-primary`}>
          <Icon name="check" size={13} />
          {record.audio ? t.saved : t.savedNoAudio}
          {record.bytes > 0 && (
            <span className="text-fg-muted font-normal">· {formatBytes(record.bytes)}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => removeDownload(slug)}
          aria-label={t.remove}
          title={t.remove}
          className="bg-paper/90 text-fg-muted hover:text-fg grid size-7 place-items-center rounded-full backdrop-blur-sm"
        >
          <Icon name="x" size={13} />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={start}
        className={`${pill} bg-paper/90 text-fg hover:bg-paper`}
      >
        <Icon name="download" size={13} />
        {t.download}
      </button>
      {failed && <span className="text-paper text-[12px]">{t.failed}</span>}
    </span>
  );
}
