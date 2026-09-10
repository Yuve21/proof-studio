/**
 * Offline licence verification. This module SHIPS TO THE CUSTOMER inside the MCP
 * server, so read it as code a stranger can and will read.
 *
 * WHY OFFLINE, AND IT IS NOT A COMPROMISE.
 *
 * The deterministic foundation this product is built on forbids network egress as
 * a code invariant, enforced by a gate that fails closed across 273 files and
 * bans "update checks" by name. A licence that phones home would break a privacy
 * guarantee that is a PRODUCT claim, on the one package that runs inside somebody
 * else's repository. So a licence is a signed token, verified here against a
 * public key compiled into this file, and this server makes no network request of
 * any kind. The customer can verify that themselves, which is the point.
 *
 * The cost of offline is that revocation cannot be immediate: a valid token stays
 * valid until it expires. That is priced in by keeping the window short and
 * renewing, and it is written down here rather than discovered later.
 *
 * FIVE WAYS THIS COULD REPORT SUCCESS WITHOUT DOING ITS JOB, and what stops each.
 * Every one of these is a real defect that has shipped in real products.
 *
 *  1. VERIFYING A RE-SERIALISED PAYLOAD instead of the bytes that arrived. If you
 *     parse the JSON, then re-stringify it, then check the signature over that,
 *     an attacker controls the difference between the two encodings. The
 *     signature here is checked over the EXACT received bytes of the payload
 *     segment, before anything parses them.
 *  2. READING THE ALGORITHM FROM THE TOKEN. The classic JWT break: the token says
 *     `alg: none` and the verifier obliges. There is no algorithm field here.
 *     Ed25519 is hardcoded and a token claiming anything else is not expressible.
 *  3. A CATCH THAT SWALLOWS THE FAILURE. A try/catch around verification that
 *     returns a truthy result on error is a guard whose throw is discarded. The
 *     sibling product shipped exactly that inside its own privacy mechanism on
 *     the day it was written. Here every failure path returns an explicit
 *     { valid: false, reason } and there is no code path that returns valid on an
 *     exception.
 *  4. CHECKING THE SIGNATURE BUT NOT THE EXPIRY, or the reverse. Both are checked,
 *     in that order, and the order matters: an expired token with a bad signature
 *     should report the signature, because "expired" invites a renewal attempt
 *     while "forged" does not.
 *  5. BEING A FUNCTION NOBODY CALLS. The worst of the five and the least visible.
 *     This module deliberately does NOT export a "checkLicence" that a tool
 *     handler is supposed to remember to call. It exports `entitlement`, and the
 *     server builds its agent registry FROM the returned list, so an unentitled
 *     agent is not registered rather than being registered and refused. There is
 *     no per-call check to forget. See licence/roster.mjs.
 *
 * TOKEN FORMAT: `proof1.<key id>.<base64url payload>.<base64url signature>`
 * The prefix is a version, not decoration: it means a future format can be
 * rejected loudly instead of being misread as a corrupt current one.
 */
import { verify as cryptoVerify, createPublicKey } from "node:crypto";

/** The format this build understands. A different prefix is refused, not guessed at. */
const TOKEN_PREFIX = "proof1";

/**
 * Days past expiry during which a licence still works, loudly.
 *
 * WHY A GRACE PERIOD EXISTS AT ALL. Because of how this fails without one, which
 * is the opposite of loudly: an unentitled agent is ABSENT by construction, so
 * there is no per-call check to throw and nothing to print. What the customer
 * experiences at midnight on day 31 is their slash commands silently
 * disappearing. That is the worst possible presentation of "your card expired".
 *
 * So for these days past expiry the agents stay registered and every response
 * carries the expiry and the renewal step, which puts the problem in front of the
 * customer inside the flow they are already in.
 *
 * THE LENGTH IS A FOUNDER DECISION and 7 is a default, not an answer. It trades
 * revenue leakage against support load, and it is the one number here that wants
 * a real billing cycle behind it.
 */
export const GRACE_DAYS = 7;

/** Days before expiry at which responses start warning. */
export const WARN_DAYS = 7;

const DAY = 86_400_000;

