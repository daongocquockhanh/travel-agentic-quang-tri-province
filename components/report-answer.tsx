"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import type { TrackKey } from "@/lib/tracks";

type Reason = "wrong" | "offensive" | "other";

const COPY = {
  en: {
    report: "Report",
    title: "What's wrong with this answer?",
    reasons: {
      wrong: "Wrong or made up",
      offensive: "Offensive or disrespectful",
      other: "Something else",
    },
    cancel: "Cancel",
    thanks: "Thanks — an editor will review it.",
    failed: "Couldn't send. Try again later.",
  },
  vi: {
    report: "Báo lỗi",
    title: "Câu trả lời này có vấn đề gì?",
    reasons: {
      wrong: "Sai hoặc bịa đặt",
      offensive: "Xúc phạm hoặc thiếu tôn trọng",
      other: "Vấn đề khác",
    },
    cancel: "Huỷ",
    thanks: "Cảm ơn bạn — biên tập viên sẽ xem lại.",
    failed: "Chưa gửi được. Vui lòng thử lại sau.",
  },
} as const;

/**
 * Lets a traveller flag a guide answer without leaving the chat (required
 * for AI-generated content by Google Play; reviewed by editors).
 */
export function ReportAnswer({
  question,
  answer,
  track,
  lang,
  siteSlug,
}: {
  question: string;
  answer: string;
  track: TrackKey;
  lang: "vi" | "en";
  siteSlug?: string | null;
}) {
  const [state, setState] = useState<"idle" | "open" | "sending" | "sent" | "failed">("idle");
  const t = COPY[lang];

  const send = async (reason: Reason) => {
    setState("sending");
    try {
      const res = await fetch("/api/agent/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, question, answer, track, lang, site_slug: siteSlug }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent" || state === "failed") {
    return (
      <p role="status" className="text-fg-muted px-1 text-[12px]">
        {state === "sent" ? t.thanks : t.failed}
      </p>
    );
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState("open")}
        className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-[12px] font-medium"
      >
        <Icon name="flag" size={12} />
        {t.report}
      </button>
    );
  }

  return (
    <div className="border-border bg-paper-card w-full max-w-[92%] rounded-[12px] border p-2.5">
      <p className="text-fg px-1 pb-1.5 text-[13px] font-medium">{t.title}</p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(t.reasons) as Reason[]).map((r) => (
          <button
            key={r}
            type="button"
            disabled={state === "sending"}
            onClick={() => send(r)}
            className="border-border text-fg hover:bg-paper-sunk rounded-full border px-3 py-1.5 text-[13px] disabled:opacity-50"
          >
            {t.reasons[r]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setState("idle")}
          className="text-fg-muted hover:text-fg rounded-full px-2 py-1.5 text-[13px]"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
