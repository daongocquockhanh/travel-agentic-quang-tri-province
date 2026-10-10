import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS / Android shells (docs/STORE_RELEASE.md).
 *
 * The app needs its server (chat, voice and TTS run as API routes), so the
 * shells load the deployed site instead of a static export. `mobile/www`
 * only holds the screen shown when that site can't be reached.
 *
 * CAP_SERVER_URL points a build at another deploy (e.g. a preview) — run
 * `CAP_SERVER_URL=https://… bunx cap sync` before building.
 */
const serverUrl =
  process.env.CAP_SERVER_URL ?? "https://quang-tri-travel-agent.dnqkhanhhcmiu.workers.dev";

const config: CapacitorConfig = {
  // Permanent once published to either store; change it before the first upload if needed.
  appId: "com.quangtri.travelguide",
  appName: "Quảng Trị",
  webDir: "mobile/www",
  // Lets the site (and analytics) tell the native shell apart from a browser.
  appendUserAgent: "QuangTriApp",
  backgroundColor: "#F7F4EE",
  server: {
    url: serverUrl,
    allowNavigation: [new URL(serverUrl).host],
    errorPath: "offline.html",
  },
  ios: {
    // The page handles the notch itself with env(safe-area-inset-*).
    contentInset: "never",
    scheme: "Quảng Trị",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#F7F4EE",
      showSpinner: false,
    },
    // Edge-to-edge on Android too; the page pads itself with env(safe-area-inset-*).
    SystemBars: {
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
      // Dark icons: the app is always on its light paper background.
      style: "LIGHT",
    },
  },
};

export default config;
