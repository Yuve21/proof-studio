/**
 * What Proof sells, as data.
 *
 * Same principle as the corpus: the thing that decides what a customer is
 * entitled to is a FIELD, not a branch buried in a webhook handler. A price id
 * appears exactly once in this file and nowhere else, so "which plan did they
 * buy" is a lookup rather than an if-chain that drifts from the page.
 *
 * PRICE IDS COME FROM THE ENVIRONMENT, not from this file. A price id is not a
 * secret, but it differs between test mode and live mode, and hard-coding one
 * means a test-mode id ships to production and every real checkout fails on a
 * missing price. An absent id makes the plan UNAVAILABLE rather than free, which
 * is the direction that fails closed.
 */

export const PLANS = {
  "kept-online": {
    id: "kept-online",
    name: "Kept online",
    /** Hosting, domain, uptime, same-day content edits. No agent access. */
    agents: [],
    priceEnv: "STRIPE_PRICE_KEPT_ONLINE",
    /** Kept in sync with the marketing page by a test, not by hope. */
    monthlyFrom: 40,
  },
  "kept-sharp": {
    id: "kept-sharp",
    name: "Kept sharp",
    /** Everything in Kept online, plus the departments checking the site monthly. */
    agents: ["tier-1"],
    priceEnv: "STRIPE_PRICE_KEPT_SHARP",
    monthlyFrom: 120,
  },
};

/** Resolve a plan by Stripe price id, or null. Null means do nothing, never guess. */
export function planForPriceId(priceId) {
  if (!priceId) return null;
  for (const plan of Object.values(PLANS)) {
    const configured = process.env[plan.priceEnv];
    if (configured && configured === priceId) return plan;
  }
  return null;
}

/** The price id for a plan, or null when this deployment has not been given one. */
export function priceIdFor(planId) {
  const plan = PLANS[planId];
  if (!plan) return null;
  return process.env[plan.priceEnv] || null;
}

/**
 * How long a licence lasts, relative to the paid period.
 *
 * It is the billing period END plus a buffer, NOT a fixed thirty days. The
 * failure this avoids: if a token expires exactly when the period ends, any
 * delay between the renewal payment and the new token reaching the customer is a
 * window in which they have paid and their agents have stopped. The buffer is
 * deliberately longer than the grace window in licence/verify.mjs, so the two
 * never have to be reasoned about together.
 */
export const LICENCE_BUFFER_DAYS = 10;
