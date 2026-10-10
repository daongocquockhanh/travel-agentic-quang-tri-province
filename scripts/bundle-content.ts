/**
 * Bundles content/sites/** into lib/generated/content.json (and the audio
 * tour scripts into tours.json) so the app can
 * serve curated content where there is no filesystem (Cloudflare Workers).
 * Runs automatically before dev, build, test and typecheck.
 *
 * Usage:  bun run content:bundle
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  listSlugsOnDisk,
  readSiteContentFromDisk,
  readTourScriptsFromDisk,
  type SiteContent,
  type SiteTourScripts,
} from "../lib/content-source";

const CONTENT_DIR = join(process.cwd(), "content/sites");
const OUT = join(process.cwd(), "lib/generated/content.json");
const TOURS_OUT = join(process.cwd(), "lib/generated/tours.json");

const bundle: Record<string, SiteContent> = {};
const tours: Record<string, SiteTourScripts> = {};
for (const slug of (await listSlugsOnDisk(CONTENT_DIR)).sort()) {
  bundle[slug] = await readSiteContentFromDisk(CONTENT_DIR, slug);
  tours[slug] = await readTourScriptsFromDisk(CONTENT_DIR, slug);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(bundle));
await writeFile(TOURS_OUT, JSON.stringify(tours));
console.log(`content bundle: ${Object.keys(bundle).length} sites → lib/generated/content.json`);
