import "server-only";
import { createHash } from "node:crypto";

/**
 * In-process LRU for synthesised speech, keyed by hash(model, voice, lang, text)
 * per SYSTEM_DESIGN §8.3, so replaying an answer or a popular arrival story
 * costs nothing. Per-instance only; a shared Storage-backed cache can sit
 * behind the same interface later.
 */
const MAX_BYTES = 32 * 1024 * 1024;
const entries = new Map<string, Uint8Array>();
let totalBytes = 0;

export function ttsCacheKey(parts: { model: string; voice: string; lang: string; text: string }): string {
  return createHash("sha256")
    .update(`${parts.model}\u0000${parts.voice}\u0000${parts.lang}\u0000${parts.text}`)
    .digest("hex");
}

export function getCachedSpeech(key: string): Uint8Array | undefined {
  const hit = entries.get(key);
  if (hit) {
    // refresh recency
    entries.delete(key);
    entries.set(key, hit);
  }
  return hit;
}

export function setCachedSpeech(key: string, audio: Uint8Array): void {
  if (audio.byteLength > MAX_BYTES) return;
  const prev = entries.get(key);
  if (prev) {
    totalBytes -= prev.byteLength;
    entries.delete(key);
  }
  entries.set(key, audio);
  totalBytes += audio.byteLength;
  for (const [k, v] of entries) {
    if (totalBytes <= MAX_BYTES) break;
    entries.delete(k);
    totalBytes -= v.byteLength;
  }
}

/** Test helper. */
export function clearSpeechCache(): void {
  entries.clear();
  totalBytes = 0;
}
