"use client";

import { Icon } from "@/components/icon";
import { useDownloads } from "@/lib/offline";

/** "Offline" marker on a tour card once that tour is downloaded in this language. */
export function DownloadedBadge({ slug, lang }: { slug: string; lang: "vi" | "en" }) {
  const record = useDownloads()[slug];
  if (!record || record.lang !== lang) return null;
  return (
    <span className="bg-paper/90 text-primary absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium backdrop-blur-sm">
      <Icon name="download" size={12} />
      {lang === "vi" ? "Đã tải" : "Offline"}
    </span>
  );
}
