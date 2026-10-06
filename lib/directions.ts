import "server-only";
import type { Leg } from "@/lib/route";

/**
 * Replaces estimated drive legs with Mapbox Directions figures and road
 * geometry when a token is configured. Any failure (no token, timeout,
 * no route) keeps the estimate, so itineraries always render.
 */
export async function refineLegs(legs: Leg[]): Promise<Leg[]> {
  const token = process.env.MAPBOX_SECRET_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || process.env.ROUTE_DIRECTIONS === "off") return legs;

  return Promise.all(
    legs.map(async (leg) => {
      // Boat legs have no road route end to end; keep the estimate.
      if (leg.mode !== "drive" || leg.geometry.length !== 2) return leg;
      const coords = leg.geometry.map(([lng, lat]) => `${lng},${lat}`).join(";");
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
        `?overview=simplified&geometries=geojson&access_token=${encodeURIComponent(token)}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 86_400 } });
        if (!res.ok) return leg;
        const data = (await res.json()) as {
          routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
        };
        const route = data.routes?.[0];
        if (!route) return leg;
        return {
          ...leg,
          distance_km: Math.round(route.distance / 100) / 10,
          travel_min: Math.max(1, Math.round(route.duration / 60)),
          geometry: route.geometry.coordinates,
          estimated: false,
        };
      } catch {
        return leg;
      }
    }),
  );
}
