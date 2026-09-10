/**
 * The bridge from "money arrived" to "the agents work".
 *
 * This is the only place a licence is minted for a paying customer, and it is
 * SERVER ONLY. It imports the signing path, so `scripts/check-licence-boundary.mjs`
 * must name it in the allowlist and will fail the build if it ever becomes
 * reachable from anything shipped to a customer.
 *
 * THE THREE THINGS THIS REFUSES TO DO, each because the alternative is a customer
 * who paid and got nothing, or one who got something without paying.
 *
 * 1. IT WILL NOT MINT ON AN UNPAID SESSION. A delayed-settlement payment method
 *    (Klarna, Affirm, Cash App Pay, ACH debit, some bank redirects) completes
 *    checkout while the charge is still pending: `checkout.session.completed`
 *    fires immediately with `payment_status: "unpaid"`. Granting there hands out
 *    a licence for money that may never arrive. Stripe's own resolution is the
 *    two `checkout.session.async_payment_*` events, minutes later, and a webhook
 *    that does not subscribe to those turns a cleared payment into silence.
 *
 * 2. IT WILL NOT GUESS A PLAN. An unrecognised price id returns null and the
 *    caller does nothing, loudly. The alternative, defaulting to the cheapest or
 *    the most generous plan, is wrong in one direction for the customer and wrong
 *    in the other for us.
 *
 * 3. IT WILL NOT SIGN WITHOUT A KEY. A missing signing key throws rather than
 *    returning an unsigned or placeholder token, because a token that looks like
 *    a licence and verifies against nothing is worse than an error: it reaches
 *    the customer before anybody notices.
 */
import { issue } from "../../licence/issue.mjs";
import { planForPriceId, LICENCE_BUFFER_DAYS } from "./catalog.mjs";

const DAY = 86_400_000;

/** Which issuer key this deployment signs with. Must exist in ISSUER_PUBLIC_KEYS. */
export const ACTIVE_KEY_ID = process.env.PROOF_LICENCE_KEY_ID || "k1";

export class BillingLicenceError extends Error {}

/**
 * Mint a licence for a paid subscription period.
 *
 * @param {object} args
 * @param {string} args.customerId  the Stripe customer id, used as the opaque customer
 * @param {string} args.priceId     the Stripe price the subscription is on
 * @param {number|null} args.periodEndSeconds  Stripe's current_period_end, unix seconds
 * @returns {{token: string, plan: object, expires: Date}|null} null when the price is not ours
 */
export function licenceForPaidPeriod({ customerId, priceId, periodEndSeconds }) {
  const plan = planForPriceId(priceId);
  if (!plan) return null;

  // A plan entitling no agents is a real product (Kept online is hosting and
  // edits) and it correctly gets NO licence rather than an empty one. An empty
  // licence would be refused by the verifier anyway, so minting one would
  // manufacture a support ticket for a customer whose plan is working as sold.
  if (plan.agents.length === 0) return null;

  if (typeof customerId !== "string" || !customerId) {
    throw new BillingLicenceError("no Stripe customer id, so the licence would name nobody");
  }

  const privateKeyPem = process.env.PROOF_LICENCE_PRIVATE_KEY;
  if (!privateKeyPem) {
    throw new BillingLicenceError(
      "PROOF_LICENCE_PRIVATE_KEY is not set, so no licence can be signed. Refusing to return an " +
      "unsigned token: one that looks like a licence and verifies against nothing reaches the " +
      "customer before anybody notices.",
    );
  }

  /*
   * The expiry is the paid period end plus a buffer.
   *
   * When Stripe gives no period end, which happens on some invoice shapes, fall
   * back to a month from now rather than to zero. A zero would mint an
   * already-expired licence, and `issue()` refuses that, so the customer's
   * payment would succeed and produce an exception instead of a product.
   */
  const base = periodEndSeconds ? periodEndSeconds * 1000 : Date.now() + 30 * DAY;
  const expires = new Date(base + LICENCE_BUFFER_DAYS * DAY);

  const token = issue({
    customer: customerId,
    agents: plan.agents,
    expires,
    privateKeyPem,
    keyId: ACTIVE_KEY_ID,
  });

  return { token, plan, expires };
}

/**
 * Whether a Stripe checkout session actually moved money.
 *
 * Separated out and given its own name because the shape of this check is the
 * defect from point 1 above, and a named function is harder to skip than a
 * condition inside a handler.
 */
export function sessionIsPaid(session) {
  return session?.payment_status === "paid" || session?.payment_status === "no_payment_required";
}
