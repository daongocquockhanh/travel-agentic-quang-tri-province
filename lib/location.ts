import { Geolocation, type PermissionStatus } from "@capacitor/geolocation";
import type { LatLng } from "@/lib/geo";
import { isNativeApp } from "@/lib/native";

/**
 * Location helpers that use the native API inside the app shells and the
 * browser API elsewhere, so the app never shows the WebView's own
 * "this website wants your location" prompt on top of the system one.
 */

/** Android users may grant only approximate location; that is enough here. */
export function nativeState(p: PermissionStatus): "granted" | "denied" | "prompt" {
  if (p.location === "granted" || p.coarseLocation === "granted") return "granted";
  if (p.location === "denied" && p.coarseLocation === "denied") return "denied";
  return "prompt";
}

/** Current permission without prompting. */
export async function locationPermission(): Promise<"granted" | "denied" | "prompt"> {
  try {
    if (isNativeApp()) {
      return nativeState(await Geolocation.checkPermissions());
    }
    if (!("geolocation" in navigator) || !navigator.permissions) return "prompt";
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return "prompt";
  }
}

/** One coarse fix; prompts if needed. Null when unavailable or refused. */
export async function currentPosition(): Promise<LatLng | null> {
  try {
    if (isNativeApp()) {
      const state = nativeState(
        await Geolocation.requestPermissions({ permissions: ["location"] }),
      );
      if (state !== "granted") return null;
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60_000,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}
