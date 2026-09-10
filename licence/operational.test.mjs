/**
 * Licence tests, part two: what happens to a real customer.
 *
 * `licence.test.mjs` covers forgery, tampering and key rotation. This file covers
 * the mistakes and lifecycle events that generate support tickets, and every case
 * in it was found by an improvement pass RUNNING the verifier against what people
 * actually paste, not by reading it.
 *
 * Same standard: a test asserting an absence first proves the presence it is
 * removing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { entitlement, GRACE_DAYS, WARN_DAYS } from "./verify.mjs";
import { issue } from "./issue.mjs";
import { registrable, TIERS, loadRoster } from "./roster.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }).toString();
const PRIV = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const KEYS = { k1: PUB };

const DAY = 864e5;
const FUTURE = new Date(Date.now() + 30 * DAY);
const good = () =>
  issue({ customer: "cus_abc123", agents: ["tier-1"], expires: FUTURE, privateKeyPem: PRIV, keyId: "k1" });
const check = (token, over = {}) => entitlement(token, { publicKeys: KEYS, ...over });

const ROSTER = new Map(
  ["template-tells", "seo-technical", "accessibility", "claims-officer"].map((id) => [
    id,
    { id, kind: "D", blurb: "x" },
  ]),
);

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

test("a token an email client wrapped is accepted, because base64url has no whitespace", () => {
  // The first support ticket, measured rather than guessed: a tier-1 token is 256
  // characters and mail clients wrap at 72 to 80, so the token a customer pastes
  // very often has a newline in the middle of it.
  const token = good();
  /*
   * A RANGE, not an exact number, and the first version of this got it wrong.
   * Token length depends on the customer id length: 256 characters for "cus_1",
   * 263 for "cus_abc123". What the wrap assumption actually needs is only that
   * the token is comfortably longer than where mail clients break lines, which is
   * 72 to 80. Asserting an exact length would pin an irrelevant detail and go red
   * on a longer customer id.
   */
  assert.ok(token.length > 200, `token is ${token.length} chars, expected well over a wrap width`);

  const cases = [
    ["newline at 76", token.slice(0, 76) + NL + token.slice(76)],
    ["space at 120", token.slice(0, 120) + " " + token.slice(120)],
    ["CRLF then newline", token.slice(0, 76) + CR + NL + token.slice(76, 152) + NL + token.slice(152)],
    ["leading and trailing blanks", "  " + NL + token + NL + "  "],
  ];
  for (const [label, t] of cases) {
    const r = check(t);
    assert.equal(r.valid, true, `a token broken by ${label} must still verify: ${r.reason}`);
    assert.equal(r.customer, "cus_abc123");
  }
});

test("the two other things people paste get NAMED, not reported as bad base64", () => {
  // The point of these is the MESSAGE. A guard whose reason does not identify the
  // mistake produces a support thread instead of a self-service fix, so the
  // assertion is on the wording and not only on the refusal.
  const token = good();
  assert.equal(check(token).valid, true, "presence: the bare token works");

  const quoted = check(String.fromCharCode(34) + token + String.fromCharCode(34));
  assert.equal(quoted.valid, false);
  assert.match(quoted.reason, /has quotes around it/);

  const prefixed = check("PROOF_LICENCE=" + token);
  assert.equal(prefixed.valid, false);
  assert.match(prefixed.reason, /in front of it/);
  assert.match(prefixed.reason, /PROOF_LICENCE/);
});

test("a token that is BOTH wrapped and truncated says it is probably incomplete", () => {
  // The case where stripping whitespace is not enough. Removing it must not turn
  // "you lost half the token" into a bare encoding error.
  const token = good();
  const [prefix, kid, payload, sig] = token.split(".");
  const broken = prefix + "." + kid + "." + payload.slice(0, 20) + " !" + "." + sig;
  const r = check(broken);
  assert.equal(r.valid, false);
  assert.match(r.reason, /line break or space/);
  assert.match(r.reason, /probably missing/);
});

test("an expired licence keeps working inside grace, and is visibly not healthy", () => {
  /*
   * WHY GRACE EXISTS AT ALL, and it is not generosity.
   *
   * Without it, an unentitled agent is ABSENT by construction, so there is no
   * check to throw and nothing to print. What the customer experiences at
   * midnight on the expiry date is their slash commands silently disappearing,
   * which is the worst possible presentation of "your card expired". Inside grace
   * the agents stay registered and every response carries the reason.
   */
  const token = good();
  const dayAfter = new Date(Date.now() + 31 * DAY);
  const r = check(token, { now: dayAfter });

  assert.equal(r.valid, true, "inside grace the licence still works");
  assert.ok(r.grace, "and it must be VISIBLY in grace, not indistinguishable from healthy");
  assert.equal(r.grace.daysPastExpiry, 1);
  assert.match(r.reason, /EXPIRED on/);
  assert.match(r.reason, new RegExp(GRACE_DAYS + "-day grace"));

  // The agents are genuinely still registered, which is the whole point.
  const reg = registrable(token, { publicKeys: KEYS, roster: ROSTER, now: dayAfter });
  assert.ok(reg.agents.length > 0, "grace that registers nothing is not grace");
  assert.equal(reg.status, "ok");
});

