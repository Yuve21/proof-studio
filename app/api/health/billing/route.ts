import { NextResponse } from "next/server";
import { issue } from "../../../../licence/issue.mjs";
import { entitlement, ISSUER_PUBLIC_KEYS } from "../../../../licence/verify.mjs";
import { PLANS, priceIdFor } from "../../../../lib/billing/catalog.mjs";
import { modeMismatch } from "../../../../lib/billing/stripeClient.mjs";

/**
 * Is this deployment actually able to take money and issue a licence?
 *
 * WHY THIS EXISTS, and it is a specific mistake rather than good hygiene.
 *
 * The licence signing key is a multi-line PEM in an environment variable. I set
 * it with the Vercel CLI and then tried to verify it by pulling the environment
 * back, which returns the literal string `[SENSITIVE]` for a secret. Eleven
 * characters. I measured the redaction placeholder, concluded the PEM had been
 * mangled, and was about to change working code to fix a problem that did not
 * exist.
 *
 * The real lesson underneath that: **a write-only secret cannot be verified by
 * reading it back, so it has to be verified by USING it.** Without this route the
 * first proof that the signing key survived its trip into the environment would
 * be a customer's first payment, and the failure mode there is a webhook that
 * throws, Stripe retrying, and somebody who paid receiving nothing.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN. No key material, no key fingerprint, no
 * price ids, no account id, no token. Only booleans and, where something is
 * wrong, a reason written for whoever has to fix it. It is public, and the
 * judgement there is explicit: what it reveals is whether this deployment is
 * configured, which is worth nothing to an attacker and a great deal to us. It
 * must stay that way. Anything that returns a VALUE belongs behind
 * authentication, and at that point it belongs in the dashboard instead.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // --- the licence signing round trip, which is the whole reason for this route
  const priv = process.env.PROOF_LICENCE_PRIVATE_KEY;
  const keyId = process.env.PROOF_LICENCE_KEY_ID || "k1";

  if (!priv) {
    checks.licenceSigning = { ok: false, detail: "PROOF_LICENCE_PRIVATE_KEY is not set" };
  } else if (!ISSUER_PUBLIC_KEYS[keyId as keyof typeof ISSUER_PUBLIC_KEYS]) {
    checks.licenceSigning = {
      ok: false,
      detail: `PROOF_LICENCE_KEY_ID is "${keyId}" but no public key with that id is compiled in`,
    };
  } else {
    /*
     * Mint a throwaway licence and verify it against the SHIPPED public key. This
     * is the only test that proves the two halves match: the private key could be
     * perfectly well-formed and belong to a different pair, in which case every
     * customer would see "this token was not issued by us" and we would have no
     * idea why.
     *
     * The token is never returned and never stored. It exists for the length of
     * this function.
     */
    try {
      const probe = issue({
        customer: "health-probe",
        agents: ["tier-1"],
        expires: new Date(Date.now() + 60_000),
        privateKeyPem: priv,
        keyId,
      });
      const verified = entitlement(probe);
      checks.licenceSigning = verified.valid
        ? { ok: true, detail: `signed with ${keyId} and verified against the compiled-in public key` }
        : { ok: false, detail: `signed, but did not verify: ${verified.reason}` };
    } catch (err) {
      checks.licenceSigning = {
        ok: false,
        // The message from `issue` names the shape problem, for example a value
        // that is not a PEM, which is precisely the mangled-newline case.
        detail: `could not sign: ${(err as Error).message}`,
      };
    }
  }

  // --- Stripe, without touching the network
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const mismatch = modeMismatch(stripeKey, process.env.VERCEL_ENV || null);
  checks.stripeKey = mismatch ? { ok: false, detail: mismatch } : { ok: true };
  checks.stripeWebhookSecret = {
    ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    detail: process.env.STRIPE_WEBHOOK_SECRET ? undefined : "not set, so webhooks are refused",
  };
  checks.stripeAccountPinned = {
    ok: Boolean(process.env.STRIPE_ACCOUNT_ID),
    detail: process.env.STRIPE_ACCOUNT_ID
      ? undefined
      : "STRIPE_ACCOUNT_ID is not set, so a key from the wrong Stripe account would be used without complaint",
  };

  // --- the plans, named individually so a half-configured catalog is visible
  for (const plan of Object.values(PLANS)) {
    checks[`plan:${plan.id}`] = priceIdFor(plan.id)
      ? { ok: true }
      : { ok: false, detail: `${plan.priceEnv} is not set, so ${plan.name} cannot be sold` };
  }

  // --- delivery, which is what turns a payment into a working product
  const canEmail = Boolean(process.env.RESEND_API_KEY && process.env.PROOF_MAIL_FROM);
  checks.emailDelivery = {
    ok: canEmail,
    detail: canEmail
      ? undefined
      : "no sending domain, so the apply form falls back to the visitor's mail app and a renewal " +
        "licence cannot be delivered automatically",
  };
  checks.mcpPackagePublished = {
    ok: Boolean(process.env.PROOF_MCP_PACKAGE),
    detail: process.env.PROOF_MCP_PACKAGE
      ? undefined
      : "PROOF_MCP_PACKAGE is not set, so the welcome page shows the interim message instead of an install line",
  };

  /*
   * `readyToTakeMoney` is the only aggregate, and it is deliberately narrow: the
   * things without which a payment produces nothing usable. Email and the
   * published package are real gaps and are reported, but a customer can still
   * pay and collect a licence from the welcome page without either, so they do
   * not gate this flag. An aggregate that goes false for a known, accepted
   * limitation is an aggregate nobody reads.
   */
  const required = ["licenceSigning", "stripeKey", "stripeWebhookSecret", "plan:kept-sharp"];
  const readyToTakeMoney = required.every((k) => checks[k]?.ok);

  return NextResponse.json(
    {
      readyToTakeMoney,
      blocking: required.filter((k) => !checks[k]?.ok),
      checks,
      note:
        "Booleans and reasons only. This returns no key material, no price ids and no account id, " +
        "on purpose: anything that returns a value belongs behind authentication.",
    },
    { status: readyToTakeMoney ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
