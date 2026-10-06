"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (dev reloads would fight the cache). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[sw] registration failed", err));
  }, []);
  return null;
}
