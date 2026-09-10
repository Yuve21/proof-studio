import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

/**
 * The customer portal, where somebody cancels, updates a card, or downloads an
 * invoice without emailing us.
 *
 * THIS ROUTE EXISTS BECAUSE "CANCEL ANY TIME" IS PRINTED ON THE PRICING SECTION,
 * and a promise on a pricing page is a promise. Several states require that
 * cancelling a recurring charge is at least as easy as starting it, and "email us
 * and wait" is not. So this is a compliance surface as much as a convenience.
 *
 * THE ACCESS QUESTION, AND ITS HONEST ANSWER. Proof has no accounts and no
 * database, so there is nothing to authenticate against. A portal link is
 * therefore requested with the checkout SESSION ID the customer already holds
 * from their receipt, and the session is checked to be paid before a link is
 * issued.
 *
 * What that means, plainly: anybody holding a customer's session id can reach
 * that customer's billing portal. The id is unguessable and it is only ever in
 * the customer's own URL and Stripe's receipt email, so this is the same exposure
 * as a password reset link, which is the standard trade. It would NOT be an
 * acceptable trade for anything beyond billing self-service, and it is the reason
 * this route can never be extended to expose anything else.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "billing is not configured on this deployment" }, { status: 503 });
  }

  let sessionId: unknown;
  try {
    const body = await request.json();
    sessionId = body?.session_id;
  } catch {
    return NextResponse.json({ error: "expected a JSON body with session_id" }, { status: 400 });
  }
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "session_id does not look like a checkout session" }, { status: 400 });
  }

  const stripe = new Stripe(key, { timeout: 10_000, maxNetworkRetries: 2 });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    // Deliberately the same message as an unpaid session, so this cannot be used
    // to probe which session ids exist.
    return NextResponse.json({ error: "that checkout session is not available" }, { status: 404 });
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId || (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) {
    return NextResponse.json({ error: "that checkout session is not available" }, { status: 404 });
  }

  const origin = request.headers.get("origin") || new URL(request.url).origin;
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/welcome?session_id=${encodeURIComponent(sessionId)}`,
  });

  return NextResponse.json({ url: portal.url });
}
