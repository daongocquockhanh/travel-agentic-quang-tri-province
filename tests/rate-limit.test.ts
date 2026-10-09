import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIMITS, checkLimit, clientIp, rateLimited, resetMemoryLimits } from "@/lib/rate-limit";

const req = (ip: string) =>
  new Request("http://x/api", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

beforeEach(() => {
  process.env.RATE_LIMIT = "on";
  delete process.env.UPSTASH_REDIS_REST_URL;
  resetMemoryLimits();
});
afterEach(() => {
  process.env.RATE_LIMIT = "off";
});

describe("rate limits (in-memory)", () => {
  it("uses the first forwarded IP", () => {
    expect(clientIp(req("203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });

  it("trusts Cloudflare's connecting IP over a client-supplied X-Forwarded-For", () => {
    // Behind Cloudflare the client controls the first X-Forwarded-For entry,
    // so rotating it would dodge every limit.
    const spoofed = new Request("http://x/api", {
      headers: { "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4, 198.51.100.7" },
    });
    expect(clientIp(spoofed)).toBe("198.51.100.7");
  });

  it("allows the voice budget, then returns 429 with Retry-After", async () => {
    for (let i = 0; i < LIMITS.voice.requests; i++)
      expect(await rateLimited("voice", req("1.1.1.1"))).toBeNull();
    const blocked = await rateLimited("voice", req("1.1.1.1"));
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await blocked?.json()).toMatchObject({ code: "rate_limited" });
  });

  it("counts each IP and each endpoint separately", async () => {
    for (let i = 0; i < LIMITS.voice.requests; i++) await rateLimited("voice", req("2.2.2.2"));
    expect(await rateLimited("voice", req("3.3.3.3"))).toBeNull();
    expect(await rateLimited("chat", req("2.2.2.2"))).toBeNull();
  });

  it("frees slots as the window slides", async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LIMITS.tts.requests; i++) await checkLimit("tts", req("4.4.4.4"), t0);
    expect((await checkLimit("tts", req("4.4.4.4"), t0 + 1000)).success).toBe(false);
    expect(
      (await checkLimit("tts", req("4.4.4.4"), t0 + LIMITS.tts.windowSec * 1000 + 1)).success,
    ).toBe(true);
  });

  it("protects the real chat route", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const body = JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
      track: "foreign",
      lang: "en",
    });
    let last: Response | undefined;
    for (let i = 0; i <= LIMITS.chat.requests; i++) {
      last = await POST(
        new Request("http://x/api/agent/chat", {
          method: "POST",
          body,
          headers: req("5.5.5.5").headers,
        }),
      );
    }
    expect(last?.status).toBe(429);
  });
});
