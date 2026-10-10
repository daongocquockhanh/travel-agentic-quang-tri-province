export const TRACKS = ["war", "foreign", "domestic"] as const;
export type TrackKey = (typeof TRACKS)[number];

export const TRACK_COLOR: Record<TrackKey, string> = {
  war: "#B07A2A",
  foreign: "#0F4C5C",
  domestic: "#3F6B3A",
};

export const TRACK_LABEL_EN: Record<TrackKey, string> = {
  war: "War history",
  foreign: "First visit",
  domestic: "Family trip",
};

export const TRACK_LABEL_VI: Record<TrackKey, string> = {
  war: "Lịch sử chiến tranh",
  foreign: "Lần đầu đến",
  domestic: "Du lịch gia đình",
};

/** What choosing a mode actually changes, in plain words (shown on the picker and the mode menu). */
export const TRACK_DESCRIPTION: Record<TrackKey, { en: string; vi: string }> = {
  war: {
    en: "For veterans, families and history lovers. A solemn guide, and every answer about the war cites its source.",
    vi: "Dành cho cựu chiến binh, thân nhân và người yêu lịch sử. Giọng kể trang nghiêm, mọi câu trả lời về chiến tranh đều có dẫn nguồn.",
  },
  foreign: {
    en: "New to Quảng Trị? The essentials in a day or two: what to see, why it matters, how long it takes.",
    vi: "Lần đầu đến Quảng Trị? Những điểm chính trong một, hai ngày: xem gì, vì sao đáng đến, mất bao lâu.",
  },
  domestic: {
    en: "Travelling with family? Straight to opening hours, tickets, beaches, food and driving times.",
    vi: "Đi cùng gia đình? Đi thẳng vào giờ mở cửa, giá vé, bãi biển, ăn uống và thời gian lái xe.",
  },
};

/** The site whose photo represents each mode on the picker. */
export const TRACK_PHOTO_SITE: Record<TrackKey, string> = {
  war: "vinh-moc",
  foreign: "hien-luong",
  domestic: "cua-viet",
};

export const SITE_TYPE_LABEL: Record<string, { en: string; vi: string }> = {
  war: { en: "War history", vi: "Di tích chiến tranh" },
  religious: { en: "Pilgrimage", vi: "Hành hương" },
  cultural: { en: "Culture", vi: "Văn hóa" },
  nature: { en: "Nature & sea", vi: "Thiên nhiên & biển" },
  food: { en: "Food", vi: "Ẩm thực" },
  city: { en: "Town", vi: "Đô thị" },
};

export const TRACK_STORAGE_KEY = "qt.track";

export function isTrackKey(value: unknown): value is TrackKey {
  return typeof value === "string" && (TRACKS as readonly string[]).includes(value);
}
