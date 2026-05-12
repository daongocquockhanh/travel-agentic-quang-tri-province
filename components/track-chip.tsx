"use client";

import { TRACK_COLOR, TRACK_LABEL_EN, TRACK_LABEL_VI, type TrackKey } from "@/lib/tracks";
import { TrackIcon } from "@/components/track-icon";

interface Props {
  track: TrackKey;
  lang?: "vi" | "en";
  glass?: boolean;
  solid?: boolean;
  onClick?: () => void;
}

export function TrackChip({ track, lang = "en", glass = false, solid = false, onClick }: Props) {
  const color = TRACK_COLOR[track];
  const label = lang === "vi" ? TRACK_LABEL_VI[track] : TRACK_LABEL_EN[track];

  const bg = glass
    ? "rgba(247,244,238,0.86)"
    : solid
      ? color
      : `color-mix(in oklch, ${color} 8%, var(--paper))`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 font-sans text-[13px] font-medium transition"
      style={{
        background: bg,
        border: `2px solid ${color}`,
        color: solid ? "var(--paper)" : "var(--ink)",
        backdropFilter: glass ? "blur(12px)" : undefined,
        WebkitBackdropFilter: glass ? "blur(12px)" : undefined,
      }}
    >
      <span className="inline-flex" style={{ color }}>
        <TrackIcon track={track} size={14} />
      </span>
      {label}
    </button>
  );
}
