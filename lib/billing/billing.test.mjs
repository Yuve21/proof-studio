/**
 * Tests for the payment-to-licence bridge.
 *
 * These are the tests where a bug means somebody paid and got nothing, or got
 * something without paying, so every one of them asserts a REFUSAL and proves
 * the presence first: the same call with the one broken thing fixed must mint.
 *
 * The webhook route itself is not tested here, because testing it would mean
 * mocking Stripe and asserting against the mock, which is a test of the mock. The
 * decisions worth pinning were deliberately pulled OUT of the route and into
 * these two pure functions for exactly that reason.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { licenceForPaidPeriod, sessionIsPaid, BillingLicenceError } from "./issueForPayment.mjs";
import { PLANS, planForPriceId, priceIdFor, LICENCE_BUFFER_DAYS } from "./catalog.mjs";
import { modeMismatch, accountMismatch } from "./stripeClient.mjs";
import { entitlement } from "../../licence/verify.mjs";
import { registrable } from "../../licence/roster.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }).toString();
const PRIV = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const KEYS = { k1: PUB };
const DAY = 86_400_000;

/** Set the env this module reads, and restore it afterwards. */
const withEnv = (vars, fn) => {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

const CONFIGURED = {
  STRIPE_PRICE_KEPT_ONLINE: "price_online_test",
  STRIPE_PRICE_KEPT_SHARP: "price_sharp_test",
  PROOF_LICENCE_PRIVATE_KEY: PRIV,
};

const periodEnd = () => Math.floor((Date.now() + 30 * DAY) / 1000);

test("a paid Kept sharp period mints a licence that actually verifies and entitles", () => {
  withEnv(CONFIGURED, () => {
    const minted = licenceForPaidPeriod({
      customerId: "cus_test123",
      priceId: "price_sharp_test",
      periodEndSeconds: periodEnd(),
    });
    assert.ok(minted, "a configured Kept sharp price must mint");
    assert.equal(minted.plan.id, "kept-sharp");

    // The whole point: the token is not just a string, it works.
    const r = entitlement(minted.token, { publicKeys: KEYS });
    assert.equal(r.valid, true, r.reason);
    assert.equal(r.customer, "cus_test123");
    const reg = registrable(minted.token, { publicKeys: KEYS });
    assert.ok(reg.agents.length >= 12, `expected the tier-1 roster, got ${reg.agents.length}`);
    assert.equal(reg.status, "ok");
  });
});

test("the expiry is the paid period end PLUS a buffer, and the buffer outlasts the grace window", () => {
  withEnv(CONFIGURED, () => {
    const end = periodEnd();
    const minted = licenceForPaidPeriod({
      customerId: "cus_x",
      priceId: "price_sharp_test",
      periodEndSeconds: end,
    });
    const expected = end * 1000 + LICENCE_BUFFER_DAYS * DAY;
    assert.equal(minted.expires.getTime(), expected);

    /*
     * WHY THE BUFFER EXISTS. If the token expired exactly when the period ends,
     * any delay between the renewal payment and the new token reaching the
     * customer is a window where they have paid and their agents have stopped.
     * The buffer must also outlast the verifier's grace window, or the two have
     * to be reasoned about together, which is how one of them ends up wrong.
     */
    assert.ok(LICENCE_BUFFER_DAYS > 7, "the buffer must be longer than GRACE_DAYS");
  });
});

test("Kept online mints NOTHING, because it entitles no agents and an empty licence is a support ticket", () => {
  withEnv(CONFIGURED, () => {
    // Presence first: the sharp price on the same call does mint.
    assert.ok(licenceForPaidPeriod({ customerId: "c", priceId: "price_sharp_test", periodEndSeconds: periodEnd() }));

    const minted = licenceForPaidPeriod({
      customerId: "c",
      priceId: "price_online_test",
      periodEndSeconds: periodEnd(),
    });
    assert.equal(minted, null, "a plan with no agent access must not mint an empty licence");
    // And the plan itself is still recognised, so this is a deliberate null and
    // not a failure to identify what was bought.
    assert.equal(planForPriceId("price_online_test").id, "kept-online");
  });
});

test("an unrecognised price mints nothing and is not guessed at", () => {
  withEnv(CONFIGURED, () => {
    assert.equal(planForPriceId("price_somebody_elses"), null);
    assert.equal(
      licenceForPaidPeriod({ customerId: "c", priceId: "price_somebody_elses", periodEndSeconds: periodEnd() }),
      null,
    );
  });
});

test("a price id from the WRONG MODE does not match, which is the test-versus-live trap", () => {
  // The realistic failure: live mode configured, a test-mode price arrives. It
  // must not match, and it must not fall back to the first plan in the catalog.
  withEnv({ ...CONFIGURED, STRIPE_PRICE_KEPT_SHARP: "price_LIVE_sharp" }, () => {
    assert.equal(planForPriceId("price_sharp_test"), null);
    assert.equal(planForPriceId("price_LIVE_sharp").id, "kept-sharp");
  });
});

test("a plan with no price configured is UNAVAILABLE rather than free", () => {
  withEnv({ ...CONFIGURED, STRIPE_PRICE_KEPT_SHARP: undefined }, () => {
    assert.equal(priceIdFor("kept-sharp"), null, "no price means the plan cannot be sold");
    // And it cannot be minted for either, so a stray webhook cannot grant it.
    assert.equal(
      licenceForPaidPeriod({ customerId: "c", priceId: "price_sharp_test", periodEndSeconds: periodEnd() }),
      null,
    );
  });
});

test("no signing key THROWS rather than returning an unsigned token", () => {
  withEnv({ ...CONFIGURED, PROOF_LICENCE_PRIVATE_KEY: undefined }, () => {
    assert.throws(
      () => licenceForPaidPeriod({ customerId: "c", priceId: "price_sharp_test", periodEndSeconds: periodEnd() }),
      BillingLicenceError,
    );
    /*
     * The alternative, returning a placeholder or unsigned token, is worse than
     * an error: it looks like a licence, verifies against nothing, and reaches
     * the customer before anybody notices. An exception reaches us instead.
     */
  });
});

test("no customer id throws, so a licence is never minted naming nobody", () => {
  withEnv(CONFIGURED, () => {
    assert.throws(
      () => licenceForPaidPeriod({ customerId: "", priceId: "price_sharp_test", periodEndSeconds: periodEnd() }),
      /would name nobody/,
    );
  });
});

test("a missing period end falls back to a month, never to an already-expired licence", () => {
  withEnv(CONFIGURED, () => {
    const minted = licenceForPaidPeriod({
      customerId: "c",
      priceId: "price_sharp_test",
      periodEndSeconds: null,
    });
    assert.ok(minted, "a missing period end must still produce a usable licence");
    assert.ok(minted.expires.getTime() > Date.now(), "and it must not be in the past");
    // A zero would have been refused by issue(), so the customer's payment would
    // have succeeded and produced an exception instead of a product.
    assert.equal(entitlement(minted.token, { publicKeys: KEYS }).valid, true);
  });
});

test("sessionIsPaid is false for the delayed-settlement state, which is the whole trap", () => {
  /*
   * A delayed-settlement method (Klarna, Affirm, Cash App Pay, ACH debit) makes
   * checkout.session.completed fire IMMEDIATELY with payment_status "unpaid".
   * Minting there hands out a licence for money that may never arrive. Stripe
   * resolves it later with checkout.session.async_payment_succeeded, which the
   * webhook subscribes to.
   */
  assert.equal(sessionIsPaid({ payment_status: "unpaid" }), false);
  assert.equal(sessionIsPaid({ payment_status: "no_payment_required" }), true);
  assert.equal(sessionIsPaid({ payment_status: "paid" }), true);
  assert.equal(sessionIsPaid(null), false);
  assert.equal(sessionIsPaid({}), false, "an absent status must read as NOT paid");
});

test("the catalog's prices agree with the marketing page, which is where a customer reads them", () => {
  /*
   * Two independently written places state a price: this catalog and the pricing
   * section of app/page.tsx. Nothing but this test compares them, and a
   * subscription that charges a different number from the one printed on the page
   * is the kind of defect that ends in a chargeback rather than a bug report.
   */
  const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
  for (const plan of Object.values(PLANS)) {
    assert.ok(
      page.includes(`from $${plan.monthlyFrom} a month`),
      `the page must print "from $${plan.monthlyFrom} a month" for ${plan.name}`,
    );
    assert.ok(page.includes(plan.name), `the page must name the ${plan.name} plan`);
  }
});

test("the auto-renewal disclosure and a cancellation route both exist", () => {
  /*
   * Several states require a recurring charge to be disclosed clearly before it
   * starts AND cancellation to be at least as easy as signing up. Both are
   * therefore asserted rather than assumed, because copy is the easiest thing in
   * a repository to delete by accident.
   */
  const buttons = readFileSync(new URL("../../app/SubscribeButtons.tsx", import.meta.url), "utf8");
  assert.match(buttons, /Billed monthly, automatically, until you cancel/);
  assert.match(buttons, /Cancel any time/);
  // And the route that makes cancelling actually possible.
  assert.ok(
    existsSync(new URL("../../app/api/stripe/portal/route.ts", import.meta.url)),
    "the customer portal route must exist, or 'cancel any time' is not true",
  );
});

// --- the separate-account guard ----------------------------------------------

test("a TEST key in production is refused, because it collects nothing while looking fine", () => {
  /*
   * The quieter and therefore worse direction. With a test key live, every real
   * customer's payment succeeds in Stripe's test ledger, the site behaves
   * normally, licences are minted, and no money is ever collected. Nobody
   * notices until a bank reconciliation.
   */
  const why = modeMismatch("sk_test_abc123", "production");
  assert.ok(why, "a test key in production must be refused");
  assert.match(why, /TEST Stripe key is configured in production/);
  assert.match(why, /nothing would be collected/);

  // Presence: the same key is FINE outside production, or this is just a ban.
  assert.equal(modeMismatch("sk_test_abc123", "preview"), null);
  assert.equal(modeMismatch("sk_test_abc123", "development"), null);
  assert.equal(modeMismatch("sk_test_abc123", null), null, "local and test runs must not be blocked");
});

test("a LIVE key in a preview deployment is refused, because a test click charges a real card", () => {
  const why = modeMismatch("sk_live_abc123", "preview");
  assert.ok(why);
  assert.match(why, /LIVE Stripe key is configured in a preview/);

  // Presence: live in production is the correct pairing and must pass.
  assert.equal(modeMismatch("sk_live_abc123", "production"), null);
});

test("a restricted key is recognised in both modes, and nonsense is refused", () => {
  // rk_ keys are the ones you actually want on a webhook, so they must not be
  // rejected as unrecognised.
  assert.equal(modeMismatch("rk_live_abc", "production"), null);
  assert.equal(modeMismatch("rk_test_abc", "preview"), null);

  for (const bad of ["pk_live_abc", "whsec_abc", "abc", ""]) {
    const why = modeMismatch(bad, "production");
    assert.ok(why, `expected refusal for ${JSON.stringify(bad)}`);
  }
  // A publishable key is the classic paste error and must never be accepted as
  // a secret key.
  assert.match(modeMismatch("pk_live_abc", "production"), /does not look like a secret/);
});

test("no key at all is refused with its own reason, not treated as a mode problem", () => {
  assert.match(modeMismatch(undefined, "production"), /no Stripe key is configured/);
});

test("a key from the WRONG Stripe account is refused, which is the point of a separate account", () => {
  /*
   * FOUND BY A SURVIVING MUTATION. This comparison used to live inline behind the
   * accounts.retrieve() call, so no test could reach it and disabling it left the
   * suite green. Extracting the decision from the I/O is what made it testable,
   * and it is the same lesson as P-03.
   *
   * Why it matters more than an ordinary config check: a wrong-account key does
   * not fail. Checkout succeeds, the customer is charged, the money arrives, and
   * it arrives in the other business's ledger. Nothing surfaces it.
   */
  const why = accountMismatch("acct_LARK", "acct_PROOF");
  assert.ok(why, "a mismatched account must be refused");
  assert.match(why, /belongs to account acct_LARK/);
  assert.match(why, /expects acct_PROOF/);
  assert.match(why, /wrong ledger/);

  // Presence: the matching pair passes, so this is a comparison and not a ban.
  assert.equal(accountMismatch("acct_PROOF", "acct_PROOF"), null);
});

test("an unset expected account disables the check, and an unknown actual account does NOT", () => {
  // No expectation configured means we cannot check. That is permitted, because
  // refusing would mean nobody could take a first payment, and the client warns.
  assert.equal(accountMismatch("acct_ANYTHING", undefined), null);
  assert.equal(accountMismatch("acct_ANYTHING", ""), null);

  // But once an expectation IS set, Stripe failing to name the account must fail
  // CLOSED rather than being treated as agreement.
  const why = accountMismatch(undefined, "acct_PROOF");
  assert.ok(why, "an unknown actual account must not pass a configured check");
  assert.match(why, /cannot pass/);
});

