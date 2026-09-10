/**
 * The `release-verifier` seat's judgement, extracted from its I/O so it can be
 * tested.
 *
 * Same reason `modeMismatch` and `accountMismatch` were extracted out of the
 * Stripe client: the decision is the part that can be wrong, and a decision
 * reachable only by shelling out to eight real gates is a decision nothing
 * tests. `scripts/release-verify.mjs` runs the commands; this file decides what
 * their output means.
 *
 * THE THREE RULES THIS FILE ENCODES, each of which cost something to learn:
 *
 *  1. A gate that exits clean having examined ZERO things has failed. That is
 *     the sentence the whole product is built against, and it applies to our own
 *     gates first.
 *  2. A gate that exits clean and prints no denominator this verifier can READ
 *     has also failed, and this is the subtler one. It means either the gate
 *     stopped saying what it examined, or the pattern here went stale and the
 *     verifier quietly stopped checking. Both are the same defect wearing
 *     different clothes, so neither gets a pass.
 *  3. A run in which NOTHING ran must not report success. A verifier that
 *     verified nothing and exited zero is the exact failure it exists to catch,
 *     and it is reachable by an ordinary typo in `--only=`.
 */

/** A gate's declared denominator was absent from its output. */
export const NO_DENOMINATOR = "exited clean but printed no denominator this verifier could read";

/**
 * What does this gate's result mean?
 *
 * @param {{ok: boolean}} run whether the command exited zero
 * @param {{value: number|null, unit: string|null, missing?: boolean, note?: string}} denominator
 * @returns {{state: "pass"|"fail", why: string|null}}
 */
export function classify(run, denominator) {
  if (!run.ok) return { state: "fail", why: null };

  // A gate that DECLARES it has no denominator is allowed to pass. The
  // declaration is the difference between "there is nothing to count" and "we
  // could not find the count", and only the first is acceptable.
  if (denominator.value === null && denominator.note) return { state: "pass", why: null };

  if (denominator.missing || denominator.value === null) {
    return { state: "fail", why: NO_DENOMINATOR };
  }
  if (denominator.value === 0) {
    return {
      state: "fail",
      why: `examined ZERO ${denominator.unit}, which is not a pass, it is an absent gate`,
    };
  }
  return { state: "pass", why: null };
}

/**
 * The verdict over a whole run.
 *
 * @param {Array<{state: "pass"|"fail"|"skipped"}>} results
 * @returns {{passed: number, failed: number, skipped: number, ok: boolean, why: string|null}}
 */
export function summarise(results) {
  const passed = results.filter((r) => r.state === "pass").length;
  const failed = results.filter((r) => r.state === "fail").length;
  const skipped = results.filter((r) => r.state === "skipped").length;

  if (results.length === 0) {
    return { passed, failed, skipped, ok: false, why: "no gates were defined, so nothing was verified" };
  }
  /*
   * RULE 3. Every gate skipped and a zero exit code is a verifier reporting
   * success for work it did not do. Reachable by a typo: `--only=claims-check`
   * instead of `--only=claims:check` matches nothing and skips all eight.
   */
  if (passed === 0 && failed === 0) {
    return {
      passed,
      failed,
      skipped,
      ok: false,
      why:
        `all ${skipped} gate(s) were skipped, so NOTHING was verified. A verifier that verified ` +
        `nothing must not report success.`,
    };
  }
  if (failed > 0) return { passed, failed, skipped, ok: false, why: null };
  return { passed, failed, skipped, ok: true, why: null };
}
