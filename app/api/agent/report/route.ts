import { rateLimited } from "@/lib/rate-limit";
import { ReportSchema, saveReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** POST {reason, question, answer, …} → 204. A traveller flags a guide answer. */
export async function POST(request: Request) {
  const limited = await rateLimited("report", request);
  if (limited) return limited;

  let parsed;
  try {
    parsed = ReportSchema.safeParse(await request.json());
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await saveReport(parsed.data);
  } catch (err) {
    console.error("[answer_report] save failed:", err);
    return Response.json({ error: "Could not save the report" }, { status: 502 });
  }
  return new Response(null, { status: 204 });
}
