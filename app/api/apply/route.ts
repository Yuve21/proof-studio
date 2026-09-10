import { NextResponse, type NextRequest } from "next/server";

/**
 * The application form's destination.
 *
 * THIS EXISTS BECAUSE THE FORM WAS POSTING NOWHERE. The live site's handler sent
 * applications to `hello@example.com`, a placeholder, so every application ever
 * submitted was silently discarded by a mail server. That is the worst possible
 * defect for this business: the free draft is the entire hook, the form is the
 * only way to ask for one, and it failed in a way that looked like success to
 * the person applying.
 *
 * THE ONE INVARIANT HERE: AN APPLICATION MUST NEVER BE SILENTLY LOST.
 *
 * Everything below follows from that. This route reports honestly whether it
 * delivered, and the client falls back to opening the visitor's own mail app
 * when it did not, so the worst case is "you have to press send yourself"
 * rather than "your application vanished". It never returns a cheerful 200 it
 * cannot back up.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where applications go. An env var so it changes without touching code. */
const DESTINATION = process.env.PROOF_APPLY_TO || "yuvraj.chandyok@gmail.com";

/** Field limits. Generous for prose, bounded so the route is not a paste bin. */
const LIMITS: Record<string, number> = {
  biz: 200,
  who: 200,
  email: 320,
  social: 300,
  kind: 100,
  about: 4000,
  want: 4000,
};

const REQUIRED = ["biz", "who", "email", "about"];

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ delivered: false, error: "expected a JSON body" }, { status: 400 });
  }

  const fields: Record<string, string> = {};
  for (const [key, max] of Object.entries(LIMITS)) fields[key] = clean(body[key], max);

  const missing = REQUIRED.filter((k) => !fields[k]);
  if (missing.length) {
    return NextResponse.json(
      { delivered: false, error: `these are needed: ${missing.join(", ")}` },
      { status: 400 },
    );
  }
  // Deliberately loose. A rejected address that is actually valid loses a real
  // customer, and a wrong one only costs us a bounce, so this asks only whether
  // the shape could possibly be an address.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    return NextResponse.json({ delivered: false, error: "that email address does not look right" }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.PROOF_MAIL_FROM;

  if (!key || !from) {
    /*
     * NOT CONFIGURED, AND SAYING SO IS THE WHOLE POINT.
     *
     * 503 with delivered:false tells the client to fall back to the visitor's own
     * mail app. Returning 200 here would be the exact defect this route was
     * written to fix: a form that reports success and delivers nothing. Sending
     * needs a verified domain, which Proof does not have yet.
     */
    return NextResponse.json(
      {
        delivered: false,
        reason: "no sending domain is configured on this deployment yet",
      },
      { status: 503 },
    );
  }

  const lines = [
    `Business:      ${fields.biz}`,
    `Contact:       ${fields.who}`,
    `Email:         ${fields.email}`,
    `Instagram/web: ${fields.social || "not given"}`,
    `Type:          ${fields.kind || "not given"}`,
    "",
    "WHAT THEY SELL",
    fields.about,
    "",
    "WHAT THEY WANT THE SITE TO DO",
    fields.want || "not given",
  ];

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [DESTINATION],
        // Their address, so hitting reply answers the applicant rather than us.
        reply_to: fields.email,
        subject: `Free draft request: ${fields.biz}`,
        text: lines.join("\n"),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // Loud, because an undelivered application is a lost customer and the log
      // line is the only remaining copy of it.
      console.error("[apply] Resend refused the send", {
        status: res.status,
        detail: detail.slice(0, 400),
        business: fields.biz,
      });
      return NextResponse.json({ delivered: false, reason: "the send was refused" }, { status: 502 });
    }
  } catch (err) {
    console.error("[apply] the send threw", { message: (err as Error)?.message, business: fields.biz });
    return NextResponse.json({ delivered: false, reason: "the send could not be reached" }, { status: 502 });
  }

  return NextResponse.json({ delivered: true });
}
