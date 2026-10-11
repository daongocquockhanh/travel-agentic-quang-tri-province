"use client";

import { useSyncExternalStore } from "react";
import {
  EMPTY_PASSPORT,
  parsePassport,
  withQuizResult,
  withVisit,
  type Passport,
  type VisitMethod,
} from "@/lib/passport";

/**
 * The passport in localStorage, shared live between the map, site pages, the
 * quiz and /passport (same pattern as lib/plan-store.ts). Lives on this device
 * only; clearing site data clears it.
 */
const KEY = "qt.passport";

let cache: Passport | null = null;
const listeners = new Set<() => void>();

function read(): Passport {
  if (cache) return cache;
  try {
    cache = parsePassport(window.localStorage.getItem(KEY));
  } catch {
    cache = EMPTY_PASSPORT;
  }
  return cache;
}

function write(next: Passport) {
  if (next === cache) return;
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: the passport lives for this page only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const now = () => new Date().toISOString();

export const passport = {
  get: read,
  recordVisit: (slug: string, method: VisitMethod) => write(withVisit(read(), slug, method, now())),
  recordQuiz: (slug: string, score: number, total: number) =>
    write(withQuizResult(read(), slug, score, total, now())),
  clear: () => write(EMPTY_PASSPORT),
};

export function usePassport(): Passport {
  return useSyncExternalStore(subscribe, read, () => EMPTY_PASSPORT);
}
