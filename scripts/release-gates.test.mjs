/**
 * Tests for the `release-verifier` seat's judgement.
 *
 * WHY THIS IS A UNIT TEST RATHER THAN A RUN OF THE REAL THING. The verifier's
 * value is entirely in three decisions, and all three are about cases that do
 * not arise on a healthy repository: a gate examining zero things, a gate whose
 * denominator cannot be read, and a run in which nothing ran. Testing it by
 * running the real gates would exercise none of them, which is how a verifier
 * ends up with a green suite and an untested classifier.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classify, summarise, NO_DENOMINATOR } from "./release-gates.mjs";

const ok = { ok: true };
const broke = { ok: false };

test("a gate that examined things and exited clean passes", () => {
  assert.deepEqual(classify(ok, { value: 41, unit: "files" }), { state: "pass", why: null });
  assert.deepEqual(classify(ok, { value: 1, unit: "files" }), { state: "pass", why: null });
});

test("a gate that exited non-zero fails, and the output speaks for itself", () => {
  const v = classify(broke, { value: 41, unit: "files" });
  assert.equal(v.state, "fail");
  // No invented reason: the gate printed its own, and this verifier prints that
  // rather than paraphrasing it.
  assert.equal(v.why, null);
});

test("A GATE THAT EXAMINED ZERO THINGS FAILS, even having exited clean", () => {
  /*
   * The sentence this whole product is built against, applied to our own gates
   * first. `exit 0` from a gate that scanned nothing is indistinguishable from a
   * real pass unless something reads the denominator.
   */
  const v = classify(ok, { value: 0, unit: "files scanned for claims" });
  assert.equal(v.state, "fail");
  assert.match(v.why, /examined ZERO files scanned for claims/);
  assert.match(v.why, /not a pass, it is an absent gate/);
});

test("A GATE WHOSE DENOMINATOR CANNOT BE READ FAILS, which is the subtler case", () => {
  /*
   * Two different defects produce this and both are real. Either the gate
   * stopped printing what it examined, or the pattern in the verifier went stale
   * and the verifier quietly stopped checking. Passing here would hide both.
   */
  const missing = classify(ok, { value: null, unit: "files", missing: true });
  assert.equal(missing.state, "fail");
  assert.equal(missing.why, NO_DENOMINATOR);

  // A null value with no explanation and no missing flag is the same situation.
  const nullish = classify(ok, { value: null, unit: "files" });
  assert.equal(nullish.state, "fail");
  assert.equal(nullish.why, NO_DENOMINATOR);
});

test("but a gate that DECLARES it has no denominator passes", () => {
  /*
   * The distinction that keeps the rule above usable. `tsc --noEmit` prints
   * nothing on success, so there is genuinely no count. Declaring that is
   * different from failing to find one, and only the declaration is accepted.
   */
  const v = classify(ok, {
    value: null,
    unit: null,
    note: "tsc prints nothing on success, so there is no count to read",
  });
  assert.deepEqual(v, { state: "pass", why: null });
});

test("a declared-null gate that FAILED is still a failure", () => {
  // The declaration excuses a missing count, never a non-zero exit.
  assert.equal(classify(broke, { value: null, unit: null, note: "no count" }).state, "fail");
});

test("A RUN IN WHICH NOTHING RAN DOES NOT REPORT SUCCESS", () => {
  /*
   * Reachable by an ordinary typo: `--only=claims-check` instead of
   * `--only=claims:check` matches no gate and skips all eight. A verifier that
   * verified nothing and exited zero is the exact failure it exists to catch.
   */
  const allSkipped = Array.from({ length: 8 }, () => ({ state: "skipped" }));
  const v = summarise(allSkipped);
  assert.equal(v.ok, false);
  assert.equal(v.skipped, 8);
  assert.match(v.why, /NOTHING was verified/);
  assert.match(v.why, /must not report success/);
});

test("an empty gate list is a failure, not an empty success", () => {
  const v = summarise([]);
  assert.equal(v.ok, false);
  assert.match(v.why, /no gates were defined/);
});

test("some skipped and some passed is a success, and the counts are reported honestly", () => {
  const v = summarise([
    { state: "pass" },
    { state: "pass" },
    { state: "skipped" },
    { state: "skipped" },
  ]);
  assert.equal(v.ok, true);
  assert.deepEqual({ passed: v.passed, failed: v.failed, skipped: v.skipped }, { passed: 2, failed: 0, skipped: 2 });
  // No invented reason on a success.
  assert.equal(v.why, null);
});

test("one failure sinks the run even with many passes", () => {
  const v = summarise([...Array.from({ length: 7 }, () => ({ state: "pass" })), { state: "fail" }]);
  assert.equal(v.ok, false);
  assert.equal(v.passed, 7);
  assert.equal(v.failed, 1);
  // The reason is the gate's own output, printed by the runner, not a summary line.
  assert.equal(v.why, null);
});

test("every gate in the real list either reads a denominator or declares it has none", () => {
  /*
   * The completeness check, and it is the one assertion here that reads the real
   * configuration. A gate added without either a denominator pattern or an
   * explicit note would fail at runtime with NO DENOMINATOR, which is correct
   * but is a worse place to find out than here.
   *
   * The list is read out of the runner as text rather than imported, because
   * importing it would execute eight real gates.
   */
  const src = readFileSync("scripts/release-verify.mjs", "utf8");
  const gatesBlock = /const GATES = \[([\s\S]*?)\n\];/.exec(src);
  assert.ok(gatesBlock, "the GATES list must be findable, or this check is silently passing");

  const entries = gatesBlock[1].split(/\n  \{/).filter((e) => /id: "/.test(e));
  assert.ok(entries.length >= 8, `expected every gate, found ${entries.length}`);

  for (const entry of entries) {
    const id = /id: "([^"]+)"/.exec(entry)[1];
    const hasPattern = /denominator: \//.test(entry);
    const declaresNone = /denominatorNote: "/.test(entry);
    const counts = /count(Pages|Rules): true/.test(entry);
    assert.ok(
      hasPattern || declaresNone || counts,
      `gate "${id}" neither reads a denominator nor declares it has none`,
    );
    if (hasPattern || counts) {
      assert.ok(/unit: "/.test(entry), `gate "${id}" reports a number with no unit, which is not a denominator`);
    }
  }
});
