"use client";

import { TRACK_COLOR, type TrackKey } from "@/lib/tracks";
import { Icon } from "@/components/icon";

interface Props {
  nameVi: string;
  nameEn: string;
  track: TrackKey;
  lang?: "vi" | "en";
  onPlay?: () => void;
  onRead?: () => void;
  onDismiss?: () => void;
}

export function GeofenceBanner({
  nameVi,
  nameEn,
  track,
  lang = "en",
  onPlay,
  onRead,
  onDismiss,
}: Props) {
  const color = TRACK_COLOR[track];
  const vi = lang === "vi";
  return (
    <div
      role="status"
      className="border-border shadow-lift flex items-center gap-3 rounded-[14px] border bg-[rgba(247,244,238,0.92)] p-3 pl-2.5 backdrop-blur-md"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div
        aria-hidden
        className="text-paper grid size-9 shrink-0 place-items-center rounded-full"
        style={{ background: color }}
      >
        <Icon name="pin" size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-fg-muted text-[10px] font-medium tracking-[0.08em] uppercase">
          {vi ? "Bạn đang ở đây" : "You\u2019re here"}
        </p>
        <p className="font-display text-fg truncate text-base leading-tight">
          {vi ? nameVi : nameEn}
        </p>
        <p className="font-display text-fg-muted truncate text-[12px] italic">
          {vi ? nameEn : nameVi}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {onRead && (
          <button
            type="button"
            onClick={onRead}
            className="border-border bg-paper text-fg rounded-full border px-2.5 py-1.5 text-[12px] font-medium"
          >
            {vi ? "Đọc" : "Read"}
          </button>
        )}
        {onPlay && (
          <button
            type="button"
            onClick={onPlay}
            className="text-paper inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium"
            style={{ background: color }}
          >
            <Icon name="headphones" size={13} />
            {vi ? "Nghe" : "Listen"}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={vi ? "Đóng" : "Dismiss"}
            className="text-fg-muted grid size-7 place-items-center rounded-full"
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
