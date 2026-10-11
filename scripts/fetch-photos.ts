/**
 * Copies every catalogue photo (lib/sample-sites.ts `photo.file`) from
 * Wikimedia Commons into public/photos/ as 480 and 1200 px WebP, and records
 * its author and licence in lib/photo-credits.json. The app then serves photos
 * from our own Cloudflare assets instead of hotlinking Commons.
 *
 * Usage:  bun run photos:fetch            (only photos not fetched yet)
 *         bun run photos:fetch --force    (re-fetch everything)
 *
 * Refuses any photo whose licence doesn't allow reuse with attribution
 * (see isAllowedLicense in lib/photos.ts) and exits non-zero.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { SAMPLE_SITES } from "../lib/sample-sites";
import { isAllowedLicense, type PhotoCredit } from "../lib/photos";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "public/photos");
const CREDITS = join(ROOT, "lib/photo-credits.json");
// Wikimedia asks API clients to identify themselves.
const UA =
  "QuangTriTravelAgent/1.0 (https://github.com/daongocquockhanh/travel-agentic-quang-tri-province)";
/** Byte budgets per width; quality steps down until the file fits. */
const BUDGET = { 480: 40 * 1024, 1200: 150 * 1024 } as const;
const force = process.argv.includes("--force");

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    // Signatures often end with a talk-page link: "Name (talk)", "Name (thảo luận)".
    .replace(/\s*\((talk|thảo luận|discussion|disc)\)\s*$/i, "")
    .trim();

/**
 * Copernicus Sentinel imagery is tagged only "Attribution" on Commons; its
 * licence allows free reuse with credit, so name it explicitly, and only when
 * Commons files it under that licence.
 */
function normaliseLicense(short: string, categories: string[]) {
  if (short === "Attribution" && categories.includes("Category:Attribution Copernicus")) {
    return "Copernicus attribution";
  }
  return short;
}

async function commonsInfo(file: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo|categories",
    cllimit: "50",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
    titles: `File:${file}`,
  }).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = (await res.json()) as {
    query: {
      pages: Record<
        string,
        { imageinfo?: Array<Record<string, unknown>>; categories?: Array<{ title: string }> }
      >;
    };
  };
  const page = Object.values(data.query.pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error("not found on Commons");
  const meta = info.extmetadata as Record<string, { value?: string }>;
  return {
    imageUrl: (info.thumburl ?? info.url) as string,
    pageUrl: info.descriptionurl as string,
    author: stripHtml(meta.Artist?.value ?? ""),
    license: normaliseLicense(
      stripHtml(meta.LicenseShortName?.value ?? ""),
      (page.categories ?? []).map((c) => c.title),
    ),
    licenseUrl: meta.LicenseUrl?.value ?? null,
  };
}

async function encode(input: Buffer, width: number, budget: number) {
  for (const quality of [80, 72, 64, 56, 48, 40, 34, 28]) {
    const out = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (out.byteLength <= budget) return out;
  }
  throw new Error(`can't fit ${width}px under ${budget / 1024} KB`);
}

const credits: Record<string, PhotoCredit> = JSON.parse(
  await readFile(CREDITS, "utf8").catch(() => "{}"),
);
await mkdir(OUT_DIR, { recursive: true });
let failed = 0;

for (const site of SAMPLE_SITES) {
  const file = site.photo?.file;
  if (!file) continue;
  if (credits[file] && !force) {
    console.log(`skip ${site.slug} (already fetched)`);
    continue;
  }
  try {
    const info = await commonsInfo(file);
    if (!info.author) throw new Error("no author on the Commons page");
    if (!isAllowedLicense(info.license))
      throw new Error(`licence "${info.license}" is not allowed`);

    const res = await fetch(info.imageUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const original = Buffer.from(await res.arrayBuffer());

    let width = 0;
    let height = 0;
    for (const w of [480, 1200] as const) {
      const out = await encode(original, w, BUDGET[w]);
      await writeFile(join(OUT_DIR, `${site.slug}-${w}.webp`), out);
      if (w === 1200) ({ width = 0, height = 0 } = await sharp(out).metadata());
      console.log(`ok   ${site.slug}-${w}.webp ${(out.byteLength / 1024).toFixed(0)} KB`);
    }
    credits[file] = {
      id: site.slug,
      author: info.author,
      license: info.license,
      license_url: info.licenseUrl,
      source_url: info.pageUrl,
      width,
      height,
    };
    console.log(`     ${info.author} · ${info.license}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${site.slug} (${file}): ${(e as Error).message}`);
  }
}

const sorted = Object.fromEntries(
  Object.entries(credits).sort(([, a], [, b]) => a.id.localeCompare(b.id)),
);
await writeFile(CREDITS, JSON.stringify(sorted, null, 2) + "\n");
if (failed) {
  console.error(`${failed} photo(s) not fetched; they keep loading from Commons.`);
  process.exit(1);
}
