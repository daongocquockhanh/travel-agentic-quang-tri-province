"use client";

import { useSyncExternalStore } from "react";

/**
 * The traveller's day plan: an ordered list of site slugs kept in
 * localStorage, shared live between the map, site pages and chat.
 */
const KEY = "qt.plan";
const MAX_STOPS = 10;
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX_STOPS) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: string[]) {
  cache = [...new Set(next)].slice(0, MAX_STOPS);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode: plan lives for this page only */
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

export const plan = {
  get: read,
  set: write,
  add: (slug: string) => write([...read(), slug]),
  remove: (slug: string) => write(read().filter((s) => s !== slug)),
  toggle: (slug: string) => (read().includes(slug) ? plan.remove(slug) : plan.add(slug)),
  move: (slug: string, delta: -1 | 1) => {
    const list = read().slice();
    const i = list.indexOf(slug);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    write(list);
  },
  clear: () => write([]),
  MAX_STOPS,
};

export function usePlan(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
