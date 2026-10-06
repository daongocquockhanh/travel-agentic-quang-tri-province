import type { TrackKey } from "@/lib/tracks";

export interface SampleSite {
  slug: string;
  name_vi: string;
  name_en: string;
  type: "war" | "cultural" | "religious" | "nature" | "food" | "city";
  tracks: TrackKey[];
  lat: number;
  lng: number;
  hero_gradient: string;
  hours: string;
  ticket_price_vnd: number | null;
  distance_from_dong_ha_km: number;
  /** Typical time spent on site, for itinerary timing. */
  visit_min: number;
  /** Reached by boat from another site's pier (Cồn Cỏ from Cửa Việt). */
  boat?: { from: string; minutes: number };
}

/** Ten anchor sites for MVP. Coordinates are approximate and live in `sites.geom` once Supabase is provisioned. */
export const SAMPLE_SITES: SampleSite[] = [
  {
    slug: "vinh-moc",
    name_vi: "Địa đạo Vĩnh Mốc",
    name_en: "Vinh Moc Tunnels",
    type: "war",
    tracks: ["war", "foreign", "domestic"],
    lat: 17.0033,
    lng: 107.0117,
    hero_gradient: "linear-gradient(135deg,#5C6B5A,#1F2428)",
    hours: "7:00–16:30",
    ticket_price_vnd: 50000,
    distance_from_dong_ha_km: 27,
    visit_min: 90,
  },
  {
    slug: "hien-luong",
    name_vi: "Cầu Hiền Lương – Bến Hải",
    name_en: "Hien Luong Bridge & Ben Hai River",
    type: "war",
    tracks: ["war", "foreign", "domestic"],
    lat: 17.0383,
    lng: 107.0728,
    hero_gradient: "linear-gradient(135deg,#F2A73A,#0F4C5C)",
    hours: "Open 24h",
    ticket_price_vnd: null,
    distance_from_dong_ha_km: 22,
    visit_min: 45,
  },
  {
    slug: "khe-sanh",
    name_vi: "Cứ điểm Khe Sanh",
    name_en: "Khe Sanh Combat Base",
    type: "war",
    tracks: ["war", "foreign"],
    lat: 16.6406,
    lng: 106.7314,
    hero_gradient: "linear-gradient(135deg,#8B6F47,#3A2E20)",
    hours: "7:00–17:00",
    ticket_price_vnd: 40000,
    distance_from_dong_ha_km: 64,
    visit_min: 75,
  },
  {
    slug: "truong-son",
    name_vi: "Nghĩa trang liệt sĩ Trường Sơn",
    name_en: "Truong Son National Cemetery",
    type: "war",
    tracks: ["war", "domestic"],
    lat: 16.7833,
    lng: 106.9667,
    hero_gradient: "linear-gradient(135deg,#6B5A4A,#2A2520)",
    hours: "Open 24h",
    ticket_price_vnd: null,
    distance_from_dong_ha_km: 35,
    visit_min: 60,
  },
  {
    slug: "thach-han",
    name_vi: "Sông Thạch Hãn",
    name_en: "Thach Han River",
    type: "nature",
    tracks: ["foreign", "domestic"],
    lat: 16.7548,
    lng: 107.1851,
    hero_gradient: "linear-gradient(135deg,#3F6B3A,#0F4C5C)",
    hours: "Open 24h",
    ticket_price_vnd: null,
    distance_from_dong_ha_km: 6,
    visit_min: 30,
  },
  {
    slug: "la-vang",
    name_vi: "Vương cung thánh đường La Vang",
    name_en: "La Vang Basilica",
    type: "religious",
    tracks: ["foreign", "domestic"],
    lat: 16.7228,
    lng: 107.1956,
    hero_gradient: "linear-gradient(135deg,#E5D5B7,#B89A6E)",
    hours: "5:00–20:00",
    ticket_price_vnd: null,
    distance_from_dong_ha_km: 11,
    visit_min: 60,
  },
  {
    slug: "cua-tung",
    name_vi: "Bãi tắm Cửa Tùng",
    name_en: "Cua Tung Beach",
    type: "nature",
    tracks: ["foreign", "domestic"],
    lat: 17.0167,
    lng: 107.1167,
    hero_gradient: "linear-gradient(135deg,#6FA0AE,#0A3641)",
    hours: "5:00–19:00",
    ticket_price_vnd: 30000,
    distance_from_dong_ha_km: 35,
    visit_min: 120,
  },
  {
    slug: "cua-viet",
    name_vi: "Cảng Cửa Việt",
    name_en: "Cua Viet Port & Beach",
    type: "nature",
    tracks: ["domestic"],
    lat: 16.9,
    lng: 107.1833,
    hero_gradient: "linear-gradient(135deg,#5C7F8A,#0A3641)",
    hours: "5:00–19:00",
    ticket_price_vnd: null,
    distance_from_dong_ha_km: 16,
    visit_min: 60,
  },
  {
    slug: "con-co",
    name_vi: "Đảo Cồn Cỏ",
    name_en: "Con Co Island",
    type: "nature",
    tracks: ["foreign", "domestic"],
    lat: 17.1583,
    lng: 107.3439,
    hero_gradient: "linear-gradient(135deg,#2A7388,#0A3641)",
    hours: "Day tour 6:00–17:00",
    ticket_price_vnd: 250000,
    distance_from_dong_ha_km: 47,
    visit_min: 240,
    boat: { from: "cua-viet", minutes: 90 },
  },
  {
    slug: "dong-ha",
    // Đông Hà was the provincial capital until Quảng Trị merged with Quảng Bình on 1 July 2025.
    name_vi: "Đông Hà",
    name_en: "Dong Ha",
    type: "city",
    tracks: ["foreign", "domestic"],
    lat: 16.8167,
    lng: 107.1,
    hero_gradient: "linear-gradient(135deg,#9A7E5B,#3A2E20)",
    hours: "Always open",
    ticket_price_vnd: null,
    distance_from_dong_ha_km: 0,
    visit_min: 90,
  },
];

/** Map view default — roughly the centroid of the 10 anchor sites. */
export const PROVINCE_CENTER = { lat: 16.85, lng: 107.05 };
export const PROVINCE_ZOOM = 9;
