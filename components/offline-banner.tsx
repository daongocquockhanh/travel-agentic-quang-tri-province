"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Thin, calm banner while the device is offline (SYSTEM_DESIGN §8.1). */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-ink px-4 py-1.5 text-center text-[12px] font-medium text-paper"
      style={{ paddingTop: "max(6px, env(safe-area-inset-top))" }}
    >
      Ngoại tuyến — đang hiển thị nội dung đã lưu · Offline — showing saved content
    </div>
  );
}
