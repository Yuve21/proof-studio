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
 * TOKEN FORMAT: `proof1.<base64url payload>.<base64url signature>`
 * The prefix is a version, not decoration: it means a future format can be
 * rejected loudly instead of being misread as a corrupt current one.
 */
import { verify as cryptoVerify, createPublicKey } from "node:crypto";

/** The format this build understands. A different prefix is refused, not guessed at. */
const TOKEN_PREFIX = "proof1";

/**
 * The issuing public key, in SPKI PEM. The matching private key never leaves the
 * billing system and is not in this repository.
 *
 * PLACEHOLDER, and it fails closed: until a real key is generated and pasted
 * here, `entitlement()` returns invalid with a reason that names this line, so
 * an unconfigured build cannot accidentally entitle anybody. Generate with:
 *   node -e "const {generateKeyPairSync}=require('node:crypto');
 *            const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 *            console.log(publicKey.export({type:'spki',format:'pem'}));
 *            console.log(privateKey.export({type:'pkcs8',format:'pem'}))"
 */
export const ISSUER_PUBLIC_KEY_PEM = "PLACEHOLDER_NOT_A_KEY";

const b64urlToBuffer = (s) => {
  // A strict alphabet check first: Buffer.from is lenient and will silently
  // discard characters it does not recognise, which turns a malformed token into
  // a differently-shaped valid-looking one.
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
};

const invalid = (reason) => ({ valid: false, reason, agents: [], customer: null, expires: null });

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
  const pem = opts.publicKeyPem ?? ISSUER_PUBLIC_KEY_PEM;

  if (pem === "PLACEHOLDER_NOT_A_KEY") {
    return invalid(
      "this build has no issuer public key compiled in (licence/verify.mjs, ISSUER_PUBLIC_KEY_PEM). " +
      "Failing closed rather than entitling anybody.",
    );
  }
  if (typeof token !== "string" || token.length === 0) return invalid("no licence token supplied");
  if (token.length > 8192) return invalid("licence token is implausibly long");

  const parts = token.trim().split(".");
  if (parts.length !== 3) return invalid("licence token is not three dot-separated segments");
  const [prefix, payloadB64, signatureB64] = parts;

  if (prefix !== TOKEN_PREFIX) {
    return invalid(
      `licence token format "${prefix}" is not "${TOKEN_PREFIX}", which this build understands. ` +
      `Refusing rather than guessing at it.`,
    );
  }

  const payloadBytes = b64urlToBuffer(payloadB64);
  const signature = b64urlToBuffer(signatureB64);
  if (!payloadBytes || payloadBytes.length === 0) return invalid("licence payload is not valid base64url");
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
  if (expiresAt.getTime() <= now.getTime()) {
    return invalid(`licence expired on ${expiresAt.toISOString()}`);
  }

  return {
    valid: true,
    reason: "licence verified offline against the issuer key; no network request was made",
    agents: [...agents],
    customer,
    expires: expiresAt.toISOString(),
  };
}
