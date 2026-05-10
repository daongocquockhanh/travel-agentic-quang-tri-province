import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const SUPPORTED_LOCALES = ["vi", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined;
  const locale: Locale =
    fromCookie && SUPPORTED_LOCALES.includes(fromCookie) ? fromCookie : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
