import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripeClient, StripeConfigError } from "../../../../lib/billing/stripeClient.mjs";
import { licenceForPaidPeriod, sessionIsPaid } from "../../../../lib/billing/issueForPayment.mjs";
import { planForPriceId } from "../../../../lib/billing/catalog.mjs";
import { sendMail, renewalMessage } from "../../../../lib/mail/send.mjs";

/**
 * Stripe to Proof.
 *
 * SETUP. Add this URL as an endpoint in the Stripe dashboard, subscribe it to the
 * events in SUBSCRIBED below, and set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
 * Inert until then: with no secret it returns 503 and does nothing, rather than
 * accepting unsigned requests.
 *
 * THE TWO async_payment_* EVENTS ARE NOT OPTIONAL, and this is the trap worth
 * knowing about. A delayed-settlement payment method (Klarna, Affirm, Cash App
 * Pay, ACH debit, some bank redirects) completes checkout while the charge is
 * still pending. `checkout.session.completed` fires IMMEDIATELY with
 * `payment_status: "unpaid"`, and the guard in issueForPayment correctly refuses
 * to mint on that. Stripe resolves the pending state minutes later with exactly
 * these two events. Without a subscriber to them, a payment that CLEARED never
 * produces a licence: the customer paid, and the only record is a refused-grant
 * log line. Inherited from a sibling product's Stripe integration, where it was
 * learned the expensive way.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not write to a database, because
 * there is not one. The licence is a signed token and the customer's entitlement
 * lives inside it, so the only durable state is Stripe's own. That is a real
 * limitation with a real consequence, stated here rather than discovered: on
 * RENEWAL there is nowhere to deliver the new token to except an email we do not
 * yet send. See the note at the bottom.
 */

export const runtime = "nodejs";
/** The raw body is required for signature verification, so no caching or parsing. */
export const dynamic = "force-dynamic";

const SUBSCRIBED = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "customer.subscription.deleted",
] as const;

/**
 * A billing failure where a customer may be paying and receiving nothing has to
 * be loud. Vercel Hobby log retention is about an hour and nothing is watching
 * stdout, so this is the weakest useful sink rather than a good one, and it is
 * marked as such so it gets replaced rather than trusted.
 */
function reportBillingProblem(reason: string, detail: Record<string, unknown>) {
  console.error(`[billing] ${reason}`, JSON.stringify(detail));
}

/** Never log a whole licence token. The tail is enough to correlate with support. */
const tokenTail = (token: string) => `...${token.slice(-12)}`;

