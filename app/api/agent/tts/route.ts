import OpenAI from "openai";
import { z } from "zod";
import { MAX_TTS_CHARS, TTS_VOICES, toSpeakable } from "@/lib/voice/config";
import { getCachedSpeech, setCachedSpeech, ttsCacheKey } from "@/lib/voice/tts-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  text: z.string().min(1).max(MAX_TTS_CHARS * 2),
  lang: z.enum(["vi", "en"]),
  voice: z.enum(TTS_VOICES).default("nova"),
});

/** POST {text, lang, voice?} → audio/mpeg. Cached by hash(model, voice, lang, text). */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = BodySchema.safeParse(await request.json());
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { lang, voice } = parsed.data;
  const text = toSpeakable(parsed.data.text).slice(0, MAX_TTS_CHARS);
  if (!text) return Response.json({ error: "Nothing to speak" }, { status: 400 });

  // No key: tell the client to fall back to the browser's own speech synthesis.
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "TTS not configured", fallback: "browser" }, { status: 503 });
  }

  const model = process.env.OPENAI_TTS_MODEL ?? "tts-1";
  const key = ttsCacheKey({ model, voice, lang, text });
  let audio = getCachedSpeech(key);
  const cacheHit = Boolean(audio);

  if (!audio) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });
      const res = await openai.audio.speech.create({ model, voice, input: text, response_format: "mp3" });
      audio = new Uint8Array(await res.arrayBuffer());
      setCachedSpeech(key, audio);
    } catch (err) {
      console.error("[agent/tts]", err);
      return Response.json({ error: "Speech synthesis failed", fallback: "browser" }, { status: 502 });
    }
  }

  return new Response(audio as BodyInit, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      "Cache-Control": "private, max-age=86400",
      "X-TTS-Cache": cacheHit ? "hit" : "miss",
    },
  });
}
