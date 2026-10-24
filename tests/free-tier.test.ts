import type { DataStreamWriter } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isQuotaError, noteQuotaExhausted, quotaExhausted, resetQuota } from "@/lib/ai/quota";
import { setCloudflareEnvForTests } from "@/lib/cloudflare-env";
import { checkLimit, resetMemoryLimits } from "@/lib/rate-limit";
import { saveReport } from "@/lib/reports";
import { logContentGap } from "@/lib/agent/retrieval";
import { runAgent } from "@/lib/agent/run";
import type { AgentAnnotation } from "@/lib/agent/types";

const req = (ip: string) => new Request("http://x/api", { headers: { "cf-connecting-ip": ip } });

/** A stand-in for a D1 binding that records every statement it runs. */
function fakeD1() {
  const runs: { sql: string; values: unknown[] }[] = [];
  return {
    runs,
    db: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return { run: async () => void runs.push({ sql, values }) };
          },
        };
      },
    },
  };
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.UPSTASH_REDIS_REST_URL;
  resetMemoryLimits();
  resetQuota();
});
afterEach(() => {
  setCloudflareEnvForTests(undefined);
  process.env.RATE_LIMIT = "off";
});

describe("rate limits on Cloudflare's free binding", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT = "on";
  });

  it("asks the binding for the endpoint, keyed by the caller's IP", async () => {
    const keys: string[] = [];
    setCloudflareEnvForTests({
      RL_CHAT: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success: key !== "203.0.113.66" };
        },
      },
    });
    expect((await checkLimit("chat", req("198.51.100.7"))).success).toBe(true);
    const blocked = await checkLimit("chat", req("203.0.113.66"));
    expect(blocked.success).toBe(false);
    expect(blocked.reset).toBeGreaterThan(Date.now());
    expect(keys).toEqual(["198.51.100.7", "203.0.113.66"]);
  });

  it("falls back to the in-memory window if the binding fails", async () => {
    setCloudflareEnvForTests({
      RL_CHAT: {
        limit: async () => {
          throw new Error("binding unavailable");
        },
      },
    });
    expect((await checkLimit("chat", req("198.51.100.7"))).success).toBe(true);
  });
});

describe("feedback in Cloudflare D1", () => {
  it("stores answer reports", async () => {
    const d1 = fakeD1();
    setCloudflareEnvForTests({ DB: d1.db });
    await saveReport({
      reason: "wrong",
      question: "Q?",
      answer: "A.",
      lang: "en",
      site_slug: "vinh-moc",
    });
    expect(d1.runs).toHaveLength(1);
    expect(d1.runs[0].sql).toMatch(/insert into answer_reports/i);
    expect(d1.runs[0].values).toEqual(["wrong", null, "Q?", "A.", null, "en", "vinh-moc"]);
  });

  it("stores content gaps", async () => {
    const d1 = fakeD1();
    setCloudflareEnvForTests({ DB: d1.db });
    await logContentGap({ query: "Cồn Tiên?", track: "war", lang: "vi", site_slug: null });
    expect(d1.runs[0].sql).toMatch(/insert into content_gaps/i);
    expect(d1.runs[0].values).toEqual(["Cồn Tiên?", "war", "vi", null]);
  });
});

describe("Gemini free quota", () => {
  it("recognises quota errors however they are wrapped", () => {
    expect(isQuotaError({ statusCode: 429 })).toBe(true);
    expect(isQuotaError({ name: "AI_RetryError", lastError: { statusCode: 429 } })).toBe(true);
    expect(isQuotaError(new Error("You exceeded your current quota, please check your plan"))).toBe(
      true,
    );
    expect(isQuotaError(new Error("User location is not supported"))).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });

  it("pauses the model until the retry time Google gives, else ten minutes", () => {
    const now = 1_000_000;
    noteQuotaExhausted(new Error("Quota exceeded. Please retry in 33.7s."), now);
    expect(quotaExhausted(now + 30_000)).toBe(true);
    expect(quotaExhausted(now + 40_000)).toBe(false);
    noteQuotaExhausted({ statusCode: 429 }, now);
    expect(quotaExhausted(now + 9 * 60_000)).toBe(true);
    expect(quotaExhausted(now + 11 * 60_000)).toBe(false);
  });

  it("keeps the pause between 5 seconds and 15 minutes, whatever the error says", () => {
    const now = 1_000_000;
    noteQuotaExhausted(new Error("Quota exceeded. Please retry in 999999s."), now);
    expect(quotaExhausted(now + 15 * 60_000 - 1)).toBe(true);
    expect(quotaExhausted(now + 15 * 60_000 + 1)).toBe(false);
    noteQuotaExhausted(new Error("Quota exceeded. Please retry in 0.01s."), now);
    expect(quotaExhausted(now + 4_000)).toBe(true);
    expect(quotaExhausted(now + 6_000)).toBe(false);
  });

  it("answers from curated excerpts instead of failing while the quota is out", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-test";
    try {
      noteQuotaExhausted({ statusCode: 429 });
      const annotations: AgentAnnotation[] = [];
      let text = "";
      const writer = {
        write(part: string) {
          const m = /^0:(.*)\n$/s.exec(part);
          if (m) text += JSON.parse(m[1]);
        },
        writeMessageAnnotation: (a: unknown) => void annotations.push(a as AgentAnnotation),
        writeData() {},
        writeSource() {},
        merge() {},
      } as unknown as DataStreamWriter;
      await runAgent(
        {
          messages: [{ role: "user", content: "How deep are the tunnels?" }],
          track: "war",
          lang: "en",
          site_slug: "vinh-moc",
        },
        writer,
      );
      expect(annotations.find((a) => a.type === "mode")).toMatchObject({
        offline: true,
        refused: false,
      });
      expect(text).toMatch(/free limit/i);
      expect(annotations.some((a) => a.type === "citation")).toBe(true);
    } finally {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    }
  });
});
