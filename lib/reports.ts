import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TRACKS } from "@/lib/tracks";

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

/** Stores a report for editors (Supabase), or logs it when no database is configured. */
export async function saveReport(report: AnswerReport): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.info("[answer_report]", JSON.stringify(report));
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase
    .from("answer_reports")
    .insert({ ...report, site_slug: report.site_slug ?? null });
  if (error) throw error;
}
