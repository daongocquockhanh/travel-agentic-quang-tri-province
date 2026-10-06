"use client";

import { useEffect } from "react";
import { StatePage } from "@/components/state-page";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatePage
      titleVi="Đã có lỗi xảy ra"
      titleEn="Something went wrong"
      bodyVi="Trang này chưa tải được. Bạn có thể thử lại hoặc quay về bản đồ."
      bodyEn="This page didn't load. You can try again or go back to the map."
    >
      <button type="button" onClick={reset} className="rounded-full bg-primary px-4 py-2 text-[14px] font-medium text-paper">
        Thử lại · Try again
      </button>
    </StatePage>
  );
}