/**
 * The issuing public keys, by key id. The matching PRIVATE keys never leave the
 * billing system and are not in this repository.
 *
 * WHY THIS IS A MAP AND NOT ONE KEY, since it was one key an hour ago.
 *
 * There is exactly ONE issuer, not one per customer. A private key is the thing
 * that GRANTS entitlement, so a customer holding one could sign themselves any
 * agent list and any expiry, which is the opposite of a licence. What is
 * per-customer is the TOKEN: their own customer id, agents and expiry, signed by
 * us. If one token leaks, only that token is affected.
 *
 * What a single key could NOT do is rotate. If it leaked, every token ever issued
 * would have to be re-cut and every install re-configured, and there would be no
 * way to keep old tokens working while new ones used a fresh key. So every token
 * names the key that signed it, this map holds every key still trusted, and
 * retiring one is a deletion from this object.
 *
 * RETIRING A KEY IS IMMEDIATE AND TOTAL, which is the one place offline
 * verification is stronger than a licence server: a build that does not carry the
 * key cannot be talked into trusting it.
 *
 * PLACEHOLDER, and it fails closed: with no real key here `entitlement()` returns
 * invalid with a reason naming this line, so an unconfigured build cannot
 * accidentally entitle anybody. Generate a keypair with:
 *
 *   node -e "const{generateKeyPairSync}=require('node:crypto');const k=generateKeyPairSync('ed25519');console.log(k.publicKey.export({type:'spki',format:'pem'}));console.log(k.privateKey.export({type:'pkcs8',format:'pem'}))"
 *
 * The public half goes here under a new id. The private half goes to the billing
 * system's secret store and nowhere else, never into this repository.
 */
