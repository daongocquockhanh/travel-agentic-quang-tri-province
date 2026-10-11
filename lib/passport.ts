/**
 * The traveller's passport: which sites they visited and how they did on each
 * quiz. Pure functions here; lib/passport-store.ts keeps it in localStorage.
 *
 * A stamp needs both a visit and a finished quiz (any score). Visits come from
 * the geofence ("gps") or an honest "I visited" tap ("self").
 */

export type VisitMethod = "gps" | "self";

export interface Passport {
  visits: Record<string, { at: string; method: VisitMethod }>;
  quizzes: Record<string, { best: number; total: number; at: string }>;
}

export type StampState = "none" | "visited" | "quizzed" | "stamped";

export const EMPTY_PASSPORT: Passport = Object.freeze({ visits: {}, quizzes: {} }) as Passport;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Reads stored JSON, keeping only well-formed entries; anything else becomes empty. */
export function parsePassport(raw: string | null): Passport {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    return EMPTY_PASSPORT;
  }
  if (!isObj(data)) return EMPTY_PASSPORT;

  const visits: Passport["visits"] = {};
  if (isObj(data.visits)) {
    for (const [slug, v] of Object.entries(data.visits)) {
      if (isObj(v) && isDate(v.at) && (v.method === "gps" || v.method === "self")) {
        visits[slug] = { at: v.at, method: v.method };
      }
    }
  }
  const quizzes: Passport["quizzes"] = {};
  if (isObj(data.quizzes)) {
    for (const [slug, v] of Object.entries(data.quizzes)) {
      if (
        isObj(v) &&
        Number.isInteger(v.best) &&
        Number.isInteger(v.total) &&
        (v.best as number) >= 0 &&
        (v.best as number) <= (v.total as number) &&
        isDate(v.at)
      ) {
        quizzes[slug] = { best: v.best as number, total: v.total as number, at: v.at };
      }
    }
  }
  return Object.keys(visits).length || Object.keys(quizzes).length
    ? { visits, quizzes }
    : EMPTY_PASSPORT;
}

/** A GPS check-in upgrades a self-reported visit; nothing downgrades one. */
export function withVisit(p: Passport, slug: string, method: VisitMethod, at: string): Passport {
  const prev = p.visits[slug];
  if (prev && (prev.method === "gps" || method === "self")) return p;
  return { ...p, visits: { ...p.visits, [slug]: { at, method } } };
}

/** Keeps the best score (and the date it was reached). */
export function withQuizResult(
  p: Passport,
  slug: string,
  score: number,
  total: number,
  at: string,
): Passport {
  const prev = p.quizzes[slug];
  if (prev && prev.best >= score) return p;
  return { ...p, quizzes: { ...p.quizzes, [slug]: { best: score, total, at } } };
}

export function stampState(p: Passport, slug: string): StampState {
  const visited = Boolean(p.visits[slug]);
  const quizzed = Boolean(p.quizzes[slug]);
  if (visited && quizzed) return "stamped";
  if (visited) return "visited";
  if (quizzed) return "quizzed";
  return "none";
}
