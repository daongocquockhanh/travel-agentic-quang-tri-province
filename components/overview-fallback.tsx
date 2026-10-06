"use client";

import { useEffect, useState } from "react";
import { Citation } from "@/components/citation";
import type { SiteContentSection } from "@/lib/sites";
import type { TrackKey } from "@/lib/tracks";

/**
 * When the guide can't answer (LLM down after its retry), show the site's
 * curated overview so the traveller is never left with nothing
 * (SYSTEM_DESIGN §8.1).
 */
export function OverviewFallback({ slug, lang, track }: { slug: string; lang: "vi" | "en"; track: TrackKey }) {
  const [overview, setOverview] = useState<SiteContentSection | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/sites/${slug}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { site?: { content: Record<"vi" | "en", SiteContentSection[]> } } | null) => {
        const sections = d?.site?.content[lang]?.length ? d.site.content[lang] : d?.site?.content[lang === "vi" ? "en" : "vi"];
        setOverview(sections?.find((s) => s.section === "overview") ?? null);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [slug, lang]);

  if (!overview) return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-fg-muted">
        {lang === "vi" ? "Trong lúc chờ — tổng quan đã biên soạn" : "Meanwhile — the curated overview"}
      </p>
      <div className="mt-1.5 space-y-2 text-[14px] leading-[1.55] text-fg">
        {overview.body.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {overview.source_citation && (
        <div className="mt-2">
          <Citation source={overview.source_citation} href={overview.sources[0]} track={track} />
        </div>
      )}
    </div>
  );
}