export const ISSUER_PUBLIC_KEYS = {
  // k1, generated 2026-09-09. The matching private key lives OUTSIDE this
  // repository and is not in version control. To rotate: generate a new pair,
  // add it here as k2, cut new tokens with k2, and delete k1 once the last k1
  // token has expired. Retiring a key is a deletion from this object and it is
  // immediate: a build that does not carry the key cannot be talked into
  // trusting it.
  //
  // Written as a template literal so the PEM keeps its real newlines. An
  // escaped example broke this literal three times in one session
  // (docs/LEARNINGS.md P-04), which is why nothing here is escaped.
  k1: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAy1MvndiQt12C12KF1eEhopo53zPCFwjEh2VDwqynxL0=
-----END PUBLIC KEY-----
`,
};

const b64urlToBuffer = (s) => {
  // A strict alphabet check first: Buffer.from is lenient and will silently
  // discard characters it does not recognise, which turns a malformed token into
  // a differently-shaped valid-looking one.
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
};

const invalid = (reason) => ({
  valid: false, reason, agents: [], customer: null, expires: null, keyId: null,
  grace: null, expiringSoon: null,
});

/**
 * Verify a licence token and return what it entitles.
 *
 * @param {string} token the licence string the customer was given
 * @param {object} [opts]
 * @param {Date}   [opts.now] injected clock, for tests. Defaults to real time.
 * @param {string} [opts.publicKeyPem] injected key, for tests.
 * @returns {{valid: boolean, reason: string, agents: string[], customer: string|null, expires: string|null}}
 */
export function entitlement(token, opts = {}) {
  const now = opts.now ?? new Date();
  const keys = opts.publicKeys ?? ISSUER_PUBLIC_KEYS;

  if (Object.keys(keys).length === 0) {
    return invalid(
      "this build has no issuer public key compiled in (licence/verify.mjs, ISSUER_PUBLIC_KEYS). " +
      "Failing closed rather than entitling anybody.",
    );
  }
  if (typeof token !== "string" || token.length === 0) return invalid("no licence token supplied");
  if (token.length > 8192) return invalid("licence token is implausibly long");

  /*
   * WHITESPACE AND WRAPPERS, and this is the first support ticket rather than a
   * theoretical one.
   *
   * A tier-1 token is 256 characters (measured). Mail clients and chat apps wrap
   * at 72 to 80, so the token a customer pastes very often has a newline in the
   * middle of it. base64url has no legitimate whitespace, so removing all of it
   * loses nothing and rescues the common case.
   *
   * What was actually wrong before was not the strictness, it was the REASON. A
   * wrapped token reported "payload is not valid base64url", which names the
   * encoding rather than the cause, so the customer has no idea that the fix is
   * "paste it as one line". A guard whose message does not identify the mistake
   * gets a support thread instead of a self-service fix.
   *
   * Same treatment for the two other things people paste: the env var name in
   * front of it, and the quotes around it.
   */
  let cleaned = token.trim();
  const hadInnerWhitespace = /\s/.test(cleaned);
  cleaned = cleaned.replace(/\s+/g, "");

  if (/^["']|["']$/.test(cleaned)) {
    return invalid(
      "the licence token still has quotes around it. Paste the token itself, without the quote marks.",
    );
  }
  const namePrefix = cleaned.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (namePrefix) {
    return invalid(
      `the licence token still has "${namePrefix[1]}=" in front of it. Paste only the value after ` +
      `the equals sign.`,
    );
  }

  const parts = cleaned.split(".");
  if (parts.length !== 4) {
    return invalid("licence token is not four dot-separated segments (prefix, key id, payload, signature)");
  }
  const [prefix, kid, payloadB64, signatureB64] = parts;

  if (prefix !== TOKEN_PREFIX) {
    return invalid(
      `licence token format "${prefix}" is not "${TOKEN_PREFIX}", which this build understands. ` +
      `Refusing rather than guessing at it.`,
    );
  }

  // The key id selects which trusted key to use. It does NOT select an algorithm
  // and it cannot introduce a key: an id we do not carry is a refusal, so a token
  // signed by a retired or unknown key verifies against nothing.
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(kid)) return invalid("licence key id is not a plausible id");
  const pem = Object.prototype.hasOwnProperty.call(keys, kid) ? keys[kid] : null;
  if (!pem) {
    return invalid(
      `licence names key id "${kid}", which this build does not trust. Either it was signed by a ` +
      `retired key or it was not issued by us.`,
    );
  }

  const payloadBytes = b64urlToBuffer(payloadB64);
  const signature = b64urlToBuffer(signatureB64);
  if (!payloadBytes || payloadBytes.length === 0) {
    return invalid(
      "licence payload is not valid base64url" +
      (hadInnerWhitespace
        ? ". The token you pasted contained a line break or space, which usually means an email or " +
          "chat client wrapped it. Whitespace was removed and it still did not decode, so some of " +
          "the token is probably missing: copy the whole thing again."
        : ""),
    );
  }
  if (!signature || signature.length !== 64) {
    return invalid("licence signature is not a 64-byte Ed25519 signature");
  }

  // (1) The signature is checked over the EXACT bytes received, before any parse.
  // (2) The algorithm is not read from the token; Ed25519 is implied by the key
  //     type and passing null here is how node names it.
  let signatureOk = false;
  try {
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType !== "ed25519") {
      return invalid(`issuer key is ${key.asymmetricKeyType}, not ed25519`);
    }
    signatureOk = cryptoVerify(null, payloadBytes, key, signature);
  } catch (err) {
    // (3) An exception here means a malformed key or signature. It is a FAILURE,
    // never a pass, and the reason is surfaced rather than swallowed.
    return invalid(`licence signature could not be checked: ${err.message}`);
  }
  if (!signatureOk) {
    return invalid("licence signature does not match the issuer key: this token was not issued by us");
  }

  // Only now is the payload trusted enough to parse.
  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return invalid("licence payload is signed but is not valid JSON");
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return invalid("licence payload is signed but is not an object");
  }

  const { customer, agents, expires } = payload;
  if (typeof customer !== "string" || !customer) return invalid("licence names no customer");
  if (!Array.isArray(agents) || agents.length === 0) return invalid("licence entitles no agents");
  if (!agents.every((a) => typeof a === "string" && /^[a-z][a-z0-9-]{1,60}$/.test(a))) {
    return invalid("licence entitles an agent id that is not a plausible id");
  }
  if (typeof expires !== "string") return invalid("licence has no expiry");

  const expiresAt = new Date(expires);
  if (Number.isNaN(expiresAt.getTime())) return invalid("licence expiry is not a parseable date");

  // (4) Expiry is checked as well as the signature, and after it, so a forged
  // token reports forgery rather than inviting a renewal.
  const msPastExpiry = now.getTime() - expiresAt.getTime();
  const graceEndsAt = new Date(expiresAt.getTime() + GRACE_DAYS * DAY);

  if (msPastExpiry > GRACE_DAYS * DAY) {
    return invalid(
      `licence expired on ${expiresAt.toISOString()} and the ${GRACE_DAYS}-day grace period ended ` +
      `on ${graceEndsAt.toISOString()}. Renewing issues a new token.`,
    );
  }

  const inGrace = msPastExpiry > 0;
  const daysLeft = Math.ceil(-msPastExpiry / DAY);

  return {
    valid: true,
    reason: inGrace
      ? `licence EXPIRED on ${expiresAt.toISOString()} and is inside its ${GRACE_DAYS}-day grace ` +
        `period, which ends on ${graceEndsAt.toISOString()}. Renew to keep the team working.`
      : "licence verified offline against the issuer key; no network request was made",
    agents: [...agents],
    customer,
    expires: expiresAt.toISOString(),
    keyId: kid,
    // Both of these exist so the server can put the state in front of the
    // customer. A licence that is about to stop working, or has already stopped
    // and is only alive on grace, must not present identically to a healthy one.
    // floor, not ceil: something 1.0001 days past expiry is "1 day ago", and ceil
    // reported 2. A number shown to a customer that is consistently one too high
    // is a small wrongness that erodes trust in the rest of the message.
    grace: inGrace ? { daysPastExpiry: Math.floor(msPastExpiry / DAY), endsAt: graceEndsAt.toISOString() } : null,
    expiringSoon: !inGrace && daysLeft <= WARN_DAYS ? { daysLeft } : null,
  };
}
