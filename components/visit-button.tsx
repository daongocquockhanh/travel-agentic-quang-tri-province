"use client";

import { Icon } from "@/components/icon";
import { passport, usePassport } from "@/lib/passport-store";

const T = {
  vi: {
    mark: "Tôi đã đến đây",
    gps: "Đã đến · xác nhận bằng vị trí",
    self: "Đã đến · tự xác nhận",
    hint: "Dùng khi vị trí không xác nhận được (trong nhà, tắt định vị).",
  },
  en: {
    mark: "I visited this place",
    gps: "Visited · confirmed by location",
    self: "Visited · self-reported",
    hint: "For when location can't confirm it (indoors, location off).",
  },
} as const;

/**
 * Marks a visit by hand when the geofence can't (indoors, location denied).
 * Self-reported visits are labelled as such on the passport.
 */
export function VisitButton({ slug, lang }: { slug: string; lang: "vi" | "en" }) {
  const t = T[lang];
  const visit = usePassport().visits[slug];

  if (visit) {
    return (
      <p className="text-fg-muted flex items-center justify-center gap-1.5 text-[13px]">
        <Icon name={visit.method === "gps" ? "pin" : "check"} size={14} />
        {visit.method === "gps" ? t.gps : t.self}
      </p>
    );
  }
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => passport.recordVisit(slug, "self")}
        className="border-border bg-paper-card inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] font-medium"
      >
        <Icon name="flag" size={15} />
        {t.mark}
      </button>
      <p className="text-fg-muted mt-1.5 text-[12px]">{t.hint}</p>
    </div>
  );
}
