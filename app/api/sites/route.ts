import { NextResponse } from "next/server";
import { listSites } from "@/lib/sites";
import { isTrackKey } from "@/lib/tracks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackParam = searchParams.get("track");
  const track = trackParam && isTrackKey(trackParam) ? trackParam : undefined;

  const sites = await listSites(track ? { track } : undefined);
  return NextResponse.json({ sites });
}
