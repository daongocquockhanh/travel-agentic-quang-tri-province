import type { TrackKey } from "@/lib/tracks";

interface Props {
  track: TrackKey;
  size?: number;
  className?: string;
}

/** Three custom track glyphs. Stroke = currentColor so callers tint via text color. */
export function TrackIcon({ track, size = 24, className }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24" as const,
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    className,
  };

  if (track === "war") {
    // horizon line bisected by 17th-parallel vertical
    return (
      <svg {...common} aria-hidden>
        <line x1="3" y1="13" x2="21" y2="13" />
        <line x1="12" y1="5" x2="12" y2="21" />
      </svg>
    );
  }

  if (track === "foreign") {
    // simplified 8-point compass rose
    return (
      <svg {...common} aria-hidden>
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
      </svg>
    );
  }

  // domestic — pitched roof above road
  return (
    <svg {...{ ...common, strokeLinejoin: "round" as const }} aria-hidden>
      <path d="M3 12 L12 5 L21 12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
