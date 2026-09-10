import { NextResponse, type NextRequest } from "next/server";
import { stripeClient, StripeConfigError } from "../../../../lib/billing/stripeClient.mjs";
import { PLANS, priceIdFor } from "../../../../lib/billing/catalog.mjs";

/**
 * Starts a Checkout Session for one of the two monthly plans.
 *
 * Inert without STRIPE_SECRET_KEY and the price ids. An unconfigured deployment
 * returns 503 with the reason, so the button says "not available yet" instead of
 * throwing a stack trace at a customer.
 *
 * THE PLAN COMES FROM A FIXED SET, NEVER FROM THE REQUEST. The body names a plan
 * id and this route looks the price up in the catalog. Accepting a price id, or
 * an amount, from the client would let anyone subscribe themselves at a price
 * they chose, which is the oldest checkout bug there is.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Checkout is not switched on for this deployment yet." },
      { status: 503 },
    );
  }

  let planId: unknown;
  try {
    const body = await request.json();
    planId = body?.plan;
  } catch {
    return NextResponse.json({ error: "expected a JSON body naming a plan" }, { status: 400 });
  }

  if (typeof planId !== "string" || !Object.prototype.hasOwnProperty.call(PLANS, planId)) {
    return NextResponse.json(
      { error: `unknown plan. Expected one of: ${Object.keys(PLANS).join(", ")}` },
      { status: 400 },
    );
  }

  const price = priceIdFor(planId);
  if (!price) {
    return NextResponse.json(
      { error: `the ${PLANS[planId as keyof typeof PLANS].name} plan has no price configured on this deployment yet.` },
      { status: 503 },
    );
  }

  const origin = request.headers.get("origin") || new URL(request.url).origin;

  // The guarded client. It refuses a key whose MODE does not match this
  // deployment, and a key belonging to a different Stripe account than the one
  // this deployment expects. Both refusals are configuration problems on our
  // side, so they read as 503 rather than blaming the customer.
  let stripe;
  try {
    stripe = await stripeClient();
  } catch (err) {
    if (err instanceof StripeConfigError) {
      console.error("[billing] refusing to start checkout:", (err as Error).message);
      return NextResponse.json({ error: "Checkout is not available right now." }, { status: 503 });
    }
    throw err;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    // The session id is needed by the success page to retrieve what was bought
    // and hand over the licence. It is not a secret: the page verifies the
    // session is paid before it hands anything over.
    success_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#pricing`,
    // Auto-renewal has to be disclosed clearly and cancellation has to be easy.
    // Several states require both, so both are load-bearing rather than polite.
    subscription_data: { metadata: { proof_plan: planId } },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    // Stripe Tax where it applies, rather than us guessing at a rate.
    automatic_tax: { enabled: true },
  });

  return NextResponse.json({ url: session.url });
}
