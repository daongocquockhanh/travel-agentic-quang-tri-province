import { nextPlaces } from "@/lib/planner";
import { isTrackKey } from "@/lib/tracks";

export const dynamic = "force-dynamic";

/**
 * Next-place suggestions.
 * Query: track, from=<slug> or lat&lng, exclude=a,b, time_left_min, k (≤ 5).
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const track = q.get("track");
  if (!isTrackKey(track)) return Response.json({ error: "track is required" }, { status: 400 });

  const lat = q.has("lat") ? Number(q.get("lat")) : NaN;
  const lng = q.has("lng") ? Number(q.get("lng")) : NaN;
  const timeLeft = q.has("time_left_min") ? Number(q.get("time_left_min")) : undefined;
  const k = Math.min(5, Math.max(1, Number(q.get("k") ?? 3) || 3));

  const recommendations = await nextPlaces({
    track,
    from_slug: q.get("from"),
    from: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    exclude: (q.get("exclude") ?? "").split(",").filter(Boolean).slice(0, 20),
    time_left_min: timeLeft != null && Number.isFinite(timeLeft) ? timeLeft : undefined,
    k,
  });
  return Response.json({ recommendations });
}
