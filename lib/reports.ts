import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TRACKS } from "@/lib/tracks";
import { cloudflareEnv } from "@/lib/cloudflare-env";

export const REPORT_REASONS = ["wrong", "offensive", "other"] as const;

export const ReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().max(500).optional(),
  question: z.string().max(2000),
  answer: z.string().min(1).max(8000),
  track: z.enum(TRACKS).optional(),
  lang: z.enum(["vi", "en"]).optional(),
  site_slug: z.string().max(80).nullish(),
});

export type AnswerReport = z.infer<typeof ReportSchema>;

/**
 * Stores a report for editors: Supabase when configured, else Cloudflare D1
 * (free; see migrations/d1), else the Worker log.
 */
export async function saveReport(report: AnswerReport): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const db = (await cloudflareEnv())?.DB;
    if (db) {
      await db
        .prepare(
          "INSERT INTO answer_reports (reason, note, question, answer, track, lang, site_slug) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          report.reason,
          report.note ?? null,
          report.question,
          report.answer,
          report.track ?? null,
          report.lang ?? null,
          report.site_slug ?? null,
        )
        .run();
      return;
    }
    console.info("[answer_report]", JSON.stringify(report));
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase
    .from("answer_reports")
    .insert({ ...report, site_slug: report.site_slug ?? null });
  if (error) throw error;
}