test("grace ENDS, and the licence stops the moment it does", () => {
  const token = good();
  // Presence first: alive on the last day of grace, so this proves the window
  // really is GRACE_DAYS long rather than merely non-zero.
  const lastDay = new Date(Date.now() + (30 + GRACE_DAYS) * DAY - 1000);
  assert.equal(check(token, { now: lastDay }).valid, true, "grace must actually last GRACE_DAYS");

  const afterGrace = new Date(Date.now() + (30 + GRACE_DAYS) * DAY + 2000);
  const r = check(token, { now: afterGrace });
  assert.equal(r.valid, false);
  assert.match(r.reason, /grace period ended/);
  assert.deepEqual(r.agents, []);

  const reg = registrable(token, { publicKeys: KEYS, roster: ROSTER, now: afterGrace });
  assert.deepEqual(reg.agents, []);
  assert.equal(reg.status, "unlicensed");
});

test("a licence inside the warning window says how many days are left, and otherwise stays quiet", () => {
  const token = good();
  assert.equal(check(token).expiringSoon, null, "a licence with a month left must not cry wolf");

  const nearEnd = new Date(Date.now() + (30 - 3) * DAY);
  const r = check(token, { now: nearEnd });
  assert.equal(r.valid, true);
  assert.ok(r.expiringSoon, "inside the warning window this must be set");
  assert.equal(r.expiringSoon.daysLeft, 3);
  assert.ok(WARN_DAYS >= 3, "the fixture assumes 3 days is inside the window");
});

test("the five tiers PARTITION the roster: every seat in exactly one, none invented", () => {
  /*
   * The check that would have caught the tier-2 defect before a customer did.
   *
   * TIERS and the plan document are written in different files for different
   * purposes and neither derives from the other, so comparing them is a real
   * comparison rather than arr.map(f).length === arr.length. Compared in BOTH
   * directions, because a seat with no tier and a tier naming a seat that does
   * not exist are opposite bugs wearing the same clothes.
   */
  const roster = loadRoster("docs/AGENT-ROSTER-PLAN.md");
  const tiered = Object.values(TIERS).flat();

  assert.equal(roster.size, 60);
  assert.equal(tiered.length, 60, "the tiers must account for every seat exactly once");

  const dupes = tiered.filter((v, i) => tiered.indexOf(v) !== i);
  assert.deepEqual(dupes, [], "a seat in two tiers is entitled twice and shipped once");

  const untiered = [...roster.keys()].filter((id) => !tiered.includes(id));
  assert.deepEqual(untiered, [], "a seat with no tier can never be sold");

  const phantom = tiered.filter((id) => !roster.has(id));
  assert.deepEqual(phantom, [], "a tier naming a seat the plan does not define entitles nothing");

  // Absolute sizes too, so shrinking both lists together is still caught.
  assert.deepEqual(
    Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.length])),
    { "tier-1": 11, "tier-2": 14, "tier-3": 7, "tier-4": 16, "tier-5": 12 },
  );
});

test("a licence that entitles NOTHING is its own state, not a variety of working", () => {
  /*
   * MEASURED DEFECT, now pinned. With only tier-1 defined, a valid tier-2 licence
   * returned valid:true with zero agents, and nothing in the answer said anything
   * was wrong. A customer who paid would have had a working licence and an empty
   * server, and the licence layer would have reported success.
   */
  const token = issue({
    customer: "cus_x",
    agents: ["tier-9-does-not-exist"],
    expires: FUTURE,
    privateKeyPem: PRIV,
    keyId: "k1",
  });
  const r = registrable(token, { publicKeys: KEYS, roster: ROSTER });
  assert.equal(r.licence.valid, true, "the token itself is genuinely ours and genuinely unexpired");
  assert.deepEqual(r.agents, []);
  assert.deepEqual(r.unknown, ["tier-9-does-not-exist"]);
  assert.equal(r.status, "entitles-nothing", "this must NOT read as ok");
});

test("every tier registers its full membership, which tier-2 did not before", () => {
  const roster = loadRoster("docs/AGENT-ROSTER-PLAN.md");
  for (const tier of Object.keys(TIERS)) {
    const token = issue({
      customer: "cus_t", agents: [tier], expires: FUTURE, privateKeyPem: PRIV, keyId: "k1",
    });
    const r = registrable(token, { publicKeys: KEYS, roster });
    assert.equal(r.status, "ok", `${tier} must register agents`);
    assert.equal(r.agents.length, TIERS[tier].length, `${tier} must register all of its seats`);
    assert.deepEqual(r.unknown, [], `${tier} must name no seat the roster lacks`);
  }
});
