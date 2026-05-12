"use client";

import { TRACK_COLOR, type TrackKey } from "@/lib/tracks";
import { Icon } from "@/components/icon";

interface Props {
  nameVi: string;
  nameEn: string;
  track: TrackKey;
  onPlay?: () => void;
  onRead?: () => void;
  onDismiss?: () => void;
}

export function GeofenceBanner({ nameVi, nameEn, track, onPlay, onRead, onDismiss }: Props) {
  const color = TRACK_COLOR[track];
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-[14px] border border-border bg-[rgba(247,244,238,0.92)] p-3 pl-2.5 shadow-lift backdrop-blur-md"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full text-paper"
        style={{ background: color }}
      >
        <Icon name="pin" size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-fg-muted">
          You&rsquo;re here
        </p>
        <p className="truncate font-display text-base leading-tight text-fg">{nameVi}</p>
        <p className="truncate font-display text-[12px] italic text-fg-muted">{nameEn}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {onRead && (
          <button
            type="button"
            onClick={onRead}
            className="rounded-full border border-border bg-paper px-2.5 py-1.5 text-[12px] font-medium text-fg"
          >
            Read
          </button>
        )}
        {onPlay && (
          <button
            type="button"
            onClick={onPlay}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium text-paper"
            style={{ background: color }}
          >
            Play
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="grid size-7 place-items-center rounded-full text-fg-muted"
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
