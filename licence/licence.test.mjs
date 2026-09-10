/**
 * Licence tests. Run: node --test licence/
 *
 * THE STANDARD THESE ARE HELD TO: a test asserting an ABSENCE must first prove
 * the presence it is removing. The sibling product shipped two suites that
 * certified silence, an OCR fixture with no ink and a redaction corpus with no
 * email addresses, and both passed over empty inputs while guarding the product's
 * two worst failure modes. So every rejection test here first asserts that the
 * same token is ACCEPTED before the one thing under test is broken.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createPublicKey } from "node:crypto";
import { entitlement, GRACE_DAYS, ISSUER_PUBLIC_KEYS } from "./verify.mjs";
import { issue } from "./issue.mjs";
import { registrable, TIERS, loadRoster } from "./roster.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }).toString();
const PRIV = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const KEYS = { k1: PUB };

const FUTURE = new Date(Date.now() + 30 * 864e5);
const good = () =>
  issue({ customer: "cus_abc123", agents: ["tier-1"], expires: FUTURE, privateKeyPem: PRIV, keyId: "k1" });
const check = (token, over = {}) => entitlement(token, { publicKeys: KEYS, ...over });

// A fake roster, so these tests do not depend on the plan document's current
// contents. The plan is parsed for real in the roster test below.
const ROSTER = new Map(
  ["template-tells", "seo-technical", "accessibility", "claims-officer"].map((id) => [
    id,
    { id, kind: "D", blurb: "x" },
  ]),
);

test("a licence this issuer signed is accepted, and reports what it entitles", () => {
  const r = check(good());
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.customer, "cus_abc123");
  assert.deepEqual(r.agents, ["tier-1"]);
  assert.match(r.reason, /no network request/);
});

test("a token signed by a DIFFERENT key is refused as not ours", () => {
  // Presence first: the same shape of token from the real key is accepted.
  assert.equal(check(good()).valid, true);

  const other = generateKeyPairSync("ed25519");
  const forged = issue({
    customer: "cus_abc123",
    agents: ["tier-1"],
    expires: FUTURE,
    privateKeyPem: other.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    keyId: "k1",
  });
  const r = check(forged);
  assert.equal(r.valid, false);
  assert.match(r.reason, /was not issued by us/);
});

test("editing the payload after signing is refused, even though the JSON stays valid", () => {
  const token = good();
  assert.equal(check(token).valid, true, "presence: the unedited token is accepted");

  const [prefix, kid, payloadB64, sig] = token.split(".");
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  // The interesting tamper: not corruption, a PROMOTION. Same shape, more agents.
  payload.agents = ["tier-1", "seo-competitive", "margin-analyst"];
  const edited = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  // Sanity: the edited payload really is different and really is valid JSON.
  assert.notEqual(edited, payloadB64);
  assert.equal(JSON.parse(Buffer.from(edited, "base64url").toString("utf8")).agents.length, 3);

  const r = check(`${prefix}.${kid}.${edited}.${sig}`);
  assert.equal(r.valid, false);
  assert.match(r.reason, /signature does not match/);
});

test("extending the expiry by editing the token is refused", () => {
  const token = good();
  const [prefix, kid, payloadB64, sig] = token.split(".");
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  payload.expires = new Date(Date.now() + 3650 * 864e5).toISOString();
  const edited = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const r = check(`${prefix}.${kid}.${edited}.${sig}`);
  assert.equal(r.valid, false);
  assert.match(r.reason, /signature does not match/);
});

test("an expired licence is refused, and says expired rather than forged", () => {
  const token = good();
  // Presence first: valid now.
  assert.equal(check(token).valid, true);
  /*
   * Same token, clock moved past expiry AND past the grace window. Nothing about
   * the token changed, so this proves the expiry is checked rather than merely
   * present in the payload.
   *
   * This test previously used 31 days and went red the moment a grace period was
   * added, which is correct behaviour from a test: the product changed and the
   * assertion caught it. The fix is to move the clock past grace, NOT to relax
   * what is asserted. Grace itself is covered in operational.test.mjs, in both
   * directions.
   */
  const past = new Date(Date.now() + (30 + GRACE_DAYS + 1) * 864e5);
  const r = check(token, { now: past });
  assert.equal(r.valid, false);
  assert.match(r.reason, /expired on/);
});

