import Link from "next/link";
import { Icon } from "@/components/icon";
import type { Itinerary } from "@/lib/route";
import type { TrackKey } from "@/lib/tracks";

function duration(min: number) {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

/** Compact day plan from the agent's build_route tool, with a link that opens it on the map. */
export function RouteCard({ itinerary, lang, track }: { itinerary: Itinerary; lang: "vi" | "en"; track: TrackKey }) {
  const slugs = itinerary.stops.map((s) => s.slug).join(",");
  return (
    <div className="w-full max-w-[92%] rounded-[12px] border border-border bg-paper-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
        <Icon name="route" size={12} />
        {lang === "vi" ? "Lộ trình" : "Day plan"} · {itinerary.start_time}–{itinerary.end_time}
      </p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {itinerary.stops.map((s, i) => (
          <li key={s.slug} className="flex items-baseline gap-2 text-[14px]">
            <span className="grid size-5 shrink-0 translate-y-0.5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-paper">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{lang === "vi" ? s.name_vi : s.name_en}</span>
            <span className="font-mono text-[12px] text-fg-muted">{s.arrive}</span>
            {s.hours_warning && (
              <span title={lang === "vi" ? "Kiểm tra giờ mở cửa" : "Check opening hours"} style={{ color: "var(--warning)" }}>
                !
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12px] text-fg-muted">
        {duration(itinerary.total_travel_min)} {lang === "vi" ? "di chuyển" : "on the road"} · {itinerary.total_distance_km} km
      </p>
      <Link
        href={`/map?track=${track}&tab=plan&plan=${slugs}`}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-medium text-paper"
      >
        <Icon name="pin" size={14} />
        {lang === "vi" ? "Mở trên bản đồ" : "Open on map"}
      </Link>
    </div>
  );
}
