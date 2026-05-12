import { TRACK_COLOR, type TrackKey } from "@/lib/tracks";

interface Props {
  source: string;
  href?: string;
  track?: TrackKey;
}

export function Citation({ source, href, track = "war" }: Props) {
  const inner = (
    <>
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: TRACK_COLOR[track] }}
      />
      <span>{source}</span>
      {href && <span aria-hidden>↗</span>}
    </>
  );

  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-paper-card px-2.5 py-1 font-mono text-[11px] text-fg-muted";

  if (href) {
    return (
      <a className={className + " hover:text-fg"} href={href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return <span className={className}>{inner}</span>;
}
