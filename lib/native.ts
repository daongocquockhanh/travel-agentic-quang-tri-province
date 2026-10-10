import { Capacitor } from "@capacitor/core";

/**
 * True inside the iOS / Android app shells (capacitor.config.ts), which
 * inject the Capacitor bridge into the deployed site. False in browsers.
 */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}
