import type { TrackKey } from "@/lib/tracks";

/** Input caps from SYSTEM_DESIGN §8.2. */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_RECORDING_MS = 30_000;
/** Shorter than this is almost always an accidental tap. */
export const MIN_RECORDING_MS = 400;
/** OpenAI TTS accepts up to 4096 characters per request. */
export const MAX_TTS_CHARS = 4000;

export const TTS_VOICES = ["onyx", "nova", "alloy", "echo", "fable", "shimmer"] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];

/** Solemn, lower voice for the war track; a warmer one elsewhere. */
export function defaultVoice(track: TrackKey): TtsVoice {
  return track === "war" ? "onyx" : "nova";
}

/**
 * Place names Whisper tends to mangle. Passed as the transcription prompt so
 * "Vĩnh Mốc" doesn't come back as "Vin Mock".
 */
export const STT_VOCABULARY =
  "Quảng Trị, Vĩnh Mốc, Hiền Lương, Bến Hải, Khe Sanh, Trường Sơn, Thạch Hãn, La Vang, Cửa Tùng, Cửa Việt, Cồn Cỏ, Đông Hà, Vĩnh Linh, Thành cổ Quảng Trị.";

/** Text cleaned up for speech: drop citation markers and markdown symbols. */
export function toSpeakable(text: string): string {
  return text
    .replace(/\s*\[\d+\]/g, "")
    .replace(/[*_#`>]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
