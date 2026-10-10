"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import type { LatLng } from "@/lib/geo";
import { locationPermission, nativeState } from "@/lib/location";
import { isNativeApp } from "@/lib/native";

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
  // Browser watch ids are numbers, native ones strings; "pending" while the native prompt is open.
  const watchId = useRef<number | string | null>(null);
  const lastUpdate = useRef(0);

  const stop = useCallback(() => {
    if (watchId.current != null) {
      if (isNativeApp()) {
        if (watchId.current !== "pending")
          void Geolocation.clearWatch({ id: String(watchId.current) });
      } else navigator.geolocation.clearWatch(Number(watchId.current));
    }
    watchId.current = null;
  }, []);

  const onPosition = useCallback((coords: { latitude: number; longitude: number }) => {
    const now = Date.now();
    if (now - lastUpdate.current < 15_000 && lastUpdate.current) return;
    lastUpdate.current = now;
    setPosition({ lat: coords.latitude, lng: coords.longitude });
    setStatus("watching");
  }, []);

  const start = useCallback(() => {
    if (watchId.current != null) return;

    // App shells: the native location prompt and API, instead of the WebView's
    // own "this website wants your location" prompt on top of the app's.
    if (isNativeApp()) {
      setStatus("locating");
      watchId.current = "pending";
      Geolocation.requestPermissions({ permissions: ["location"] })
        .then((p) => {
          if (nativeState(p) !== "granted") throw new Error("denied");
          return Geolocation.watchPosition(
            { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
            (pos, err) => {
              if (pos) onPosition(pos.coords);
              else if (err) setStatus("unavailable");
            },
          );
        })
        .then((id) => {
          // Stopped while the prompt was open: drop the watch we just started.
          if (watchId.current === "pending") watchId.current = id;
          else void Geolocation.clearWatch({ id });
        })
        .catch((err: Error) => {
          if (watchId.current !== "pending") return;
          watchId.current = null;
          setStatus(err.message === "denied" ? "denied" : "unavailable");
        });
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => onPosition(pos.coords),
      (err) => {
        stop();
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }, [stop, onPosition]);

  // Resume silently if the user granted location on an earlier visit.
  useEffect(() => {
    locationPermission().then((state) => {
      if (state === "granted") start();
      if (state === "denied") setStatus("denied");
    });
    return stop;
  }, [start, stop]);

  return { status, position, start };
}
