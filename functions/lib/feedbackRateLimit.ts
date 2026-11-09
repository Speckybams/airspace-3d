/**
 * Anonymous feedback limits (per IP). Tuned for a low-volume product form:
 * - 1 min gap stops rapid-fire and scripted bursts.
 * - 5 / hour lets someone revise a message without opening a new path for abuse.
 * - 15 / day caps scripted abuse while rarely hitting a real user.
 */
export const FEEDBACK_RATE_LIMIT = {
  minGapMs: 60_000,
  perHour: 5,
  perDay: 15,
  hourMs: 60 * 60 * 1000,
  dayMs: 24 * 60 * 60 * 1000,
} as const;

export type FeedbackRateState = { times: number[] };

export function pruneFeedbackTimes(times: number[], now: number): number[] {
  const cutoff = now - FEEDBACK_RATE_LIMIT.dayMs;
  return times.filter((t) => t > cutoff);
}

/** Pure check for tests; does not mutate the input array. */
export function feedbackRateStatus(
  times: number[],
  now: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const recent = pruneFeedbackTimes(times, now);
  const last = recent[recent.length - 1];
  if (last !== undefined && now - last < FEEDBACK_RATE_LIMIT.minGapMs) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((FEEDBACK_RATE_LIMIT.minGapMs - (now - last)) / 1000),
    };
  }
  const hourCutoff = now - FEEDBACK_RATE_LIMIT.hourMs;
  const hourCount = recent.filter((t) => t > hourCutoff).length;
  if (hourCount >= FEEDBACK_RATE_LIMIT.perHour) {
    const oldestInHour = recent.find((t) => t > hourCutoff);
    const retryAfterMs = oldestInHour
      ? oldestInHour + FEEDBACK_RATE_LIMIT.hourMs - now
      : FEEDBACK_RATE_LIMIT.hourMs;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  if (recent.length >= FEEDBACK_RATE_LIMIT.perDay) {
    const oldest = recent[0];
    const retryAfterMs = oldest ? oldest + FEEDBACK_RATE_LIMIT.dayMs - now : FEEDBACK_RATE_LIMIT.dayMs;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  return { ok: true };
}

function stateUrl(ip: string): string {
  return `https://voluspace.internal/rate/feedback/${encodeURIComponent(ip)}`;
}

const devBuckets = new Map<string, FeedbackRateState>();

async function loadState(ip: string, cache?: Cache): Promise<FeedbackRateState> {
  if (!cache) {
    return devBuckets.get(ip) ?? { times: [] };
  }
  const hit = await cache.match(stateUrl(ip));
  if (!hit) return { times: [] };
  try {
    const data = (await hit.json()) as FeedbackRateState;
    return Array.isArray(data.times) ? { times: data.times } : { times: [] };
  } catch {
    return { times: [] };
  }
}

async function saveState(ip: string, state: FeedbackRateState, cache?: Cache): Promise<void> {
  if (!cache) {
    devBuckets.set(ip, state);
    return;
  }
  await cache.put(
    stateUrl(ip),
    new Response(JSON.stringify(state), {
      headers: { "Cache-Control": `max-age=${FEEDBACK_RATE_LIMIT.dayMs / 1000}` },
    }),
  );
}

export function clientIpFromRequest(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function checkFeedbackRateLimit(
  ip: string,
  caches?: CacheStorage,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const cache = caches ? await caches.open("voluspace-feedback-rate") : undefined;
  const state = await loadState(ip, cache);
  const now = Date.now();
  const status = feedbackRateStatus(state.times, now);
  return status;
}

export async function recordFeedbackSent(ip: string, caches?: CacheStorage): Promise<void> {
  const cache = caches ? await caches.open("voluspace-feedback-rate") : undefined;
  const state = await loadState(ip, cache);
  const now = Date.now();
  state.times = pruneFeedbackTimes(state.times, now);
  state.times.push(now);
  await saveState(ip, state, cache);
}
