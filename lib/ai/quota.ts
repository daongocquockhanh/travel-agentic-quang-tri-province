/**
 * The Gemini free tier has small request quotas. When one runs out, the API
 * answers 429; instead of failing every question until it resets, the agent
 * pauses model calls and answers from the curated excerpts (offline mode).
 *
 * The pause lives in this Worker isolate's memory: cheap, and good enough,
 * since each isolate that hits the limit learns it on its own first failure.
 */
const DEFAULT_PAUSE_MS = 10 * 60_000;
const MIN_PAUSE_MS = 5_000;
const MAX_PAUSE_MS = 15 * 60_000;

let pausedUntil = 0;

const statusOf = (e: unknown): number | undefined =>
  typeof e === "object" && e !== null ? (e as { statusCode?: number }).statusCode : undefined;

/** True for a quota or rate-limit error, including AI SDK RetryError wrappers. */
export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  if (statusOf(error) === 429) return true;
  const last = (error as { lastError?: unknown }).lastError;
  if (last && statusOf(last) === 429) return true;
  const message =
    error instanceof Error ? error.message : String((error as { message?: string }).message ?? "");
  return /exceeded your current quota|quota exceeded|resource.?exhausted/i.test(message);
}

/** Pause model calls for as long as Google asks ("Please retry in 33.7s"), else ten minutes. */
export function noteQuotaExhausted(error: unknown, now = Date.now()): void {
  const text =
    error instanceof Error
      ? error.message
      : String(
          (error as { message?: string; lastError?: { message?: string } })?.lastError?.message ??
            (error as { message?: string })?.message ??
            "",
        );
  const seconds = Number(/retry in ([\d.]+)\s*s/i.exec(text)?.[1]);
  const asked = seconds > 0 ? Math.ceil(seconds * 1000) : DEFAULT_PAUSE_MS;
  // Bounded either way: an odd retry hint must not switch the model off for hours,
  // nor leave a pause so short every question still hits the exhausted quota.
  pausedUntil = now + Math.min(MAX_PAUSE_MS, Math.max(MIN_PAUSE_MS, asked));
}

export const quotaExhausted = (now = Date.now()) => now < pausedUntil;

export function resetQuota(): void {
  pausedUntil = 0;
}