test("a forged AND expired token reports the forgery, not the expiry", () => {
  const other = generateKeyPairSync("ed25519");
  const forged = issue({
    customer: "c",
    agents: ["tier-1"],
    expires: new Date(Date.now() + 60_000),
    privateKeyPem: other.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    keyId: "k1",
  });
  const r = check(forged, { now: new Date(Date.now() + 864e5) });
  assert.equal(r.valid, false);
  assert.match(r.reason, /not issued by us/, "signature is checked before expiry, deliberately");
});

test("retiring a key immediately refuses every token it signed", () => {
  /*
   * THE TEST THAT PROVES ROTATION IS A CAPABILITY AND NOT A FIELD.
   *
   * A key id in the payload is worth nothing on its own: the question is whether
   * removing a key from the trusted map actually stops the tokens it signed. So
   * this asserts the SAME token in both directions, changing only the map.
   *
   * This is also the one place offline verification beats a licence server. There
   * is no revocation list to fetch and no endpoint to be unreachable: a build that
   * does not carry the key cannot be talked into trusting it.
   */
  const token = good();
  // Presence first: with k1 trusted, this exact token works.
  assert.equal(entitlement(token, { publicKeys: { k1: PUB } }).valid, true);

  // Same token, k1 retired, a different key trusted instead.
  const k2 = generateKeyPairSync("ed25519");
  const rotated = { k2: k2.publicKey.export({ type: "spki", format: "pem" }).toString() };
  const r = entitlement(token, { publicKeys: rotated });
  assert.equal(r.valid, false);
  assert.match(r.reason, /does not trust/);
  assert.deepEqual(r.agents, [], "a retired key must entitle nothing");
});

test("two keys can be trusted at once, so rotation does not break existing tokens", () => {
  // The reason rotation is usable at all: during a changeover both keys are
  // trusted, old tokens keep working, and new ones are cut with the new key.
  const k2 = generateKeyPairSync("ed25519");
  const K2PUB = k2.publicKey.export({ type: "spki", format: "pem" }).toString();
  const K2PRIV = k2.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const both = { k1: PUB, k2: K2PUB };
  const oldToken = good();
  const newToken = issue({
    customer: "cus_new", agents: ["tier-1"], expires: FUTURE, privateKeyPem: K2PRIV, keyId: "k2",
  });

  const a = entitlement(oldToken, { publicKeys: both });
  const b = entitlement(newToken, { publicKeys: both });
  assert.equal(a.valid, true, a.reason);
  assert.equal(b.valid, true, b.reason);
  assert.equal(a.keyId, "k1");
  assert.equal(b.keyId, "k2");
  // And crossing them fails, which proves the id selects the key rather than
  // the verifier trying every key it has until one works.
  assert.equal(entitlement(oldToken, { publicKeys: { k2: K2PUB } }).valid, false);
  assert.equal(entitlement(newToken, { publicKeys: { k1: PUB } }).valid, false);
});

test("a token whose key id names a key signed by someone else is refused", () => {
  // The attack this closes: take a key id we DO trust and sign with your own key.
  const other = generateKeyPairSync("ed25519");
  const forged = issue({
    customer: "cus_abc123",
    agents: ["tier-1"],
    expires: FUTURE,
    privateKeyPem: other.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    keyId: "k1",
  });
  const r = entitlement(forged, { publicKeys: { k1: PUB } });
  assert.equal(r.valid, false);
  assert.match(r.reason, /not issued by us/);
});

test("a build with no issuer key compiled in entitles nobody", () => {
  /*
   * This used to read the default export, because the default WAS the
   * placeholder. A real key is now compiled in, so the empty map is injected
   * explicitly. The property under test has not changed and neither has the
   * assertion; only the way the state is reached.
   *
   * The alternative was to delete the test as "no longer reachable", which would
   * have removed the only check that an unconfigured build fails closed, on the
   * day that state stopped being the default and therefore stopped being noticed.
   */
  const r = entitlement(good(), { publicKeys: {} });
  assert.equal(r.valid, false);
  assert.match(r.reason, /no issuer public key/);
  assert.deepEqual(r.agents, []);
});

