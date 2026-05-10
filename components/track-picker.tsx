"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  TRACKS,
  TRACK_COLOR,
  TRACK_LABEL_EN,
  TRACK_HEADLINE,
  TRACK_SUPPORT,
  TRACK_STORAGE_KEY,
  type TrackKey,
} from "@/lib/tracks";
import { TrackIcon } from "@/components/track-icon";

interface Props {
  /** Where to navigate after a pick. Defaults to /map. */
  redirectTo?: string;
}

export function TrackPicker({ redirectTo = "/map" }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function pick(track: TrackKey) {
    try {
      window.localStorage.setItem(TRACK_STORAGE_KEY, track);
    } catch {
      // storage may be unavailable (private mode) — non-fatal
    }
    startTransition(() => {
      router.push(`${redirectTo}?track=${track}`);
    });
  }

  return (
    <div className="flex h-full flex-col px-5 pb-6 pt-14">
      <header className="mb-7">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-fg-muted">
          Quảng Trị · Vietnam
        </p>
        <h1 className="mt-1.5 font-display text-[30px] leading-[1.1] tracking-tight text-fg">
          Pick where you want to start.
        </h1>
        <p className="mt-1 font-display text-base italic text-fg-muted">
          Chọn cách bạn muốn khám phá
        </p>
      </header>

      <ul className="flex flex-1 flex-col gap-3.5">
        {TRACKS.map((t) => (
          <li key={t}>
            <button
              type="button"
              onClick={() => pick(t)}
              disabled={isPending}
              className="group flex w-full items-stretch overflow-hidden rounded-[14px] border border-border bg-paper-card text-left transition hover:bg-[color-mix(in_oklch,var(--paper-card)_92%,var(--ink))] disabled:opacity-50"
            >
              <span aria-hidden className="w-1.5" style={{ background: TRACK_COLOR[t] }} />
              <div className="flex-1 p-4">
                <div
                  className="flex items-center gap-2"
                  style={{ color: TRACK_COLOR[t] }}
                >
                  <TrackIcon track={t} size={18} />
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em]">
                    {TRACK_LABEL_EN[t]}
                  </span>
                </div>
                <p className="mt-1 font-display text-xl leading-tight text-fg">
                  {TRACK_HEADLINE[t].en}
                </p>
                <p className="mt-1.5 text-xs text-fg-muted">{TRACK_SUPPORT[t]}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3.5 text-center text-[11px] text-fg-subtle">
        You can switch tracks anytime.
      </p>
    </div>
  );
}
