import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Icon } from "@/components/icon";
import { SitePhoto } from "@/components/site-photo";
import { TAB_BAR_PX, TabBar } from "@/components/tab-bar";
import { getTour, listSites } from "@/lib/sites";
import { formatMinutes, listenSeconds } from "@/lib/tours";
import { SITE_TYPE_LABEL, TRACK_COLOR } from "@/lib/tracks";

export const metadata: Metadata = { title: "Audio tours · Quảng Trị Travel Guide" };

/** Every place's audio tour, narrated scripts first: the "browse tours" shelf of a guide app. */
export default async function ToursPage() {
  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  const vi = lang === "vi";
  const sites = await listSites();
  const tours = (
    await Promise.all(
      sites.map(async (site) => {
        const tour = await getTour(site.slug, lang);
        if (!tour) return null;
        const seconds = tour.stops.reduce((sum, s) => sum + listenSeconds(s.body, lang), 0);
        return { site, tour, seconds };
      }),
    )
  )
    .filter((t) => t != null)
    .sort(
      (a, b) =>
        Number(b.tour.authored) - Number(a.tour.authored) ||
        a.site.distance_from_dong_ha_km - b.site.distance_from_dong_ha_km,
    );

  return (
    <main
      className="bg-paper text-fg mx-auto min-h-dvh w-full max-w-[420px] px-4 pt-[calc(1.25rem+var(--safe-top))]"
      style={{ paddingBottom: `calc(${TAB_BAR_PX + 24}px + var(--safe-bottom))` }}
    >
      <p className="text-fg-muted text-[11px] font-medium tracking-[0.1em] uppercase">Quảng Trị</p>
      <h1 className="font-display mt-1 text-[30px] leading-tight font-medium">
        {vi ? "Nghe thuyết minh" : "Audio tours"}
      </h1>
      <p className="text-fg-muted mt-1.5 text-[14.5px] leading-snug">
        {vi
          ? "Câu chuyện của từng nơi, chia thành những điểm dừng ngắn. Đeo tai nghe và nghe khi bạn đi."
          : "Each place's story in short stops. Put your headphones in and listen as you walk."}
      </p>

      <ul className="mt-5 flex flex-col gap-3">
        {tours.map(({ site, tour, seconds }) => {
          const name = vi ? site.name_vi : site.name_en;
          const track = site.tracks[0] ?? "foreign";
          return (
            <li key={site.slug}>
              <Link
                href={`/site/${site.slug}/tour`}
                className="border-border bg-paper-card group block overflow-hidden rounded-[16px] border"
              >
                <div className="relative">
                  <SitePhoto
                    photo={site.photo}
                    gradient={site.hero_gradient}
                    lang={lang}
                    width={700}
                    decorative
                    className="h-36 w-full"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(31,36,40,.7), rgba(31,36,40,0) 60%)",
                    }}
                  />
                  <span className="bg-paper/90 text-fg absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium backdrop-blur-sm">
                    <Icon name="headphones" size={13} />
                    {vi ? `${tour.stops.length} điểm dừng` : `${tour.stops.length} stops`} ·{" "}
                    {formatMinutes(seconds, lang)}
                  </span>
                  <span className="bg-primary text-paper absolute right-3 bottom-3 grid size-11 place-items-center rounded-full shadow-[0_4px_14px_rgba(15,76,92,.45)] transition group-hover:scale-105">
                    <Icon name="play" size={18} />
                  </span>
                  <p className="font-display text-paper absolute right-16 bottom-3 left-3.5 text-[20px] leading-tight">
                    {name}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <span
                    className="text-[11px] font-medium tracking-[0.06em] uppercase"
                    style={{ color: TRACK_COLOR[track] }}
                  >
                    {SITE_TYPE_LABEL[site.type]?.[lang] ?? site.type}
                  </span>
                  <span className="text-fg-muted truncate text-[12.5px]">
                    {tour.authored
                      ? vi
                        ? `Thuyết minh: ${tour.stops[0].title}`
                        : `Narrated · starts with “${tour.stops[0].title}”`
                      : vi
                        ? "Đọc từ trang địa điểm"
                        : "Read from the place guide"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <TabBar lang={lang} className="fixed inset-x-0 bottom-0" />
    </main>
  );
}
