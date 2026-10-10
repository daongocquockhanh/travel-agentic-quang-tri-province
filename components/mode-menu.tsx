"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { TrackIcon } from "@/components/track-icon";
import {
  TRACKS,
  TRACK_COLOR,
  TRACK_DESCRIPTION,
  TRACK_LABEL_EN,
  TRACK_LABEL_VI,
  TRACK_STORAGE_KEY,
  type TrackKey,
} from "@/lib/tracks";

/**
 * The guide's mode (track). Opens a short list explaining each mode instead
 * of silently cycling on tap, so changing it is a deliberate, understood choice.
 */
export function ModeMenu({
  track,
  lang,
  onChange,
  glass = false,
}: {
  track: TrackKey;
  lang: "vi" | "en";
  onChange: (t: TrackKey) => void;
  glass?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const label = (t: TrackKey) => (lang === "vi" ? TRACK_LABEL_VI[t] : TRACK_LABEL_EN[t]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (t: TrackKey) => {
    setOpen(false);
    if (t === track) return;
    try {
      window.localStorage.setItem(TRACK_STORAGE_KEY, t);
    } catch {
      /* private mode */
    }
    onChange(t);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={
          "text-fg inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium " +
          (glass
            ? "border-border bg-[rgba(247,244,238,0.9)] backdrop-blur-md"
            : "border-border bg-paper-card")
        }
        style={{ borderColor: TRACK_COLOR[track] }}
      >
        <span className="inline-flex" style={{ color: TRACK_COLOR[track] }}>
          <TrackIcon track={track} size={14} />
        </span>
        <span className="text-fg-muted">{lang === "vi" ? "Chế độ:" : "Mode:"}</span>
        {label(track)}
        <Icon name="chevronDown" size={14} className="text-fg-muted" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="border-border bg-paper shadow-lift absolute top-full left-0 z-50 mt-2 w-[min(340px,calc(100vw-28px))] rounded-[14px] border p-1.5"
        >
          {TRACKS.map((t) => (
            <button
              key={t}
              type="button"
              role="menuitemradio"
              aria-checked={t === track}
              onClick={() => choose(t)}
              className="hover:bg-paper-sunk flex w-full items-start gap-2.5 rounded-[10px] p-2.5 text-left"
            >
              <span className="mt-0.5 inline-flex" style={{ color: TRACK_COLOR[t] }}>
                <TrackIcon track={t} size={16} />
              </span>
              <span className="flex-1">
                <span className="text-fg block text-[14px] font-medium">{label(t)}</span>
                <span className="text-fg-muted mt-0.5 block text-[12px] leading-snug">
                  {TRACK_DESCRIPTION[t][lang]}
                </span>
              </span>
              {t === track && <Icon name="check" size={16} className="text-primary mt-0.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
