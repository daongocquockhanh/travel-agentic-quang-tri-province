/**
 * Site photos come from Wikimedia Commons. `Special:FilePath` is Commons'
 * stable redirect from a file name to a resized image, so we store only the
 * file name. Author and licence live on the file page, which every photo
 * links to as its credit.
 */
const COMMONS = "https://commons.wikimedia.org/wiki";

export function commonsImageUrl(file: string, width = 1200): string {
  return `${COMMONS}/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`;
}

export function commonsFilePage(file: string): string {
  return `${COMMONS}/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;
}
