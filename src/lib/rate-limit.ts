// Lightweight, fail-open rate limiting for public form endpoints.
//
// Backed by Cloudflare's native rate limiting binding when present. In local
// dev (`astro dev`) and any environment where the binding is not configured,
// this is a no-op: Turnstile and the Cloudflare WAF remain the primary defenses,
// so a missing or failing limiter must never block a legitimate submission.

export type RateLimiter = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

/**
 * Check a request against one or more rate-limit keys (e.g. by IP and by email).
 *
 * @returns `true` if the request is allowed, `false` if any key is over its
 *   limit. Fails open (returns `true`) when no limiter is bound or it throws.
 */
export async function checkRateLimit(
  limiter: RateLimiter | undefined,
  keys: string[]
): Promise<boolean> {
  if (!limiter?.limit) return true;
  for (const key of keys) {
    try {
      const { success } = await limiter.limit({ key });
      if (!success) return false;
    } catch {
      // Never block a real user because the limiter is unavailable.
      return true;
    }
  }
  return true;
}
