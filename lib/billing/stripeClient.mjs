/**
 * The Stripe client, and the two checks that stop Proof billing on the wrong
 * account.
 *
 * WHY THIS FILE EXISTS. Proof bills on its OWN Stripe account, separate from the
 * founder's other business. That decision removes one risk and introduces
 * another: with two accounts reachable from one dashboard and one password
 * manager, the realistic failure is no longer regulatory contagion, it is a
 * COPY-PASTE. A key from the wrong account produces charges in the wrong ledger,
 * webhooks that never match, and a customer who paid the wrong company.
 *
 * A wrong-account key does not fail loudly on its own. Checkout succeeds. The
 * money arrives. It arrives somewhere else. So the guard has to be explicit.
 *
 * TWO CHECKS, and the cheap one runs first.
 *
 * 1. MODE AGAINST ENVIRONMENT, free, no API call. A live key in a preview
 *    deployment means a test click charges a real card. A test key in production
 *    means every real customer's payment is fake and nothing is collected, which
 *    is the quieter and therefore worse direction: the site looks like it works.
 *
 * 2. ACCOUNT IDENTITY, one API call per cold start, cached. If
 *    STRIPE_ACCOUNT_ID is set and the key resolves to a different account, every
 *    billing route refuses. Optional but strongly recommended, because it is the
 *    only check that can actually tell the two accounts apart: a Stripe secret
 *    key does not encode which account it belongs to, so nothing else can.
 */
import Stripe from "stripe";

export class StripeConfigError extends Error {}

/** Cached across requests in a warm lambda, so the account check costs one call. */
let verifiedAccountId = null;
let verifiedForKey = null;

/**
 * Which Vercel environment this is. "production", "preview", "development", or
 * null when running outside Vercel (local, or a test).
 */
const vercelEnv = () => process.env.VERCEL_ENV || null;

/**
 * Check the key's mode against the deployment. Returns a reason string when the
 * pairing is wrong, or null when it is fine.
 *
 * Exported separately so it can be tested without a network call and without a
 * Stripe key, which is the only way this check gets exercised at all.
 */
export function modeMismatch(key, env) {
  if (!key) return "no Stripe key is configured";
  const isLive = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  const isTest = key.startsWith("sk_test_") || key.startsWith("rk_test_");
  if (!isLive && !isTest) {
    return "the Stripe key does not look like a secret or restricted key (expected sk_ or rk_)";
  }
  if (env === "production" && isTest) {
    return (
      "a TEST Stripe key is configured in production. Every real customer's payment would be fake " +
      "and nothing would be collected, while the site continued to look like it worked. Refusing."
    );
  }
  if (env === "preview" && isLive) {
    return (
      "a LIVE Stripe key is configured in a preview deployment, so a test click would charge a real " +
      "card. Refusing."
    );
  }
  return null;
}

/**
 * Compare the account a key actually belongs to against the one this deployment
 * expects. Returns a reason string when they differ, or null.
 *
 * PULLED OUT OF THE I/O ON PURPOSE, and it was found by a surviving mutation.
 * When this comparison lived inline behind the `accounts.retrieve()` call, no
 * test could reach it, and disabling the check left the whole suite green. That
 * is the same defect recorded as P-03: a guard behind a network call is a guard
 * nothing exercises.
 *
 * What remains untested is only the API call itself, which is Stripe's code, not
 * ours. The DECISION is here and it is pinned.
 */
export function accountMismatch(actualId, expectedId) {
  if (!expectedId) return null;
  if (!actualId) {
    return (
      "Stripe did not say which account this key belongs to, so the account check cannot pass. " +
      "Refusing rather than billing on an unverified account."
    );
  }
  if (actualId !== expectedId) {
    return (
      `this Stripe key belongs to account ${actualId}, but this deployment expects ${expectedId}. ` +
      `Refusing: a wrong-account key does not fail on its own, it succeeds and puts the money in ` +
      `the wrong ledger.`
    );
  }
  return null;
}

/**
 * Build a Stripe client, refusing if the configuration is wrong.
 *
 * @returns {Promise<Stripe>}
 * @throws {StripeConfigError} with a reason a human can act on
 */
export async function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;

  const mismatch = modeMismatch(key, vercelEnv());
  if (mismatch) throw new StripeConfigError(mismatch);

  // 10s and 2 retries keeps the SDK's retry loop inside Stripe's webhook
  // delivery deadline, so a slow call cannot get a request killed after the
  // event has already been consumed.
  const stripe = new Stripe(key, { timeout: 10_000, maxNetworkRetries: 2 });

  const expected = process.env.STRIPE_ACCOUNT_ID;
  if (!expected) {
    /*
     * Deliberately not a failure. A deployment that has not been told which
     * account to expect cannot check, and refusing here would mean nobody could
     * ever take the first payment. But it is the check that makes the
     * separate-account decision real, so its absence is worth saying out loud
     * rather than passing in silence.
     */
    console.warn(
      "[billing] STRIPE_ACCOUNT_ID is not set, so the account identity check is OFF. A key from the " +
      "wrong Stripe account would be used without complaint. Set it to acct_... from the Stripe " +
      "dashboard.",
    );
    return stripe;
  }

  if (verifiedForKey === key && verifiedAccountId === expected) return stripe;

  let account;
  try {
    account = await stripe.accounts.retrieve();
  } catch (err) {
    throw new StripeConfigError(
      `could not confirm which Stripe account this key belongs to: ${err.message}. Refusing rather ` +
      `than billing on an unverified account.`,
    );
  }

  const wrongAccount = accountMismatch(account.id, expected);
  if (wrongAccount) throw new StripeConfigError(wrongAccount);

  verifiedForKey = key;
  verifiedAccountId = expected;
  return stripe;
}

/** Test seam. Clears the memo so a test can change the key and re-check. */
export function resetAccountCheckCache() {
  verifiedAccountId = null;
  verifiedForKey = null;
}
