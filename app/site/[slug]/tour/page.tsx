import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { TourPlayer } from "@/components/tour-player";
import { getSite, getTour } from "@/lib/sites";
import { defaultVoice } from "@/lib/voice/config";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getSite((await params).slug);
  return { title: site ? `Audio tour · ${site.name_en}` : "Audio tour" };
}

export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  const [site, tour] = await Promise.all([getSite(slug), getTour(slug, lang)]);
  if (!site || !tour) notFound();

  return (
    <TourPlayer
      tour={tour}
      lang={lang}
      voice={defaultVoice(site.tracks[0] ?? "foreign")}
      site={{
        slug: site.slug,
        name: lang === "vi" ? site.name_vi : site.name_en,
        hero_gradient: site.hero_gradient,
        photo: site.photo,
      }}
    />
  );
}
