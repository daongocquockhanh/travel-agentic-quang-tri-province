import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_SITES } from "@/lib/sample-sites";
import { PHOTO_CREDITS, isAllowedLicense, photoSource } from "@/lib/photos";

/** Size budgets that keep a site page inside the 3G load target. */
const MAX_KB = { 480: 40, 1200: 150 } as const;
const photos = SAMPLE_SITES.flatMap((s) => (s.photo ? [{ slug: s.slug, file: s.photo.file }] : []));

// Photos are served from our own Cloudflare assets (bun run photos:fetch), with
// the author and licence recorded from Wikimedia Commons.
describe("self-hosted site photos", () => {
  it("has photos to check", () => {
    expect(photos.length).toBeGreaterThan(0);
  });

  it.each(photos)("$slug: credited, freely licensed and within the size budget", ({ file }) => {
    const credit = PHOTO_CREDITS[file];
    expect(credit, `run bun run photos:fetch for "${file}"`).toBeDefined();
    expect(credit.author.trim()).not.toBe("");
    expect(isAllowedLicense(credit.license), credit.license).toBe(true);
    expect(credit.source_url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    for (const w of [480, 1200] as const) {
      const path = join(process.cwd(), "public/photos", `${credit.id}-${w}.webp`);
      const kb = statSync(path).size / 1024;
      expect(kb, `${credit.id}-${w}.webp is ${kb.toFixed(0)} KB`).toBeLessThanOrEqual(MAX_KB[w]);
    }
  });
});

describe("isAllowedLicense", () => {
  it.each([
    "CC0",
    "CC0 1.0",
    "Public domain",
    "CC BY 2.0",
    "CC BY 4.0",
    "CC BY-SA 2.5",
    "CC BY-SA 3.0",
    "Copernicus attribution",
  ])("allows %s", (l) => expect(isAllowedLicense(l)).toBe(true));
  it.each([
    "CC BY-NC 4.0",
    "CC BY-ND 4.0",
    "CC BY-NC-SA 4.0",
    "GFDL",
    "Attribution",
    "All rights reserved",
    "",
  ])("rejects %s", (l) => expect(isAllowedLicense(l)).toBe(false));
});

describe("photoSource", () => {
  it("serves the local rendition that fits, with its credit", () => {
    const { file } = photos[0];
    const credit = PHOTO_CREDITS[file];
    expect(photoSource(file, 400)).toEqual({ src: `/photos/${credit.id}-480.webp`, credit });
    expect(photoSource(file, 900)).toEqual({ src: `/photos/${credit.id}-1200.webp`, credit });
  });

  it("falls back to Commons for a photo that hasn't been fetched", () => {
    expect(photoSource("Not fetched.jpg", 800)).toEqual({
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Not_fetched.jpg?width=800",
      credit: null,
    });
  });
});
