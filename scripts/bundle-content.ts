/**
 * Bundles content/sites/** into lib/generated/content.json so the app can
 * serve curated content where there is no filesystem (Cloudflare Workers).
 * Runs automatically before dev, build, test and typecheck.
 *
 * Usage:  bun run content:bundle
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { listSlugsOnDisk, readSiteContentFromDisk, type SiteContent } from "../lib/content-source";

const CONTENT_DIR = join(process.cwd(), "content/sites");
const OUT = join(process.cwd(), "lib/generated/content.json");

const bundle: Record<string, SiteContent> = {};
for (const slug of (await listSlugsOnDisk(CONTENT_DIR)).sort()) {
  bundle[slug] = await readSiteContentFromDisk(CONTENT_DIR, slug);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(bundle));
console.log(`content bundle: ${Object.keys(bundle).length} sites → lib/generated/content.json`);
