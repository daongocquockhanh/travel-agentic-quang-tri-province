import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Only what the app uses: the mic for push-to-talk and location for the geofence.
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=()" },
        ],
      },
      {
        // Browsers must always re-check the worker so updates roll out.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  async rewrites() {
    // Let /design-preview/ and /design-preview/<slug>/ serve their index.html.
    return [
      { source: "/design-preview", destination: "/design-preview/index.html" },
      { source: "/design-preview/:slug", destination: "/design-preview/:slug/index.html" },
    ];
  },
};

export default withNextIntl(nextConfig);

// Lets `next dev` use Cloudflare bindings (getCloudflareContext); no effect on the build.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
