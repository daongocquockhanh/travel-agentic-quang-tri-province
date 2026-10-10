import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AddToPlanButton } from "@/components/add-to-plan";
import { Icon } from "@/components/icon";
import { NextPlaces } from "@/components/next-places";
import { SitePhoto } from "@/components/site-photo";
import { SiteSections } from "@/components/site-sections";
import { formatHours } from "@/lib/format";
import { getSiteWithContent } from "@/lib/sites";
import { SITE_TYPE_LABEL, type TrackKey } from "@/lib/tracks";

function formatTicket(vnd: number | null, lang: "vi" | "en") {
  if (vnd == null) return lang === "vi" ? "Miễn phí" : "Free";
  return new Intl.NumberFormat("vi-VN").format(vnd) + " ₫";
}

function formatVisit(min: number, lang: "vi" | "en") {
  if (min < 60) return `${min} ${lang === "vi" ? "phút" : "min"}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return lang === "vi" ? `${h} giờ${m ? ` ${m}` : ""}` : `${h} h${m ? ` ${m}` : ""}`;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function SiteDetailPage({ params }: Props) {
  const { slug } = await params;
  const site = await getSiteWithContent(slug);
  if (!site) notFound();

  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  const sections = site.content[lang];
  const primaryTrack: TrackKey = site.tracks[0] ?? "foreign";
  const isDraft = sections.some((s) => s.review_status === "draft");
  const title = lang === "vi" ? site.name_vi : site.name_en;
  const subtitle = lang === "vi" ? site.name_en : site.name_vi;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[420px] bg-paper text-fg">
      {/* photo header */}
      <header className="relative">
        <SitePhoto
          photo={site.photo}
          gradient={site.hero_gradient}
          lang={lang}
          width={900}
          credit
          creditAt="top-right"
          priority
          className="h-72 w-full"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(31,36,40,.82), rgba(31,36,40,.05) 55%, rgba(31,36,40,.25))" }}
        />
        <Link
          href="/map"
          aria-label={lang === "vi" ? "Về bản đồ" : "Back to map"}
          className="absolute left-3.5 top-3.5 z-10 grid size-9 place-items-center rounded-full bg-[rgba(247,244,238,0.9)] text-fg backdrop-blur-md"
        >
          <Icon name="back" size={18} />
        </Link>
        <div className="absolute inset-x-5 bottom-8 text-paper">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#F2C27A" }}>
            {SITE_TYPE_LABEL[site.type]?.[lang] ?? site.type}
          </p>
          <h1 className="mt-1 font-display text-[30px] font-medium leading-[1.1] tracking-tight">{title}</h1>
          <p className="mt-0.5 font-display text-[16px] italic opacity-85">{subtitle}</p>
        </div>
      </header>

      <div className="px-4">
        {/* key facts, one glanceable row */}
        <ul className="-mt-4 relative z-10 grid grid-cols-3 divide-x divide-border rounded-[14px] border border-border bg-paper-card shadow-soft">
          <Fact icon="clock" label={lang === "vi" ? "Giờ mở cửa" : "Hours"} value={formatHours(site.hours, lang)} />
          <Fact icon="book" label={lang === "vi" ? "Vé" : "Ticket"} value={formatTicket(site.ticket_price_vnd, lang)} />
          <Fact icon="pin" label={lang === "vi" ? "Nên dành" : "Allow"} value={formatVisit(site.visit_min, lang)} />
        </ul>
        <p className="mt-2 text-center text-[12px] text-fg-muted">
          {lang === "vi"
            ? `Cách Đông Hà khoảng ${site.distance_from_dong_ha_km} km`
            : `About ${site.distance_from_dong_ha_km} km from Đông Hà`}
        </p>

        {/* what you can do here */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`/chat?site=${site.slug}&intent=arrival_story&track=${primaryTrack}`}
            className="flex items-center justify-center gap-2 rounded-full border border-border bg-paper-card px-3 py-2.5 text-[14px] font-medium text-fg"
          >
            <Icon name="play" size={14} />
            {lang === "vi" ? "Nghe câu chuyện" : "Hear the story"}
          </Link>
          <AddToPlanButton slug={site.slug} lang={lang} />
        </div>

        {isDraft && (
          <p className="mt-4 flex gap-2 rounded-[10px] bg-paper-sunk px-3 py-2 text-[12.5px] text-fg-muted">
            <Icon name="book" size={14} className="mt-0.5 shrink-0" />
            {lang === "vi"
              ? "Nội dung trang này là bản nháp, đang chờ biên tập viên kiểm tra với các nguồn bên dưới."
              : "This page is a draft, waiting for an editor to check it against the sources below."}
          </p>
        )}

        <article className="mt-3 pb-28">
          {sections.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border bg-paper-card p-5 text-center text-fg-muted">
              <p className="font-display text-lg text-fg">{lang === "vi" ? "Nội dung sắp ra mắt." : "Content coming soon."}</p>
            </div>
          ) : (
            <SiteSections sections={sections} lang={lang} />
          )}
          <div className="mt-8">
            <NextPlaces fromSlug={site.slug} lang={lang} fallbackTrack={primaryTrack} />
          </div>
        </article>
      </div>

      {/* primary action, always within thumb reach */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[420px] bg-gradient-to-t from-paper via-paper/90 to-transparent px-4 pb-5 pt-6">
        <Link
          href={`/chat?site=${site.slug}`}
          className="pointer-events-auto flex w-full items-center justify-center gap-2.5 rounded-full bg-primary px-4 py-3.5 text-[15px] font-medium text-paper shadow-lift"
        >
          <Icon name="mic" size={18} />
          {lang === "vi" ? "Hỏi hướng dẫn viên về nơi này" : "Ask the guide about this place"}
        </Link>
      </div>
    </main>
  );
}

function Fact({ icon, label, value }: { icon: "clock" | "book" | "pin"; label: string; value: string }) {
  return (
    <li className="flex flex-col items-center px-2 py-2.5 text-center">
      <span className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-muted">
        <Icon name={icon} size={11} />
        {label}
      </span>
      <span className="mt-0.5 text-[14px] font-medium leading-tight text-fg">{value}</span>
    </li>
  );
}
