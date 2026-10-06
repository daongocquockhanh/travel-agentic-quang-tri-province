import { z } from "zod";
import { planRoute } from "@/lib/planner";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  slugs: z
    .array(z.string().regex(/^[a-z0-9-]{1,64}$/))
    .min(1)
    .max(12),
  start: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullish(),
  start_time: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .optional(),
  optimize: z.boolean().optional(),
});

/** Itinerary builder: ordered stops with arrival times and travel legs. */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = BodySchema.safeParse(await request.json());
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { itinerary, unknown } = await planRoute(parsed.data);
  if (!itinerary.stops.length) {
    return Response.json({ error: "None of those sites exist", unknown }, { status: 404 });
  }
  return Response.json({ ...itinerary, unknown });
}
