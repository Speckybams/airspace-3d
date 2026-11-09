import { useState } from "react";

const MESSAGE_MAX = 4000;

export function RailFeedback() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "rate">("idle");

  const send = async () => {
    const text = message.trim();
    if (!text || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          replyEmail: email.trim(),
          page: window.location.href,
          company,
        }),
      });
      if (res.status === 429) {
        setStatus("rate");
        return;
      }
      if (!res.ok) throw new Error("send failed");
      setMessage("");
      setEmail("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="rail-feedback">
      <button
        type="button"
        className={open ? "btn active rail-feedback-toggle" : "btn rail-feedback-toggle"}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (status === "sent" || status === "error" || status === "rate") setStatus("idle");
        }}
      >
        Feedback
      </button>
      {open ? (
        <form
          className="rail-feedback-form"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="field">
            <span>Message</span>
            <textarea
              value={message}
              maxLength={MESSAGE_MAX}
              rows={4}
              required
              placeholder="What should we change?"
              onChange={(event) => {
                setMessage(event.target.value);
                if (status !== "idle") setStatus("idle");
              }}
            />
          </label>
          <label className="field">
            <span>Email · optional</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              placeholder="So we can reply"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <input
            className="rail-feedback-honey"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
          <button type="submit" className="btn primary" disabled={!message.trim() || status === "sending"}>
            {status === "sending" ? "Sending…" : "Send"}
          </button>
          {status === "sent" ? <p className="rail-feedback-note">Sent to Volugraph support. Thank you.</p> : null}
          {status === "rate" ? (
            <p className="rail-feedback-note">
              Please wait a minute before sending again (up to a few messages per hour).
            </p>
          ) : null}
          {status === "error" ? (
            <p className="rail-feedback-note">
              Could not send. Email{" "}
              <a href="mailto:support@volugraph.com?subject=Voluspace%20Feedback">support@volugraph.com</a> instead.
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
