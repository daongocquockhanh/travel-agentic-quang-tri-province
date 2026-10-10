/** Opening-hours strings are stored in English; show them in the reader's language. */
export function formatHours(hours: string, lang: "vi" | "en"): string {
  if (lang === "en") return hours;
  return hours
    .replace(/^(Open 24h|Always open)$/i, "Mở cả ngày")
    .replace(/^Day tour\s+/i, "Tour trong ngày ");
}
