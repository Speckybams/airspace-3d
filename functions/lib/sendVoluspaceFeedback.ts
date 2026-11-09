const SUPPORT_TO = "support@volugraph.com";
const SUPPORT_FROM = "Voluspace <noreply@volugraph.com>";
const SUBJECT = "Voluspace Feedback";
const MESSAGE_MAX = 4000;

export interface VoluspaceFeedbackInput {
  message: string;
  replyEmail?: string;
  page?: string;
}

export async function sendVoluspaceFeedback(
  apiKey: string,
  input: VoluspaceFeedbackInput,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const message = input.message.trim();
  if (!message) return { ok: false, status: 400, error: "Message is required." };
  if (message.length > MESSAGE_MAX) {
    return { ok: false, status: 400, error: "Message is too long." };
  }

  const reply = input.replyEmail?.trim() ?? "";
  const replyEmail = reply.includes("@") && reply.length <= 320 ? reply : "";
  const page = (input.page ?? "").trim().slice(0, 500);

  const text = [
    "Voluspace Feedback",
    replyEmail ? `Reply to: ${replyEmail}` : "Reply to: not provided",
    page ? `Page: ${page}` : "",
    "",
    message,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SUPPORT_FROM,
      to: [SUPPORT_TO],
      subject: SUBJECT,
      text,
      ...(replyEmail ? { reply_to: replyEmail } : {}),
    }),
  });

  if (!res.ok) {
    return { ok: false, status: 502, error: "Could not send feedback." };
  }
  return { ok: true };
}
