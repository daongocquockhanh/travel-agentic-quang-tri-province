/**
 * Agent eval: 30 golden prompts × 3 tracks × 2 languages (SYSTEM_DESIGN §9).
 *
 * Usage:
 *   bun run eval                          # all 180 cases
 *   bun run eval --only hl-flag,my-lai    # some prompts
 *   bun run eval --tracks war --langs vi
 *   bun run eval --min-pass 0.95 --out eval-results.json
 *
 * Without OPENAI_API_KEY the agent runs offline (deterministic retrieval and
 * refusal logic) and every case must pass. With a key it evaluates the real
 * model; --min-pass sets the gate (default 0.95).
 */
import { writeFileSync } from "node:fs";
import { GOLDEN } from "../lib/eval/golden";
import { runEval, type CaseResult } from "../lib/eval/runner";
import type { TrackKey } from "../lib/tracks";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const list = (v?: string) => v?.split(",").map((s) => s.trim()).filter(Boolean);

const live = Boolean(process.env.OPENAI_API_KEY);
const only = list(arg("only"));
const cases = only ? GOLDEN.filter((c) => only.includes(c.id)) : GOLDEN;
const tracks = (list(arg("tracks")) as TrackKey[] | undefined) ?? ["war", "foreign", "domestic"];
const langs = (list(arg("langs")) as ("vi" | "en")[] | undefined) ?? ["en", "vi"];
const minPass = Number(arg("min-pass") ?? (live ? 0.95 : 1));

console.log(`Agent eval · ${live ? "LIVE model" : "offline"} · ${cases.length} prompts × ${tracks.length} tracks × ${langs.length} langs\n`);

const results = await runEval({
  cases,
  tracks,
  langs,
  onResult: (r) => {
    const mark = r.pass ? "✓" : "✗";
    console.log(`${mark} ${r.id.padEnd(16)} ${r.track.padEnd(9)} ${r.lang}  ${String(r.ms).padStart(5)} ms${r.pass ? "" : "  " + r.failures.join("; ")}`);
  },
});

const passed = results.filter((r) => r.pass).length;
const rate = passed / results.length;
const by = (key: (r: CaseResult) => string) => {
  const groups = new Map<string, CaseResult[]>();
  for (const r of results) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  return [...groups].map(([k, rs]) => `  ${k.padEnd(10)} ${rs.filter((r) => r.pass).length}/${rs.length}`).join("\n");
};
const expectOf = new Map(GOLDEN.map((c) => [c.id, c.expect]));

console.log(`\nBy track:\n${by((r) => r.track)}`);
console.log(`By language:\n${by((r) => r.lang)}`);
console.log(`By expectation:\n${by((r) => expectOf.get(r.id)!)}`);
console.log(`\n${passed}/${results.length} passed (${(rate * 100).toFixed(1)}%), gate ${(minPass * 100).toFixed(0)}%`);

const out = arg("out");
if (out) writeFileSync(out, JSON.stringify({ live, rate, results }, null, 2));
process.exit(rate >= minPass ? 0 : 1);
