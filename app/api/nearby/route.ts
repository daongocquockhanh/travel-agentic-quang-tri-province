import { NextResponse } from "next/server";
import { findNearby } from "@/lib/sites";
import { isTrackKey } from "@/lib/tracks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radius_km = Number(searchParams.get("radius_km") ?? 2);
  const trackParam = searchParams.get("track");
  const track = trackParam && isTrackKey(trackParam) ? trackParam : undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required numbers" }, { status: 400 });
  }
  if (!Number.isFinite(radius_km) || radius_km <= 0 || radius_km > 200) {
    return NextResponse.json({ error: "radius_km must be 0 < r ≤ 200" }, { status: 400 });
  }

  const sites = await findNearby({ lat, lng, radius_km, track });
  return NextResponse.json({ sites });
}
