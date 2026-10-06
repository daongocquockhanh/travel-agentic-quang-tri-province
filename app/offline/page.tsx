import { StatePage } from "@/components/state-page";

/** Served by the service worker when a page isn't cached and the network is down. */
export default function OfflinePage() {
  return (
    <StatePage
      titleVi="Bạn đang ngoại tuyến"
      titleEn="You're offline"
      bodyVi="Trang này chưa được lưu để xem ngoại tuyến. Những trang địa điểm bạn đã mở gần đây và cuộc trò chuyện gần nhất vẫn xem được."
      bodyEn="This page isn't saved for offline use. The site pages you opened recently and your last chat are still available."
    />
  );
}
