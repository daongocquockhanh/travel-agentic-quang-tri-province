"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { Icon } from "@/components/icon";
import { MAX_RECORDING_MS } from "@/lib/voice/config";

interface Props {
  recording: boolean;
  transcribing: boolean;
  elapsedMs: number;
  disabled?: boolean;
  label: string;
  onPressStart: () => void;
  onPressEnd: (cancel: boolean) => void;
}

const SIZE = 56;
const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Hold-to-talk button. Pointer capture keeps the release on the button even
 * if the thumb drifts; a cancelled pointer (scroll, palm) discards the clip.
 * Space/Enter work the same way from a keyboard.
 */
export function VoiceButton({ recording, transcribing, elapsedMs, disabled, label, onPressStart, onPressEnd }: Props) {
  const progress = Math.min(1, elapsedMs / MAX_RECORDING_MS);

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onPressStart();
  };
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onPressEnd(false);
  };
  const keyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat && !disabled) {
      e.preventDefault();
      onPressStart();
    }
  };
  const keyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onPressEnd(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={recording}
      disabled={disabled}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={() => onPressEnd(true)}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      onContextMenu={(e) => e.preventDefault()}
      className="relative grid shrink-0 touch-none select-none place-items-center rounded-full text-paper transition-transform [-webkit-touch-callout:none] disabled:opacity-40"
      style={{
        width: SIZE,
        height: SIZE,
        background: recording ? "var(--danger)" : "var(--primary)",
        transform: recording ? "scale(1.08)" : "scale(1)",
        boxShadow: recording ? "0 0 0 6px color-mix(in oklch, var(--danger) 22%, transparent)" : undefined,
      }}
    >
      {recording && (
        <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RING_R}
            fill="none"
            stroke="var(--paper)"
            strokeOpacity={0.9}
            strokeWidth={2.5}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
            strokeLinecap="round"
          />
        </svg>
      )}
      {transcribing ? (
        <span className="size-5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" aria-hidden />
      ) : (
        <Icon name="mic" size={24} />
      )}
    </button>
  );
}
