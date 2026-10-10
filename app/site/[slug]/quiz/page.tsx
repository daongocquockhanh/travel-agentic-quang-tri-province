import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { QuizRunner, type QuizSource } from "@/components/quiz-runner";
import { getQuiz } from "@/lib/content";
import type { QuizQuestion } from "@/lib/quiz-types";
import { getSiteWithContent, type SiteContentSection } from "@/lib/sites";

interface Props {
  params: Promise<{ slug: string }>;
}

const SECTION_LABEL: Record<SiteContentSection["section"], { vi: string; en: string }> = {
  overview: { vi: "Tổng quan", en: "Overview" },
  history: { vi: "Lịch sử", en: "History" },
  visit_tips: { vi: "Mẹo tham quan", en: "Visit tips" },
  culture_notes: { vi: "Phong tục", en: "Customs" },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getSiteWithContent((await params).slug);
  return { title: site ? `Quiz · ${site.name_en}` : "Quiz" };
}

export default async function QuizPage({ params }: Props) {
  const { slug } = await params;
  const lang = (await getLocale()) === "vi" ? "vi" : "en";
  const [site, quiz] = await Promise.all([getSiteWithContent(slug), getQuiz(slug)]);
  if (!site || !quiz || !quiz.questions.length) notFound();

  // Each explanation points back to the section (and citation) that states the answer.
  const sources: Partial<Record<QuizQuestion["source"], QuizSource>> = {};
  for (const sec of site.content[lang]) {
    sources[sec.section] = {
      label: SECTION_LABEL[sec.section][lang],
      citation: sec.source_citation,
      href: sec.sources[0] ?? null,
    };
  }

  return (
    <QuizRunner
      questions={quiz.questions}
      lang={lang}
      isDraft={quiz.review_status !== "reviewed"}
      sources={sources}
      site={{
        slug: site.slug,
        name: lang === "vi" ? site.name_vi : site.name_en,
        hero_gradient: site.hero_gradient,
        photo: site.photo,
      }}
    />
  );
}
