"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

export type Lang = "vi" | "en";

/**
 * App-wide language. Switching writes the NEXT_LOCALE cookie the server reads
 * and refreshes, so every screen (not just the current one) changes language.
 */
export function useLang(initial: Lang) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initial);
  const [, startTransition] = useTransition();

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
      startTransition(() => router.refresh());
    },
    [router],
  );

  return { lang, setLang, toggle: () => setLang(lang === "vi" ? "en" : "vi") };
}
