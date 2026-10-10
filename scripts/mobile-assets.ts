/**
 * Regenerates the native app icons and splash screens from the PWA icons,
 * so the store apps match the installed web app. Run after `cap add` or
 * when the icon changes: `bun run mobile:assets`.
 *
 * Source: public/icon-maskable-512.png (full-bleed, artwork in the safe zone).
 * Replace it with a 1024px master for the sharpest App Store icon.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SOURCE = "public/icon-maskable-512.png";
const ROUNDED = "public/icon-512.png";
const PAPER = "#F7F4EE";
const BRAND = "#0F4C5C";

const RES = "android/app/src/main/res";
const IOS = "ios/App/App/Assets.xcassets";

async function size(file: string) {
  const m = await sharp(file).metadata();
  return { w: m.width ?? 0, h: m.height ?? 0 };
}

/** Square full-bleed icon (App Store, legacy Android, adaptive foreground). */
async function square(px: number, out: string) {
  await sharp(SOURCE)
    .resize(px, px, { kernel: "lanczos3" })
    .flatten({ background: BRAND })
    .png()
    .toFile(out);
}

/** Round legacy launcher icon. */
async function round(px: number, out: string) {
  const mask = Buffer.from(
    `<svg width="${px}" height="${px}"><circle cx="${px / 2}" cy="${px / 2}" r="${px / 2}"/></svg>`,
  );
  await sharp(SOURCE)
    .resize(px, px, { kernel: "lanczos3" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(out);
}

/** Paper background with the rounded icon centred. */
async function splash(w: number, h: number, out: string) {
  const icon = Math.round(Math.min(w, h) * 0.22);
  const art = await sharp(ROUNDED).resize(icon, icon, { kernel: "lanczos3" }).toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: PAPER } })
    .composite([{ input: art, gravity: "centre" }])
    .png()
    .toFile(out);
}

async function main() {
  // iOS: single 1024px icon (no alpha — App Store rejects transparency).
  await square(1024, join(IOS, "AppIcon.appiconset/AppIcon-512@2x.png"));
  for (const f of readdirSync(join(IOS, "Splash.imageset")).filter((f) => f.endsWith(".png"))) {
    const p = join(IOS, "Splash.imageset", f);
    const { w, h } = await size(p);
    await splash(w, h, p);
  }

  // Android: overwrite every generated PNG at its existing size.
  for (const dir of readdirSync(RES)) {
    const full = join(RES, dir);
    if (!statSync(full).isDirectory()) continue;
    for (const f of readdirSync(full).filter((f) => f.endsWith(".png"))) {
      const p = join(full, f);
      const { w, h } = await size(p);
      if (f === "splash.png") await splash(w, h, p);
      else if (f === "ic_launcher_round.png") await round(w, p);
      else await square(w, p); // ic_launcher.png, ic_launcher_foreground.png
    }
  }
  console.log("mobile assets regenerated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
