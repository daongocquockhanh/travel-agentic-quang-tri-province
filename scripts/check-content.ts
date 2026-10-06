/**
 * Editorial checks for content/sites.
 *
 * Usage:  bun run content:check            # drafts are warnings
 *         bun run content:check --strict   # drafts are errors (production)
 */
import { join } from "node:path";
import { checkContent } from "../lib/content-check";

const strict = process.argv.includes("--strict");
const report = await checkContent(join(process.cwd(), "content/sites"), { strict });

for (const w of report.warnings) console.warn(`  warn  ${w}`);
for (const e of report.errors) console.error(`  ERROR ${e}`);

const rows = Object.entries(report.status).map(([slug, langs]) => {
  const all = Object.values(langs).flatMap((s) => Object.values(s));
  const reviewed = all.filter((s) => s === "reviewed").length;
  return `  ${slug.padEnd(12)} ${String(reviewed).padStart(2)}/${all.length} sections reviewed`;
});
console.log(`\nReview status:\n${rows.join("\n")}`);
console.log(`\n${report.errors.length} error(s), ${report.warnings.length} warning(s)${strict ? " [strict]" : ""}`);
process.exit(report.errors.length ? 1 : 0);
