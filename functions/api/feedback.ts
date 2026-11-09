import {
  checkFeedbackRateLimit,
  clientIpFromRequest,
  recordFeedbackSent,
} from "../lib/feedbackRateLimit";
import { sendVoluspaceFeedback } from "../lib/sendVoluspaceFeedback";

interface FeedbackEnv {
  RESEND_API_KEY?: string;
}

export async function onRequestPost(context: {
  request: Request;
  env: FeedbackEnv;
  caches: CacheStorage;
}): Promise<Response> {
  const key = context.env.RESEND_API_KEY?.trim();
  if (!key) {
    return Response.json({ error: "Feedback email is not configured." }, { status: 503 });
  }

  let body: { message?: unknown; replyEmail?: unknown; page?: unknown; company?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.company === "string" && body.company.trim()) {
    return Response.json({ ok: true });
  }

  const ip = clientIpFromRequest(context.request);
  const rate = await checkFeedbackRateLimit(ip, context.caches);
  if (!rate.ok) {
    return Response.json(
      { error: "Too many messages. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  const result = await sendVoluspaceFeedback(key, {
    message: typeof body.message === "string" ? body.message : "",
    replyEmail: typeof body.replyEmail === "string" ? body.replyEmail : "",
    page: typeof body.page === "string" ? body.page : "",
  });

  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  await recordFeedbackSent(ip, context.caches);
  return Response.json({ ok: true });
}
