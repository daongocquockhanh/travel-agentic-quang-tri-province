import type { QuizQuestion } from "@/lib/quiz-types";

/** One question as the traveller sees it in this attempt: their language, options shuffled. */
export interface AttemptQuestion {
  id: string;
  q: string;
  options: string[];
  /** Index of the right option after shuffling. */
  correct: number;
  explain: string;
  source: QuizQuestion["source"];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Question and option order change every attempt so a retake tests recall,
 * not the position of the right answer.
 */
export function prepareAttempt(
  questions: QuizQuestion[],
  lang: "vi" | "en",
  random: () => number = Math.random,
): AttemptQuestion[] {
  return shuffle(questions, random).map((question) => {
    const text = question[lang];
    const order = shuffle([0, 1, 2, 3], random);
    return {
      id: question.id,
      q: text.q,
      options: order.map((i) => text.options[i]),
      correct: order.indexOf(question.answer),
      explain: text.explain,
      source: question.source,
    };
  });
}

export function scoreAttempt(attempt: AttemptQuestion[], picks: number[]) {
  const missed = attempt.filter((a, i) => picks[i] !== a.correct);
  return { score: attempt.length - missed.length, total: attempt.length, missed };
}
