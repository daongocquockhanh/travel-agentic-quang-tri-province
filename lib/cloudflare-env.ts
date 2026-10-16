/**
 * Cloudflare bindings (wrangler.jsonc) the app uses on the free plan:
 * D1 for editor feedback and rate-limit bindings for per-IP limits.
 * Outside a Worker (tests, plain Node) there are none, and callers fall back.
 */

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface D1Binding {
  prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } };
}

export interface CloudflareBindings {
  DB: D1Binding;
  RL_CHAT: RateLimitBinding;
  RL_VOICE: RateLimitBinding;
  RL_TTS: RateLimitBinding;
  RL_ROUTE: RateLimitBinding;
  RL_RECOMMEND: RateLimitBinding;
  RL_REPORT: RateLimitBinding;
}

let override: Partial<CloudflareBindings> | null | undefined;

/** Tests: provide fake bindings; `undefined` restores the real lookup. */
export function setCloudflareEnvForTests(
  env: Partial<CloudflareBindings> | null | undefined,
): void {
  override = env;
}

/** The Worker's bindings, or null when not running on Cloudflare. */
export async function cloudflareEnv(): Promise<Partial<CloudflareBindings> | null> {
  if (override !== undefined) return override;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return getCloudflareContext().env as unknown as Partial<CloudflareBindings>;
  } catch {
    return null;
  }
}
