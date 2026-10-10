/** Facts the About, Privacy and Terms pages (and the store listings) share. */
export const APP_INFO = {
  name: "Quảng Trị",
  fullName: { vi: "Quảng Trị — Hướng dẫn viên du lịch", en: "Quảng Trị Travel Guide" },
  /** Shown on the About page; keep in step with the native builds' versionName / MARKETING_VERSION. */
  version: "1.0.0",
  /** Bump when the Privacy or Terms text changes. */
  policiesUpdated: "2026-10-10",
  /**
   * Where travellers (and store reviewers) reach a person. Both stores require
   * one; set NEXT_PUBLIC_SUPPORT_EMAIL in the deploy before submitting.
   */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null,
} as const;
