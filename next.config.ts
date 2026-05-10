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
  async rewrites() {
    // Let /design-preview/ and /design-preview/<slug>/ serve their index.html.
    return [
      { source: "/design-preview", destination: "/design-preview/index.html" },
      { source: "/design-preview/:slug", destination: "/design-preview/:slug/index.html" },
    ];
  },
};

export default withNextIntl(nextConfig);
