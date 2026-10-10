/**
 * Captures store screenshots in both languages at the sizes the stores ask for.
 *
 *   bun run store:screenshots                       # against http://localhost:3000
 *   bun run store:screenshots https://…workers.dev  # against a deploy (real photos, live map)
 *
 * Output: store/screenshots/<ios|android>/<vi|en>/NN-name.png (git-ignored).
 * Set CHROMIUM_PATH to use an installed Chromium instead of Playwright's.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const DEVICES = {
  // App Store 6.9" iPhone: 1320 × 2868.
  ios: { width: 440, height: 956, scale: 3 },
  // Google Play phone: 1080 × 1920 (9:16; Play rejects anything taller than 2:1).
  android: { width: 360, height: 640, scale: 3 },
} as const;

const SHOTS = [
  { name: "01-welcome", path: "/" },
  { name: "02-map", path: "/map?track=foreign" },
  { name: "03-site", path: "/site/vinh-moc" },
  { name: "04-guide", path: "/chat?site=vinh-moc" },
  { name: "05-history", path: "/site/hien-luong" },
];

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const [device, d] of Object.entries(DEVICES)) {
    for (const lang of ["vi", "en"] as const) {
      const ctx = await browser.newContext({
        viewport: { width: d.width, height: d.height },
        deviceScaleFactor: d.scale,
        isMobile: true,
        hasTouch: true,
        locale: lang === "vi" ? "vi-VN" : "en-US",
      });
      await ctx.addCookies([{ name: "NEXT_LOCALE", value: lang, url: BASE }]);
      const page = await ctx.newPage();
      const dir = join("store/screenshots", device, lang);
      mkdirSync(dir, { recursive: true });
      for (const shot of SHOTS) {
        await page.goto(BASE + shot.path, { waitUntil: "networkidle", timeout: 60_000 });
        await page.waitForTimeout(800); // map fly-in, photo fade
        await page.screenshot({ path: join(dir, `${shot.name}.png`) });
        console.log(`${device}/${lang}/${shot.name}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
