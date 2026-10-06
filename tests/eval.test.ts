import { beforeAll, describe, expect, it } from "vitest";
import { GOLDEN } from "@/lib/eval/golden";
import { runEval, vietnameseRatio, type CaseResult } from "@/lib/eval/runner";

/**
 * The full golden set (30 prompts × 3 tracks × 2 languages) in offline mode:
 * deterministic retrieval, grounding and refusal logic. Every case must pass,
 * so a change that weakens grounding fails CI. The live-model run is
 * `bun run eval` with OPENAI_API_KEY set (nightly workflow).
 */
describe("agent eval (offline)", () => {
  let results: CaseResult[] = [];

  beforeAll(async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.CONTENT_REQUIRE_REVIEWED;
    results = await runEval();
  }, 120_000);

  it("covers 30 prompts × 3 tracks × 2 languages", () => {
    expect(GOLDEN).toHaveLength(30);
    expect(results).toHaveLength(180);
  });

  it("passes every case", () => {
    const failed = results.filter((r) => !r.pass).map((r) => `${r.id}/${r.track}/${r.lang}: ${r.failures.join("; ")}`);
    expect(failed).toEqual([]);
  });

  it("never cites a site outside the expected set", () => {
    for (const c of GOLDEN.filter((g) => g.sites)) {
      for (const r of results.filter((x) => x.id === c.id)) {
        expect(r.cited_sites.every((s) => c.sites!.includes(s)), `${r.id}/${r.track}/${r.lang}`).toBe(true);
      }
    }
  });
});

describe("eval helpers", () => {
  it("tells Vietnamese prose from English", () => {
    expect(vietnameseRatio("Địa đạo Vĩnh Mốc là một làng ngầm dưới lòng đất.")).toBeGreaterThan(0.2);
    expect(
      vietnameseRatio(
        "Đông Hà is a good place to eat your way through local cooking. Look for cháo bột, a thick rice-noodle soup, and soft rice paper rolled with grilled pork and herbs.",
      ),
    ).toBeLessThan(0.12);
  });
});
