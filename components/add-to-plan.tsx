"use client";

import { Icon } from "@/components/icon";
import { plan, usePlan } from "@/lib/plan-store";

export function AddToPlanButton({ slug, lang }: { slug: string; lang: "vi" | "en" }) {
  const inPlan = usePlan().includes(slug);
  const label = inPlan ? (lang === "vi" ? "Đã có trong lộ trình" : "In your plan") : lang === "vi" ? "Thêm vào lộ trình" : "Add to plan";
  return (
    <button
      type="button"
      onClick={() => plan.toggle(slug)}
      aria-pressed={inPlan}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper-card px-3 py-1.5 text-[13px] font-medium text-fg"
    >
      <Icon name={inPlan ? "check" : "plus"} size={14} />
      {label}
    </button>
  );
}
