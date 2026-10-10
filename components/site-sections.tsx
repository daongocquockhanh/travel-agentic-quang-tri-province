"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import type { SiteContentSection } from "@/lib/sites";

const LABEL: Record<SiteContentSection["section"], { en: string; vi: string }> = {
  overview: { en: "Overview", vi: "Tổng quan" },
  history: { en: "History", vi: "Lịch sử" },
  visit_tips: { en: "Visit tips", vi: "Mẹo tham quan" },
  culture_notes: { en: "Customs", vi: "Phong tục" },
};

/**
 * The curated sections as tabs (design brief §4) rather than one long scroll,
 * with every source listed once at the bottom instead of repeated per section.
 */
export function SiteSections({
  sections,
  lang,
}: {
  sections: SiteContentSection[];
  lang: "vi" | "en";
}) {
  const [active, setActive] = useState(sections[0]?.section);
  const current = sections.find((s) => s.section === active) ?? sections[0];

  // One entry per distinct citation, with every source URL behind it.
  const sources = new Map<string, Set<string>>();
  for (const s of sections) {
    if (!s.source_citation) continue;
    const urls = sources.get(s.source_citation) ?? new Set<string>();
    s.sources.forEach((u) => urls.add(u));
    sources.set(s.source_citation, urls);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={lang === "vi" ? "Nội dung" : "Sections"}
        className="border-border bg-paper/95 before:bg-paper/95 sticky top-[var(--safe-top)] z-10 -mx-4 flex gap-1 overflow-x-auto border-b px-4 backdrop-blur-md before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[var(--safe-top)]"
      >
        {sections.map((s) => (
          <button
            key={s.section}
            type="button"
            role="tab"
            aria-selected={s.section === current.section}
            onClick={() => setActive(s.section)}
            className={
              "shrink-0 border-b-2 px-3 py-3 text-[14px] font-medium transition " +
              (s.section === current.section
                ? "border-primary text-fg"
                : "text-fg-muted hover:text-fg border-transparent")
            }
          >
            {LABEL[s.section][lang]}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="text-fg space-y-3 pt-4 text-[15.5px] leading-[1.6]">
        {current.body.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {sources.size > 0 && (
        <details className="border-border bg-paper-card mt-5 rounded-[12px] border p-3 text-[13px]">
          <summary className="text-fg flex cursor-pointer list-none items-center gap-2 font-medium">
            <Icon name="book" size={14} className="text-fg-muted" />
            {lang === "vi" ? `Nguồn tư liệu (${sources.size})` : `Sources (${sources.size})`}
            <Icon name="chevronDown" size={14} className="text-fg-muted ml-auto" />
          </summary>
          <ul className="text-fg-muted mt-2.5 flex flex-col gap-2.5">
            {[...sources].map(([citation, urls]) => (
              <li key={citation}>
                <p className="text-fg">{citation}</p>
                {[...urls].map((u) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary block truncate font-mono text-[11px] hover:underline"
                  >
                    {readableUrl(u)}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Percent-encoded Wikipedia URLs are unreadable; show them decoded. */
function readableUrl(u: string) {
  try {
    return decodeURI(u).replace(/^https?:\/\//, "");
  } catch {
    return u.replace(/^https?:\/\//, "");
  }
}
