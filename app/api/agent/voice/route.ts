import { hasAiKey, transcribe } from "@/lib/ai/provider";
import { MAX_AUDIO_BYTES, STT_VOCABULARY } from "@/lib/voice/config";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Containers the STT models accept that browsers' MediaRecorder actually produces. */
const EXT_BY_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/**
 * Push-to-talk speech-to-text. Multipart body: `audio` (≤ 2 MB) and `lang`
 * ("vi" | "en"). Returns `{transcript}`; the client then sends it through
 * /api/agent/chat so voice and text share one grounded agent path, and
 * speaks the answer via /api/agent/tts.
 */
export async function POST(request: Request) {
  const limited = await rateLimited("voice", request);
  if (limited) return limited;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return Response.json({ error: "Audio too large", code: "too_large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data", code: "bad_request" }, { status: 400 });
  }

  const audio = form.get("audio");
  const lang = form.get("lang") === "vi" ? "vi" : "en";
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "Missing audio file", code: "bad_request" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Audio too large", code: "too_large" }, { status: 413 });
  }
  const baseType = audio.type.split(";")[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[baseType];
  if (!ext) {
    return Response.json({ error: `Unsupported audio type ${audio.type || "(none)"}`, code: "bad_type" }, { status: 415 });
  }

  if (!hasAiKey()) {
    return Response.json({ error: "Speech-to-text not configured", code: "not_configured" }, { status: 503 });
  }

  try {
    const transcript = await transcribe({
      audio: new Uint8Array(await audio.arrayBuffer()),
      mimeType: baseType,
      ext,
      lang,
      vocabulary: STT_VOCABULARY,
    });
    if (!transcript) {
      return Response.json({ error: "No speech detected", code: "empty" }, { status: 422 });
    }
    return Response.json({ transcript });
  } catch (err) {
    console.error("[agent/voice]", err);
    return Response.json({ error: "Transcription failed", code: "stt_failed" }, { status: 502 });
  }
}