export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) {
    // 503 rather than 200, so a misconfigured deployment shows up in Stripe's own
    // endpoint health instead of silently swallowing every event.
    return NextResponse.json({ error: "billing is not configured on this deployment" }, { status: 503 });
  }

  /*
   * The guarded client, and the refusal here is a 503 ON PURPOSE rather than a
   * 200. A wrong-account or wrong-mode key means events are arriving that this
   * deployment must not act on, and 503 makes Stripe retry and surfaces the
   * endpoint as unhealthy in its own dashboard. Returning 200 would consume every
   * event silently while nothing was granted.
   */
  let stripe: Stripe;
  try {
    stripe = await stripeClient();
  } catch (err) {
    if (err instanceof StripeConfigError) {
      reportBillingProblem("refusing to handle webhooks with this Stripe configuration", {
        reason: (err as Error).message,
      });
      return NextResponse.json({ error: "billing configuration refused" }, { status: 503 });
    }
    throw err;
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    // An unverifiable body is not a customer problem and must never be processed.
    return NextResponse.json({ error: `signature verification failed: ${(err as Error).message}` }, { status: 400 });
  }

  if (!SUBSCRIBED.includes(event.type as (typeof SUBSCRIBED)[number])) {
    // Acknowledge so Stripe stops retrying, but say plainly that nothing happened.
    return NextResponse.json({ received: true, handled: false, type: event.type });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (!sessionIsPaid(session)) {
          // THE IMPORTANT REFUSAL. Not an error: the correct outcome for a
          // pending delayed-settlement payment. The async_payment_succeeded
          // event above is what resolves it.
          reportBillingProblem("checkout session is not paid yet, so no licence was minted", {
            session: session.id,
            payment_status: session.payment_status,
            note: "expected for delayed settlement; async_payment_succeeded will follow",
          });
          return NextResponse.json({ received: true, handled: false, reason: "awaiting settlement" });
        }

        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!subId) {
          return NextResponse.json({ received: true, handled: false, reason: "not a subscription checkout" });
        }

        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price?.id;
        const periodEnd = sub.items.data[0]?.current_period_end ?? null;

        const minted = licenceForPaidPeriod({ customerId: customerId ?? "", priceId, periodEndSeconds: periodEnd });
        if (!minted) {
          const plan = planForPriceId(priceId);
          if (!plan) {
            // An unknown price is OUR configuration problem, not the customer's,
            // and it means somebody paid for something this deployment cannot name.
            reportBillingProblem("paid subscription on a price this deployment does not recognise", {
              subscription: subId,
              price: priceId,
              note: "check STRIPE_PRICE_* env vars against the dashboard, test versus live mode",
            });
          }
          return NextResponse.json({ received: true, handled: true, licence: false, plan: plan?.id ?? null });
        }

        /*
         * The token is attached to the Stripe customer so the success page and the
         * portal can retrieve it without a database of our own. Stripe metadata is
         * the durable store on purpose: it is already the system of record for
         * whether this person has paid.
         *
         * The customer id is checked rather than coerced. An earlier version of
         * this line read `customerId ? customerId : ""`, which would have called
         * the API with an empty id and thrown, turning a missing id into a 500 and
         * a Stripe retry loop instead of a named problem. A licence that was
         * minted and then not stored is the worst outcome available here, so it
         * gets its own report.
         */
        if (!customerId) {
          reportBillingProblem("minted a licence for a session with no customer id, so it cannot be stored", {
            session: session.id,
            subscription: subId,
          });
          return NextResponse.json({ received: true, handled: false, reason: "no customer to store against" });
        }
        await stripe.customers.update(customerId, {
          metadata: {
            proof_licence: minted.token,
            proof_licence_expires: minted.expires.toISOString(),
            proof_plan: minted.plan.id,
          },
        });

        return NextResponse.json({
          received: true,
          handled: true,
          licence: true,
          plan: minted.plan.id,
          token: tokenTail(minted.token),
        });
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        reportBillingProblem("a delayed payment failed after checkout completed", {
          session: session.id,
          customer: typeof session.customer === "string" ? session.customer : null,
        });
        return NextResponse.json({ received: true, handled: true, licence: false });
      }

      case "invoice.paid": {
        // RENEWAL. The same mint, on the same guard, so a renewal cannot take a
        // different and less careful path than a first purchase.
        const invoice = event.data.object as Stripe.Invoice;
        const line = invoice.lines?.data?.[0];
        /*
         * An invoice line's price arrives as an ID STRING or as an expanded Price
         * OBJECT depending on the request. Caught by the compiler rather than in
         * production, which matters: passing the object through would have
         * matched no configured price id, so `planForPriceId` would have returned
         * null and a paying customer would have received nothing, with the log
         * line blaming our env vars.
         */
        const rawPrice = line?.pricing?.price_details?.price;
        const priceId = typeof rawPrice === "string" ? rawPrice : rawPrice?.id;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        const periodEnd = line?.period?.end ?? null;

        if (!invoice.amount_paid || invoice.amount_paid <= 0) {
          // A zero invoice is a trial or a full credit. Nothing was paid, so
          // nothing is minted, and saying so is better than a silent skip.
          return NextResponse.json({ received: true, handled: false, reason: "nothing was actually paid" });
        }

        const minted = licenceForPaidPeriod({ customerId: customerId ?? "", priceId, periodEndSeconds: periodEnd });
        if (!minted) {
          return NextResponse.json({ received: true, handled: true, licence: false });
        }
        if (!customerId) {
          reportBillingProblem("minted a renewal licence with no customer id, so it cannot be stored", {
            invoice: invoice.id,
          });
          return NextResponse.json({ received: true, handled: false, reason: "no customer to store against" });
        }
        await stripe.customers.update(customerId, {
          metadata: {
            proof_licence: minted.token,
            proof_licence_expires: minted.expires.toISOString(),
            proof_plan: minted.plan.id,
          },
        });
        /*
         * DELIVER IT. This is the gap that was named twice before it was closed:
         * a renewal minted a token into Stripe metadata and the customer was
         * never told, so they had to come back to a page they had no reason to
         * visit. Between the ten-day buffer and the seven-day grace they kept
         * working for over two weeks and then stopped, with no warning anywhere.
         *
         * A failed send does NOT fail the webhook. The licence is already minted
         * and stored, so retrying the whole event would re-mint rather than
         * re-send, and Stripe retrying a successful payment handler is worse than
         * an undelivered email. So the send is reported and the event is
         * acknowledged, and an undelivered renewal is loud in the log because it
         * is the one thing that leaves a paying customer stuck.
         */
        const customerEmail =
          typeof invoice.customer_email === "string" ? invoice.customer_email : null;
        let delivery: { sent: boolean; reason?: string; detail?: string } = {
          sent: false,
          reason: "no-email-on-invoice",
        };
        if (customerEmail) {
          const msg = renewalMessage({
            token: minted.token,
            expires: minted.expires,
            planName: minted.plan.name,
          });
          delivery = await sendMail({ to: customerEmail, subject: msg.subject, text: msg.text });
        }
        if (!delivery.sent) {
          reportBillingProblem("a renewal licence was minted but NOT delivered to the customer", {
            invoice: invoice.id,
            customer: customerId,
            reason: delivery.reason,
            detail: delivery.detail,
            note: "they have paid and cannot collect the token without being told; send it by hand",
          });
        }

        return NextResponse.json({
          received: true,
          handled: true,
          licence: true,
          renewal: true,
          delivered: delivery.sent,
          token: tokenTail(minted.token),
        });
      }

      case "customer.subscription.deleted": {
        /*
         * CANCELLATION, and the honest shape of it for an offline licence.
         *
         * There is no revocation to perform. The token they hold stays valid
         * until it expires, which is the paid period end plus the buffer, and
         * that is CORRECT: they paid for that period. What cancellation does is
         * stop the next token being issued, so access ends when the paid time
         * ends rather than the moment the card is removed.
         *
         * The metadata is cleared so the success page and the portal stop handing
         * the token back out, which is the only thing we can actually do.
         */
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (customerId) {
          await stripe.customers.update(customerId, {
            metadata: { proof_licence: "", proof_licence_expires: "", proof_plan: "" },
          });
        }
        return NextResponse.json({
          received: true,
          handled: true,
          note: "no revocation performed; the existing token runs out the period that was paid for",
        });
      }
    }
  } catch (err) {
    // A 500 makes Stripe retry, which is what we want for a transient failure.
    // Returning 200 on an exception would consume the event permanently and lose
    // a licence for a payment that succeeded.
    reportBillingProblem("webhook handler threw, returning 500 so Stripe retries", {
      type: event.type,
      message: (err as Error)?.message,
    });
    return NextResponse.json({ error: "handler failed, retry" }, { status: 500 });
  }

  return NextResponse.json({ received: true, handled: false });
}

/*
 * THE GAP, STATED RATHER THAN LEFT TO BE DISCOVERED.
 *
 * A renewal mints a new token into Stripe customer metadata, and the customer has
 * no notification that it happened. They have to come back to the success page or
 * the portal to collect it. With the licence buffer at 10 days and a grace window
 * of 7, a customer who never comes back keeps working for over two weeks past the
 * period they paid for, and then stops.
 *
 * Closing it needs one of: an email on renewal, which needs a sending domain, or
 * a PROOF_LICENCE_FILE the server re-reads plus a small endpoint the MCP can
 * fetch a fresh token from, which contradicts the no-egress guarantee and so is
 * not an option. Email is the answer. It is not built.
 */
