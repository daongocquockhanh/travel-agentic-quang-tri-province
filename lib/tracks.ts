export const TRACKS = ["war", "foreign", "domestic"] as const;
export type TrackKey = (typeof TRACKS)[number];

export const TRACK_COLOR: Record<TrackKey, string> = {
  war: "#B07A2A",
  foreign: "#0F4C5C",
  domestic: "#3F6B3A",
};

export const TRACK_LABEL_EN: Record<TrackKey, string> = {
  war: "War history",
  foreign: "Foreign tourist",
  domestic: "Domestic traveller",
};

export const TRACK_LABEL_VI: Record<TrackKey, string> = {
  war: "Lịch sử chiến tranh",
  foreign: "Khách quốc tế",
  domestic: "Khách trong nước",
};

export const TRACK_HEADLINE: Record<TrackKey, { en: string; vi: string }> = {
  war: {
    en: "Walk the DMZ. Solemn, with sources.",
    vi: "Đi qua vĩ tuyến 17. Trang nghiêm, có dẫn nguồn.",
  },
  foreign: {
    en: "One day, three places worth slowing down for.",
    vi: "Một ngày, ba điểm đáng dừng chân.",
  },
  domestic: {
    en: "Logistics, giờ mở cửa, bãi tắm vắng.",
    vi: "Lộ trình, giờ mở cửa, bãi tắm vắng người.",
  },
};

export const TRACK_SUPPORT: Record<TrackKey, string> = {
  war: "Vĩnh Mốc · Hiền Lương · Khe Sanh · Trường Sơn",
  foreign: "Bilingual VI/EN · curated overview",
  domestic: "Tiếng Việt · gia đình · đường ven biển",
};

export const TRACK_STORAGE_KEY = "qt.track";

export function isTrackKey(value: unknown): value is TrackKey {
  return typeof value === "string" && (TRACKS as readonly string[]).includes(value);
}
