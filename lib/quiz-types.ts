import type { ReviewStatus, SiteContentSection } from "@/lib/sites";

/**
 * Post-visit quiz, read from content/sites/<slug>/quiz.yml. Both languages live in one file so they can't drift apart: one
 * `answer` index serves vi and en. Types only, so client components can import them.
 */

export interface QuizText {
  q: string;
  /** Exactly four options, same order as the other language. */
  options: string[];
  /** Why the answer is right; shown after answering. */
  explain: string;
}

export interface QuizQuestion {
  id: string;
  /** Index into `options`, 0–3. */
  answer: number;
  /** The content section that states the answer; its citation backs the explanation. */
  source: SiteContentSection["section"];
  vi: QuizText;
  en: QuizText;
}

export interface SiteQuiz {
  review_status: ReviewStatus;
  questions: QuizQuestion[];
}
