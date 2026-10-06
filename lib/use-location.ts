"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type LocationStatus = "idle" | "locating" | "watching" | "denied" | "unavailable";

/**
 * Watches the traveller's position once they opt in. Never prompts on page
 * load: `start()` is called from a button, or automatically when the
 * browser says permission was already granted. Updates are throttled to
 * one every 15 s (SYSTEM_DESIGN §5.1) to save battery.
 */
export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  const watchId = useRef<number | null>(null);
  const lastUpdate = useRef(0);

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    if (watchId.current != null) return;
    setStatus("locating");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastUpdate.current < 15_000 && lastUpdate.current) return;
        lastUpdate.current = now;
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("watching");
      },
      (err) => {
        stop();
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }, [stop]);

  // Resume silently if the user granted location on an earlier visit.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (p.state === "granted") start();
        if (p.state === "denied") setStatus("denied");
      })
      .catch(() => {});
    return stop;
  }, [start, stop]);

  return { status, position, start };
}
