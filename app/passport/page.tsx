import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { PassportGrid, type PassportSite } from "@/components/passport-grid";
import { getQuiz } from "@/lib/content";
import { listSites } from "@/lib/sites";

export const metadata: Metadata = { title: "Travel passport" };

export default async function PassportPage() {
  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  const sites = await listSites();
  const withQuiz: PassportSite[] = await Promise.all(
    sites.map(async (s) => ({
      slug: s.slug,
      name: lang === "vi" ? s.name_vi : s.name_en,
      hero_gradient: s.hero_gradient,
      photo: s.photo,
      hasQuiz: Boolean(await getQuiz(s.slug)),
    })),
  );
  return <PassportGrid sites={withQuiz} lang={lang} />;
}
