/**
 * Sending mail, and the one thing it refuses to pretend.
 *
 * There is exactly one honest failure mode for a send: it either happened or it
 * did not, and the caller has to be told which. Everything here exists so that
 * `sent: false` is always reachable and never swallowed.
 *
 * WHY THAT IS THE WHOLE DESIGN. The sibling product's most expensive lesson is a
 * try/catch that covered two failure modes and therefore picked the more
 * permissive policy for both: a guard threw correctly, the catch discarded it,
 * and the caller was told everything was fine. So this module never returns a
 * truthy result on an error path, and callers decide what an undelivered message
 * means for them. A renewal email that silently failed would leave a paying
 * customer with a token they never received and no record that anybody tried.
 *
 * NOT CONFIGURED IS NOT AN ERROR, and it is reported separately. Proof has no
 * sending domain yet, so `reason: "not-configured"` is the expected answer today
 * and a caller can treat it differently from a refusal.
 */

const ENDPOINT = "https://api.resend.com/emails";

/**
 * @param {{to: string, subject: string, text: string, replyTo?: string}} msg
 * @returns {Promise<{sent: boolean, reason?: string, detail?: string}>}
 */
export async function sendMail({ to, subject, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.PROOF_MAIL_FROM;

  if (!key || !from) return { sent: false, reason: "not-configured" };
  if (!to || !subject || !text) return { sent: false, reason: "incomplete-message" };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, reason: "refused", detail: detail.slice(0, 400) };
    }
    return { sent: true };
  } catch (err) {
    // Unreachable is distinct from refused, because the two are fixed
    // differently: one is a network or DNS problem, the other is a rejected
    // message. Collapsing them would be the two-failure-modes defect again.
    return { sent: false, reason: "unreachable", detail: (err instanceof Error ? err.message : "").slice(0, 200) };
  }
}

/**
 * The renewal message.
 *
 * WHY THIS TEXT MATTERS MORE THAN IT LOOKS. The customer has already paid, and
 * the only thing standing between them and a working product is receiving this
 * token. So the token goes near the TOP, the install line is included so they do
 * not have to go and find it, and the expiry is stated so a lapse is never a
 * surprise. Nothing is asked of them except a paste.
 */
export function renewalMessage({ token, expires, planName }) {
  const when = new Date(expires).toLocaleDateString("en-US", { dateStyle: "long" });
  return {
    subject: "Your Proof licence for this month",
    text: [
      `Your ${planName} plan renewed, so here is this month's licence.`,
      "",
      token,
      "",
      `It runs until ${when}. Paste it wherever you keep it, replacing the old one.`,
      "",
      "For Claude Code, the whole line is:",
      "",
      `claude mcp add proof --env PROOF_LICENCE=${token} -- npx -y github:Yuve21/proof-team-mcp`,
      "",
      "If your mail client wraps that across two lines it still works, we strip the break.",
      "",
      "Nothing else to do. If anything is wrong, reply to this email and a person will read it.",
    ].join("\n"),
  };
}
