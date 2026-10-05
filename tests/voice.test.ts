import { beforeEach, describe, expect, it, vi } from "vitest";
import { SentenceBuffer } from "@/lib/voice/sentences";
import { MAX_AUDIO_BYTES, defaultVoice, toSpeakable } from "@/lib/voice/config";
import { clearSpeechCache, getCachedSpeech, setCachedSpeech, ttsCacheKey } from "@/lib/voice/tts-cache";

const mocks = vi.hoisted(() => ({
  speech: vi.fn(),
  transcribe: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    audio = {
      speech: { create: mocks.speech },
      transcriptions: { create: mocks.transcribe },
    };
  },
}));

const { POST: ttsPOST } = await import("@/app/api/agent/tts/route");
const { POST: voicePOST } = await import("@/app/api/agent/voice/route");

beforeEach(() => {
  mocks.speech.mockReset();
  mocks.transcribe.mockReset();
  clearSpeechCache();
  process.env.OPENAI_API_KEY = "sk-test";
});

describe("SentenceBuffer", () => {
  it("emits complete sentences as text streams in, and the remainder on flush", () => {
    const buf = new SentenceBuffer(20);
    expect(buf.push("The tunnels were dug")).toEqual([]);
    expect(buf.push("The tunnels were dug by hand in 1965. Seventeen chil")).toEqual([
      "The tunnels were dug by hand in 1965.",
    ]);
    expect(buf.push("The tunnels were dug by hand in 1965. Seventeen children were born there. [1] Vis")).toEqual([
      "Seventeen children were born there. [1]",
    ]);
    expect(buf.flush("The tunnels were dug by hand in 1965. Seventeen children were born there. [1] Visit early.")).toEqual([
      "Visit early.",
    ]);
  });

  it("merges short sentences to save TTS requests", () => {
    const buf = new SentenceBuffer(30);
    expect(buf.push("Yes. It opens at 7. Tickets are 50,000 VND. ")).toEqual([
      "Yes. It opens at 7. Tickets are 50,000 VND.",
    ]);
  });

  it("splits Vietnamese and at paragraph breaks", () => {
    const buf = new SentenceBuffer(200);
    expect(buf.push("Địa đạo sâu 23 mét.\n\nCó 17 em bé")).toEqual(["Địa đạo sâu 23 mét."]);
  });

  it("does not split decimals", () => {
    const buf = new SentenceBuffer(5);
    expect(buf.push("It is 2.5 km away")).toEqual([]);
  });
});

describe("toSpeakable / defaultVoice", () => {
  it("drops citation markers and markdown", () => {
    expect(toSpeakable("**Seventeen** children were born [1]. Visit early [2].")).toBe(
      "Seventeen children were born. Visit early.",
    );
  });
  it("uses a solemn voice for the war track", () => {
    expect(defaultVoice("war")).toBe("onyx");
    expect(defaultVoice("foreign")).toBe("nova");
  });
});

describe("tts cache", () => {
  it("keys on every input and evicts nothing small", () => {
    const a = ttsCacheKey({ model: "tts-1", voice: "nova", lang: "en", text: "hi" });
    const b = ttsCacheKey({ model: "tts-1", voice: "onyx", lang: "en", text: "hi" });
    expect(a).not.toBe(b);
    setCachedSpeech(a, new Uint8Array([1, 2, 3]));
    expect(getCachedSpeech(a)).toEqual(new Uint8Array([1, 2, 3]));
    expect(getCachedSpeech(b)).toBeUndefined();
  });
});

const ttsReq = (body: unknown) =>
  new Request("http://x/api/agent/tts", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/agent/tts", () => {
  it("synthesises once and serves repeats from cache", async () => {
    mocks.speech.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer });
    const body = { text: "Seventeen children were born [1].", lang: "en", voice: "onyx" };

    const first = await ttsPOST(ttsReq(body));
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("audio/mpeg");
    expect(first.headers.get("x-tts-cache")).toBe("miss");
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(new Uint8Array([9, 9, 9]));
    expect(mocks.speech).toHaveBeenCalledWith(
      expect.objectContaining({ input: "Seventeen children were born.", voice: "onyx" }),
    );

    const second = await ttsPOST(ttsReq(body));
    expect(second.headers.get("x-tts-cache")).toBe("hit");
    expect(mocks.speech).toHaveBeenCalledTimes(1);
  });

  it("asks the client to use browser speech when no key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await ttsPOST(ttsReq({ text: "hello", lang: "en" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ fallback: "browser" });
  });

  it("rejects unknown voices and empty text", async () => {
    expect((await ttsPOST(ttsReq({ text: "hi", lang: "en", voice: "darth" }))).status).toBe(400);
    expect((await ttsPOST(ttsReq({ text: " [1] ", lang: "en" }))).status).toBe(400);
  });

  it("returns 502 with a browser fallback when OpenAI fails", async () => {
    mocks.speech.mockRejectedValue(new Error("boom"));
    const res = await ttsPOST(ttsReq({ text: "hello", lang: "vi" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ fallback: "browser" });
  });
});

function voiceReq(file: File | null, lang = "vi") {
  const form = new FormData();
  if (file) form.append("audio", file);
  form.append("lang", lang);
  return new Request("http://x/api/agent/voice", { method: "POST", body: form });
}

describe("POST /api/agent/voice", () => {
  const clip = () => new File([new Uint8Array(2000)], "speech.webm", { type: "audio/webm;codecs=opus" });

  it("transcribes with the language hint and place-name vocabulary", async () => {
    mocks.transcribe.mockResolvedValue({ text: "  Địa đạo Vĩnh Mốc sâu bao nhiêu?  " });
    const res = await voicePOST(voiceReq(clip()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ transcript: "Địa đạo Vĩnh Mốc sâu bao nhiêu?" });
    const args = mocks.transcribe.mock.calls[0][0];
    expect(args.language).toBe("vi");
    expect(args.prompt).toContain("Vĩnh Mốc");
    expect(args.file.name).toBe("speech.webm");
  });

  it("names Safari's mp4 recordings so Whisper can decode them", async () => {
    mocks.transcribe.mockResolvedValue({ text: "hello" });
    await voicePOST(voiceReq(new File([new Uint8Array(10)], "blob", { type: "audio/mp4" }), "en"));
    expect(mocks.transcribe.mock.calls[0][0].file.name).toBe("speech.mp4");
  });

  it("returns 422 when nothing was said", async () => {
    mocks.transcribe.mockResolvedValue({ text: "   " });
    const res = await voicePOST(voiceReq(clip()));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "empty" });
  });

  it("validates input before calling OpenAI", async () => {
    expect((await voicePOST(voiceReq(null))).status).toBe(400);
    expect((await voicePOST(voiceReq(new File(["x"], "a.txt", { type: "text/plain" })))).status).toBe(415);
    const big = new File([new Uint8Array(MAX_AUDIO_BYTES + 1)], "a.webm", { type: "audio/webm" });
    expect((await voicePOST(voiceReq(big))).status).toBe(413);
    expect(mocks.transcribe).not.toHaveBeenCalled();
  });

  it("reports not_configured without a key", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await voicePOST(voiceReq(clip()));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "not_configured" });
  });

  it("reports stt_failed when Whisper errors", async () => {
    mocks.transcribe.mockRejectedValue(new Error("boom"));
    const res = await voicePOST(voiceReq(clip()));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "stt_failed" });
  });
});