test("the key compiled into THIS build is present and is a real Ed25519 key", () => {
  /*
   * The check that catches shipping a build nobody can use. It cannot verify a
   * real token, because the private half is deliberately not in this repository,
   * so it verifies the two things it can: a key exists, and it is the right kind
   * of key for the algorithm this verifier hardcodes.
   *
   * Stated plainly: this does NOT prove the embedded key matches the private key
   * the billing system holds. Only issuing a token and verifying it does that,
   * and it was done by hand on 2026-09-09 against cus_demo_0001. If the two ever
   * diverge, every customer sees "this token was not issued by us", which is at
   * least the correct failure.
   */
  const ids = Object.keys(ISSUER_PUBLIC_KEYS);
  assert.ok(ids.length >= 1, "a shipped build with no issuer key entitles nobody");
  for (const id of ids) {
    assert.match(id, /^[a-z0-9][a-z0-9_-]{0,31}$/, `key id ${id} is not a plausible id`);
    const pem = ISSUER_PUBLIC_KEYS[id];
    assert.ok(pem.includes("BEGIN PUBLIC KEY"), `key ${id} is not a PEM public key`);
    const key = createPublicKey(pem);
    assert.equal(key.asymmetricKeyType, "ed25519", `key ${id} is not ed25519`);
  }
  // And a token signed by a key we do NOT hold is refused under the real map,
  // so the embedded key is actually being used rather than bypassed.
  const r = entitlement(good());
  assert.equal(r.valid, false);
  assert.match(r.reason, /not issued by us/);
});

test("a corrupt issuer key entitles NOBODY, rather than everybody", () => {
  /*
   * FOUND BY MUTATION, and it was the only survivor of five.
   *
   * Replacing the catch block's `return invalid(...)` with `signatureOk = true`
   * left all fourteen other tests green, because not one of them reached the
   * try/catch: every malformed token was already refused by the structural checks
   * above it (alphabet, segment count, signature length). So the catch that turns
   * a crypto exception into a refusal was completely untested, in the one place
   * where failing open hands out free licences.
   *
   * This drives a real exception into it. A syntactically PEM-shaped key with
   * garbage inside gets past the placeholder check and throws inside
   * createPublicKey. The correct answer is a refusal naming the problem. The
   * dangerous answer is a pass, and a misconfigured deploy is a much more likely
   * way to reach this line than an attacker is.
   */
  // Built by join rather than with escapes, so the literal cannot be broken
  // by a shell layer on the way into this file, which is how it broke once.
  const CORRUPT = ["-----BEGIN PUBLIC KEY-----", "bm90IGEga2V5", "-----END PUBLIC KEY-----", ""].join(String.fromCharCode(10));
  const token = good();
  // Presence first: with the real key this exact token is accepted.
  assert.equal(check(token).valid, true);

  const r = entitlement(token, { publicKeys: { k1: CORRUPT } });
  assert.equal(r.valid, false, "a corrupt issuer key must refuse, never entitle");
  assert.deepEqual(r.agents, []);
  assert.match(r.reason, /could not be checked/);
});

test("malformed tokens are each refused with their own reason", () => {
  const cases = [
    ["", /no licence token/],
    ["nonsense", /four dot-separated/],
    ["a.b.c", /four dot-separated/],
    ["proof2.k1.aaaa.bbbb", /is not "proof1"/],
    ["proof1.k1.!!!!.bbbb", /not valid base64url/],
    ["proof1.k1.eyJhIjoxfQ.short", /64-byte Ed25519/],
    ["proof1.NOPE!.aaaa.bbbb", /key id is not a plausible id/],
  ];
  for (const [token, re] of cases) {
    const r = check(token);
    assert.equal(r.valid, false, `expected refusal for ${JSON.stringify(token)}`);
    assert.match(r.reason, re, `wrong reason for ${JSON.stringify(token)}`);
  }
  // And the denominator: the accepted token still passes, so the above is not
  // "everything is refused".
  assert.equal(check(good()).valid, true);
});

