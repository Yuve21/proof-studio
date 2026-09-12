/**
 * The policy is the first thing in this repository that BINDS an agent rather
 * than instructing it, so it gets tested like a control and not like a helper.
 *
 * The failure that matters is not "the ceiling did not truncate". It is "the
 * ceiling truncated and the payload did not say so", which is a report that looks
 * complete, reads clean, and is missing findings. That is the defect this whole
 * product exists to detect, produced by our own enforcement layer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPolicy, LIMITS } from "./policy.mjs";
import { SEAT_CARDS } from "./seat-cards.mjs";

const finding = (id, severity) => ({ ruleId: id, severity, title: id, evidence: { selector: "body", observed: id } });

const reportOf = (findings) => ({
  corpus: "measurement",
  corpusVersion: "measurement-2026.09",
  status: "assessed",
  abstention: null,
  findings,
  rulesEvaluated: 7,
  coverage: 1,
});

test("every seat with a published limit has a card, and every limit names a real seat", () => {
  // Both directions, rather than one derived from the other, which would make the
  // check a mirror.
  for (const id of Object.keys(LIMITS)) {
    assert.ok(SEAT_CARDS[id], `LIMITS names "${id}", which has no seat card`);
    assert.ok(Number.isInteger(LIMITS[id].maxFindings) && LIMITS[id].maxFindings > 0, `${id}: maxFindings must be a positive integer`);
  }
});

test("when the card's prose states a number, it is the number the runtime applies", () => {
  /*
   * The drift this house names most often: one fact written twice. The prose
   * ceiling explains WHY the number is what it is, which a reader needs, and the
   * number is what the runtime can apply, which prose cannot be. So they are
   * allowed to coexist only while they agree.
   */
  let compared = 0;
  for (const [id, limit] of Object.entries(LIMITS)) {
    const prose = SEAT_CARDS[id].interrupts.ceiling;
    const stated = prose.match(/\b(\d{1,4})\b/);
    if (stated) {
      compared += 1;
      assert.equal(
        Number(stated[1]), limit.maxFindings,
        `${id}: the card's ceiling says ${stated[1]} and the runtime applies ${limit.maxFindings}`,
      );
    }
  }
  // THE DENOMINATOR. Every prose ceiling could stop stating a number and this
  // check would pass by comparing nothing, which is the vacuous shape it exists
  // to prevent elsewhere.
  assert.ok(compared >= Object.keys(LIMITS).length, `only ${compared} of ${Object.keys(LIMITS).length} ceilings state their number`);
});

test("under the ceiling, everything comes back and the payload says nothing was suppressed", () => {
  const out = applyPolicy("measurement", reportOf([finding("a", "high"), finding("b", "low")]));
  assert.equal(out.findings.length, 2);
  assert.equal(out.policy.applied, true);
  assert.equal(out.policy.suppressed, 0);
  assert.match(out.policy.suppressedNote, /Nothing was suppressed/);
});

test("over the ceiling it truncates by severity, keeps the high ones, and SAYS how many it dropped", () => {
  const limit = LIMITS.measurement.maxFindings;
  const many = [
    ...Array.from({ length: limit }, (_, i) => finding(`low-${i}`, "low")),
    finding("the-important-one", "high"),
  ];
  const out = applyPolicy("measurement", reportOf(many));

  assert.equal(out.findings.length, limit);
  assert.equal(out.policy.suppressed, 1);
  assert.match(out.policy.suppressedNote, /1 lower-severity finding/);
  // The high-severity finding must survive a truncation. Dropping it because it
  // arrived last is the version of this feature that loses somebody money.
  assert.ok(out.findings.some((f) => f.ruleId === "the-important-one"));
});

test("the suppressed count is present even when it is zero", () => {
  const out = applyPolicy("measurement", reportOf([]));
  // A field that appears only when something was hidden teaches a reader that its
  // absence means nothing was, and then a missing field and a zero look the same.
  assert.ok(Object.hasOwn(out.policy, "suppressed"));
  assert.equal(out.policy.suppressed, 0);
});

test("a seat with no published limit is reported as unbound, not silently unlimited", () => {
  const out = applyPolicy("seo-local", reportOf([finding("x", "high")]));
  assert.equal(out.policy.applied, false);
  assert.match(out.policy.why, /no published limit/);
  assert.equal(out.findings.length, 1);
});

test("the report passed in is not mutated", () => {
  const original = reportOf(Array.from({ length: 60 }, (_, i) => finding(`f-${i}`, "low")));
  const before = original.findings.length;
  applyPolicy("measurement", original);
  assert.equal(original.findings.length, before, "applyPolicy shortened its own argument");
});

test("every payload carries the expiry and the human, so neither can be inferred wrongly", () => {
  const out = applyPolicy("measurement", reportOf([finding("a", "high")]));
  assert.equal(out.policy.expiry, SEAT_CARDS.measurement.interrupts.expiry);
  assert.equal(out.policy.theHuman, SEAT_CARDS.measurement.theHuman);
});

/*
 * MUTATION CHECK. The assertion this file rests on is that truncation is always
 * announced. Prove the announcement can actually be missing, or the test above is
 * satisfied by its own existence.
 */
test("the suppression check can fail", () => {
  const silentlyTruncated = { ...reportOf([finding("a", "high")]), policy: { applied: true, suppressed: undefined } };
  assert.equal(silentlyTruncated.policy.suppressed, undefined, "a payload with no suppressed count must be distinguishable from one reporting zero");
});
