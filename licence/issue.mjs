/**
 * Licence issuing. THIS FILE MUST NEVER SHIP TO A CUSTOMER.
 *
 * It signs with the issuer private key, so it belongs to the billing system and
 * nothing else. It lives beside the verifier because the two have to agree byte
 * for byte about the token format, and separating them into different
 * repositories is how they drift.
 *
 * The boundary is enforced, not remembered: scripts/check-licence-boundary.mjs
 * fails the build if this module is reachable from anything the MCP package
 * bundles. The sibling product learned that one the expensive way. Its published
 * MCP bundle contained the entire private reproduction pipeline, dragged in three
 * hops deep through a barrel, invisible in the dependency manifest and visible
 * only in the bundler's graph. A private/public boundary expressed only as a
 * convention is not enforced.
 */
import { sign as cryptoSign, createPrivateKey } from "node:crypto";

const TOKEN_PREFIX = "proof1";

const toB64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Issue a licence.
 *
 * @param {object} args
 * @param {string} args.customer stable customer id, never an email
 * @param {string[]} args.agents agent ids or tier names
 * @param {Date} args.expires when it stops working
 * @param {string} args.privateKeyPem PKCS8 PEM, from the billing system's secret store
 * @returns {string} the token to hand the customer
 */
export function issue({ customer, agents, expires, privateKeyPem }) {
  if (typeof customer !== "string" || !customer) throw new Error("issue: customer is required");
  if (!Array.isArray(agents) || agents.length === 0) throw new Error("issue: agents must be non-empty");
  if (!(expires instanceof Date) || Number.isNaN(expires.getTime())) {
    throw new Error("issue: expires must be a valid Date");
  }
  if (expires.getTime() <= Date.now()) {
    // Issuing an already-expired licence is always a mistake and it presents to
    // the customer as "your purchase does not work", so it is refused here rather
    // than being discovered by them.
    throw new Error("issue: expires is in the past");
  }
  if (typeof privateKeyPem !== "string" || !privateKeyPem.includes("PRIVATE KEY")) {
    throw new Error("issue: privateKeyPem does not look like a PEM private key");
  }

  // The customer id must not be an email address. A licence token travels in
  // support threads and config files, and an email in it is a deanonymisation
  // surface for no benefit.
  if (/@/.test(customer)) throw new Error("issue: customer must be an opaque id, not an email address");

  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      customer,
      agents: [...agents],
      issued: new Date().toISOString(),
      expires: expires.toISOString(),
    }),
    "utf8",
  );

  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`issue: key is ${key.asymmetricKeyType}, not ed25519`);
  }
  const signature = cryptoSign(null, payload, key);

  return `${TOKEN_PREFIX}.${toB64url(payload)}.${toB64url(signature)}`;
}
