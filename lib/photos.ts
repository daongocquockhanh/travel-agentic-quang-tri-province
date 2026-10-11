import credits from "@/lib/photo-credits.json";

/**
 * Site photos come from Wikimedia Commons. `bun run photos:fetch` copies each
 * one into public/photos/ (480 and 1200 px WebP) and records its author and
 * licence in lib/photo-credits.json, so the app serves them from our own
 * Cloudflare assets with a proper credit. A photo not fetched yet falls back to
 * Commons' `Special:FilePath` redirect, keyed by the exact file name.
 */
const COMMONS = "https://commons.wikimedia.org/wiki";

export interface PhotoCredit {
  /** Base name of the local files: public/photos/<id>-480.webp and -1200.webp. */
  id: string;
  author: string;
  /** Short licence name as Commons gives it, e.g. "CC BY-SA 4.0". */
  license: string;
  license_url: string | null;
  /** The Commons file page: credit link, and where to check the licence. */
  source_url: string;
  /** Size of the 1200 rendition. */
  width: number;
  height: number;
}

/** Keyed by Commons file name (lib/sample-sites.ts `photo.file`). */
export const PHOTO_CREDITS = credits as Record<string, PhotoCredit>;

/**
 * Licences that allow reuse in a public app with attribution. NC and ND licences
 * don't; GFDL needs its full text shipped alongside, so it is out too.
 */
const LICENSE_RE = /^(CC0( 1\.0)?|Public domain|CC BY(-SA)? [1-4]\.[05]|Copernicus attribution)$/;
export const isAllowedLicense = (license: string) => LICENSE_RE.test(license.trim());

export const LOCAL_WIDTHS = [480, 1200] as const;

export function commonsImageUrl(file: string, width = 1200): string {
  return `${COMMONS}/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`;
}

export function commonsFilePage(file: string): string {
  return `${COMMONS}/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;
}

/** The smallest local rendition that covers `width`, else Commons. */
export function photoSource(
  file: string,
  width = 1200,
): { src: string; credit: PhotoCredit | null } {
  const credit = PHOTO_CREDITS[file] ?? null;
  if (!credit) return { src: commonsImageUrl(file, width), credit: null };
  const w = LOCAL_WIDTHS.find((size) => size >= width) ?? LOCAL_WIDTHS[LOCAL_WIDTHS.length - 1];
  return { src: `/photos/${credit.id}-${w}.webp`, credit };
}
