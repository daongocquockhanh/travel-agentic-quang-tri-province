/**
 * Editorial checks for content/sites/<slug>/quiz.yml, run by
 * lib/content-check.ts. A pure function over parsed YAML so it tests without fixtures.
 */

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

const LANGS = ["vi", "en"] as const;
const MIN_QUESTIONS = 5;


const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function checkQuiz(
  slug: string,
  quiz: unknown,
  /** Sections present for this site (in both languages). */
  sections: string[],
  opts: { strict?: boolean } = {},
): CheckResult {
  const r: CheckResult = { errors: [], warnings: [] };
  const at = (m: string) => `${slug}/quiz.yml: ${m}`;

  if (!isObj(quiz) || !Array.isArray(quiz.questions)) {
    r.errors.push(at("questions must be a list"));
    return r;
  }
  if (quiz.review_status !== "draft" && quiz.review_status !== "reviewed") {
    r.errors.push(at('review_status must be "draft" or "reviewed"'));
  } else if (quiz.review_status !== "reviewed") {
    (opts.strict ? r.errors : r.warnings).push(at("not yet reviewed"));
  }
  if (quiz.questions.length < MIN_QUESTIONS) {
    r.warnings.push(at(`only ${quiz.questions.length} questions (aim for ${MIN_QUESTIONS})`));
  }

  const seen = new Set<string>();
  quiz.questions.forEach((raw, i) => {
    const q = isObj(raw) ? raw : {};
    const id = nonEmpty(q.id) ? q.id : `#${i + 1}`;
    const qa = (m: string) => r.errors.push(at(`${id}: ${m}`));

    if (!nonEmpty(q.id)) qa("id is required");
    else if (seen.has(q.id)) r.errors.push(at(`duplicate question id "${q.id}"`));
    else seen.add(q.id);

    if (!Number.isInteger(q.answer) || (q.answer as number) < 0 || (q.answer as number) > 3) {
      qa("answer must be 0, 1, 2 or 3");
    }
    if (!sections.includes(q.source as string)) {
      qa(`source "${String(q.source)}" is not a section of this site (${sections.join(", ")})`);
    }

    for (const lang of LANGS) {
      const t = q[lang];
      if (!isObj(t)) {
        qa(`${lang} is missing`);
        continue;
      }
      if (!nonEmpty(t.q)) qa(`${lang}.q is required`);
      if (!nonEmpty(t.explain)) qa(`${lang}.explain is required`);
      if (!Array.isArray(t.options) || t.options.length !== 4 || !t.options.every(nonEmpty)) {
        qa(`${lang} needs exactly 4 options`);
      }
    }
  });

  return r;
}
