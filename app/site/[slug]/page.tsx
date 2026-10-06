import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSiteWithContent, type SiteContentSection } from "@/lib/sites";
import { TRACK_COLOR, TRACK_LABEL_EN, type TrackKey } from "@/lib/tracks";
import { TrackIcon } from "@/components/track-icon";
import { Citation } from "@/components/citation";
import { Icon } from "@/components/icon";
import { AddToPlanButton } from "@/components/add-to-plan";
import { NextPlaces } from "@/components/next-places";

const SECTION_LABEL: Record<SiteContentSection["section"], string> = {
  overview: "Overview",
  history: "History",
  visit_tips: "Visit tips",
  culture_notes: "Culture notes",
};

const SECTION_LABEL_VI: Record<SiteContentSection["section"], string> = {
  overview: "Tổng quan",
  history: "Lịch sử",
  visit_tips: "Mẹo tham quan",
  culture_notes: "Văn hóa",
};

function formatTicket(vnd: number | null) {
  if (vnd == null) return "Free";
  return new Intl.NumberFormat("vi-VN").format(vnd) + " ₫";
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function SiteDetailPage({ params }: Props) {
  const { slug } = await params;
  const site = await getSiteWithContent(slug);
  if (!site) notFound();

  const locale = (await getLocale()) === "vi" ? "vi" : "en";
  const sections = site.content[locale];
  const sectionLabel = locale === "vi" ? SECTION_LABEL_VI : SECTION_LABEL;
  const primaryTrack: TrackKey = site.tracks[0] ?? "foreign";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[420px] bg-paper text-fg">
      {/* hero */}
      <header
        className="relative h-60 w-full overflow-hidden"
        style={{ background: site.hero_gradient }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(31,36,40,0.55), rgba(31,36,40,0) 50%)",
          }}
        />
        <Link
          href="/map"
          aria-label="Back to map"
          className="absolute left-3.5 top-14 z-10 grid size-9 place-items-center rounded-full border border-border bg-[rgba(247,244,238,0.86)] text-fg backdrop-blur-md"
        >
          <Icon name="back" size={18} />
        </Link>
        <div className="absolute inset-x-5 bottom-4 text-paper">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border bg-paper/15 px-2.5 py-1 font-sans text-[11px] font-medium backdrop-blur-md"
            style={{ borderColor: TRACK_COLOR[primaryTrack], color: "var(--paper)" }}
          >
            <span style={{ color: TRACK_COLOR[primaryTrack] }} className="inline-flex">
              <TrackIcon track={primaryTrack} size={12} />
            </span>
            {TRACK_LABEL_EN[primaryTrack]}
          </span>
          <h1 className="mt-2 font-display text-[30px] font-medium leading-tight tracking-tight">
            {site.name_vi}
          </h1>
          <p className="mt-0.5 font-display text-[17px] italic opacity-85">{site.name_en}</p>
        </div>
      </header>

      {/* quick facts */}
      <ul className="grid grid-cols-2 gap-2 p-4">
        <Fact label="Hours" value={site.hours} />
        <Fact label="Ticket" value={formatTicket(site.ticket_price_vnd)} />
        <Fact label="From Đông Hà" value={`${site.distance_from_dong_ha_km} km`} />
        <Fact label="Type" value={site.type[0].toUpperCase() + site.type.slice(1)} />
      </ul>

      <div className="flex items-center gap-2 px-4 pb-2">
        <AddToPlanButton slug={site.slug} lang={locale} />
        <Link
          href={`/map?tab=plan`}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium text-primary"
        >
          <Icon name="route" size={14} />
          {locale === "vi" ? "Xem lộ trình" : "View plan"}
        </Link>
      </div>

      {/* sections */}
      <article className="flex flex-col gap-6 px-4 pb-28">
        {sections.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-border bg-paper-card p-5 text-center text-fg-muted">
            <p className="font-display text-lg text-fg">
              {locale === "vi" ? "Nội dung sắp ra mắt." : "Content coming soon."}
            </p>
            <p className="mt-1 text-sm">
              {locale === "vi"
                ? "Địa điểm này chưa có nội dung biên soạn."
                : "This site doesn't have curated content yet."}
            </p>
          </div>
        ) : (
          sections.map((sec) => (
            <section key={sec.section} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-xl">{sectionLabel[sec.section]}</h2>
                {sec.review_status === "draft" && (
                  <span
                    className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-fg-muted"
                    title={
                      locale === "vi"
                        ? "Nội dung đang chờ biên tập viên duyệt"
                        : "This section is awaiting editorial review"
                    }
                  >
                    {locale === "vi" ? "Bản nháp" : "Draft"}
                  </span>
                )}
              </div>
              <div className="space-y-3 text-[15px] leading-[1.55] text-fg">
                {sec.body.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {sec.source_citation && (
                <div className="flex flex-wrap gap-1.5">
                  <Citation source={sec.source_citation} href={sec.sources[0]} track={primaryTrack} />
                </div>
              )}
            </section>
          ))
        )}
        <NextPlaces fromSlug={site.slug} lang={locale} fallbackTrack={primaryTrack} />
      </article>

      {/* floating CTA */}
      <div className="pointer-events-none sticky bottom-0 left-0 right-0 z-20 px-4 pb-5">
        <Link
          href={`/chat?site=${site.slug}`}
          className="pointer-events-auto flex w-full items-center justify-center gap-2.5 rounded-full bg-primary px-4 py-3 font-sans text-[15px] font-medium text-paper shadow-lift"
        >
          <Icon name="send" size={18} />
          {locale === "vi" ? "Hỏi về địa điểm này" : "Ask about this place"}
        </Link>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-[10px] border border-border bg-paper-card px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-fg-muted">{label}</p>
      <p className="mt-0.5 font-display text-[17px]">{value}</p>
    </li>
  );
}