test("a signed payload missing required fields is refused after the signature passes", () => {
  // This is the case that proves signature and CONTENT are separate checks. The
  // token is genuinely ours; the payload is useless.
  const token = issue({ customer: "c", agents: ["tier-1"], expires: FUTURE, privateKeyPem: PRIV, keyId: "k1" });
  assert.equal(check(token).valid, true);

  // Build a legitimately-signed token whose payload has no agents, by signing
  // directly rather than going through issue(), which refuses it at the door.
  const payload = Buffer.from(JSON.stringify({ v: 1, customer: "c", agents: [], expires: FUTURE.toISOString() }));
  const sig = sign(null, payload, privateKey);
  const b = (x) => x.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const r = check(`proof1.k1.${b(payload)}.${b(sig)}`);
  assert.equal(r.valid, false);
  assert.match(r.reason, /entitles no agents/);
});

test("a payload re-encoded with different whitespace is refused, same signature", () => {
  /*
   * THE TEST THAT DISTINGUISHES A CORRECT VERIFIER FROM A SUBTLY BROKEN ONE, and
   * the reason it is worth its length.
   *
   * A verifier that parses the payload, re-serialises it, and checks the
   * signature over the RE-SERIALISATION accepts this token, because stringifying
   * the pretty-printed JSON gives back the compact bytes that were signed. The
   * attacker then controls the difference between what was verified and what
   * gets read. It is the same family as the JWT confusion bugs.
   *
   * A verifier that checks the signature over the bytes that ARRIVED refuses it,
   * because those bytes are not the bytes that were signed. Nothing semantic
   * changed, which is exactly why this is the discriminating case: no other test
   * here tells the two implementations apart.
   */
  const token = good();
  const [prefix, kid, payloadB64, sig] = token.split(".");
  const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

  // Same object, two spaces of indentation. Semantically identical, different bytes.
  const pretty = Buffer.from(JSON.stringify(parsed, null, 2), "utf8").toString("base64url");
  assert.notEqual(pretty, payloadB64, "the re-encoding must actually differ, or this proves nothing");
  assert.deepEqual(
    JSON.parse(Buffer.from(pretty, "base64url").toString("utf8")),
    parsed,
    "and it must still parse to the same object, or it is testing corruption instead",
  );

  const r = check(`${prefix}.${kid}.${pretty}.${sig}`);
  assert.equal(r.valid, false, "a re-encoded payload must be refused: the signature covers bytes, not meaning");
  assert.match(r.reason, /signature does not match/);
});

test("issuing refuses an expired date and an email as the customer id", () => {
  assert.throws(
    () => issue({ customer: "c", agents: ["tier-1"], expires: new Date(Date.now() - 1000), privateKeyPem: PRIV, keyId: "k1" }),
    /expires is in the past/,
  );
  assert.throws(
    () => issue({ customer: "someone@example.com", agents: ["tier-1"], expires: FUTURE, privateKeyPem: PRIV, keyId: "k1" }),
    /not an email address/,
  );
});

test("registrable expands a tier and returns only agents the roster defines", () => {
  const { agents, licence, unknown } = registrable(good(), { publicKeys: KEYS, roster: ROSTER });
  assert.equal(licence.valid, true);
  // tier-1 has 12 members; this fake roster defines 4 of them, so 4 come back and
  // the other 8 are reported as unknown rather than vanishing.
  assert.equal(TIERS["tier-1"].length, 12);
  assert.equal(agents.length, 4);
  assert.equal(unknown.length, 8);
  assert.deepEqual(agents.map((a) => a.id), ["accessibility", "claims-officer", "seo-technical", "template-tells"]);
});

test("an INVALID licence registers zero agents, which is the unbypassable part", () => {
  const { agents } = registrable("proof1.k1.garbage.garbage", { publicKeys: KEYS, roster: ROSTER });
  assert.deepEqual(agents, [], "an unentitled agent must be ABSENT, not present and refused");
});

test("the real plan document parses into exactly 62 seats", () => {
  const roster = loadRoster("docs/AGENT-ROSTER-PLAN.md");
  assert.equal(roster.size, 62);
  // Absolute members, not just a count, so shrinking the plan and the assertion
  // together is still caught.
  for (const id of TIERS["tier-1"]) {
    assert.ok(roster.has(id), `tier-1 names ${id}, which the plan does not define`);
  }
});
