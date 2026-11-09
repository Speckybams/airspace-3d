import { describe, expect, it } from "vitest";
import {
  FEEDBACK_RATE_LIMIT,
  feedbackRateStatus,
  pruneFeedbackTimes,
} from "../functions/lib/feedbackRateLimit";

describe("feedback rate limit", () => {
  it("allows the first message", () => {
    expect(feedbackRateStatus([], Date.now()).ok).toBe(true);
  });

  it("blocks a second send inside the one-minute gap", () => {
    const now = 1_700_000_000_000;
    const times = [now - 30_000];
    const out = feedbackRateStatus(times, now);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.retryAfterSec).toBeGreaterThan(0);
  });

  it("allows up to five messages per hour", () => {
    const now = 1_700_000_000_000;
    const times = [now - 50 * 60_000, now - 40 * 60_000, now - 30 * 60_000, now - 20 * 60_000];
    expect(feedbackRateStatus(times, now).ok).toBe(true);
    const busy = [...times, now - FEEDBACK_RATE_LIMIT.minGapMs - 1];
    expect(feedbackRateStatus(busy, now).ok).toBe(false);
  });

  it("drops sends older than a day", () => {
    const now = 1_700_000_000_000;
    const old = now - FEEDBACK_RATE_LIMIT.dayMs - 1000;
    expect(pruneFeedbackTimes([old, now - 1000], now)).toEqual([now - 1000]);
  });
});
