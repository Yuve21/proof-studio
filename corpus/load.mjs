/**
 * Corpus loading, and the refusals that make the corpus trustworthy.
 *
 * This is where the contract on a rule is ENFORCED rather than documented. The
 * sibling product's hardest-won lesson is that a guarantee written in prose above
 * a function is not a guarantee: its own most important validator carries fourteen
 * throw sites and is called on zero shipping paths, so every guard downstream
 * holds by the good behaviour of its callers.
 *
 * So loading a corpus is the only way to get its rules, and loading refuses:
 *
 *  - a rule with no `falsePositiveNote`, or a vague one. This is the field that
 *    takes the most work and is the easiest to skip, so the loader will not let
 *    you skip it. The note is the published condition under which the rule is
 *    WRONG and it travels attached to every fix the rule proposes, so a softened
 *    note reaches somebody who is about to change their site.
 *  - a rule with no rationale, no prevention, or no `since`.
 *  - a duplicate id, because two rules with one id means one of them silently
 *    never reports.
 *  - a weight outside 1 to 10, so nothing can quietly dominate a report.
 *  - a rule whose `detect` is not a function.
 *
 * It also refuses an EMPTY corpus, because a corpus that loaded zero rules and
 * reported success is the defect this whole product exists to detect.
 */

/**
 * Phrases that make a false-positive note worthless. A note has to name the
 * legitimate artifact that trips the rule; hedging is not a note.
 *
 * This list is short and specific on purpose. A long list of banned words would
 * catch honest prose, and a guard that fires on honest prose gets edited around
 * rather than obeyed, which makes its false-positive behaviour a correctness
 * property of the guard itself.
 */
const HEDGE_PHRASES = [
  /\b(may|might|can|could)\s+(?:occasionally|sometimes|rarely|potentially)?\s*be\s+(?:wrong|inaccurate|incorrect)\b/i,
  /\b(sometimes|occasionally|rarely)\s+(?:wrong|inaccurate|incorrect|fires\s+incorrectly)\b/i,
  /\buse\s+(?:your\s+own\s+)?judg(?:e)?ment\b/i,
  /\b(?:not\s+always|no[t]?\s+100%)\s+(?:accurate|reliable|right)\b/i,
];

/**
 * A note is allowed to CONTAIN a hedge as long as it also names the condition.
 * "It may be wrong on an email template" is a real note; "it may occasionally be
 * wrong" is not. So the test is two-part, and this is the half that saves honest
 * prose from a guard that would otherwise be edited around.
 */
const CONDITION_MARKERS = [
  /\bwhen\b/i, /\bwhere\b/i, /\bif\b/i, /\bunless\b/i, /\bon a\b/i, /\bon an\b/i,
  /\bfor example\b/i, /\bfor instance\b/i, /\bin the case\b/i, /\bsuch as\b/i,
  /\bexcept\b/i, /\bwrong on\b/i,
];

const PLACEHOLDER_NOTES = [
  /^\s*(none|n\/a|na|tbd|todo|todo:)\s*\.?\s*$/i,
  /^\s*not\s+applicable\s*\.?\s*$/i,
  /^\s*see\s+above\s*\.?\s*$/i,
];

const MIN_NOTE_LENGTH = 80;

export class CorpusContractError extends Error {}

const fail = (id, what) => {
  throw new CorpusContractError(`rule "${id}": ${what}`);
};

/**
 * @param {{CORPUS_ID: string, CORPUS_VERSION: string, RULES: object[], collect: Function}} mod
 * @returns {{id: string, version: string, rules: object[], collect: Function}}
 */
export function loadCorpus(mod) {
  if (!mod || typeof mod !== "object") throw new CorpusContractError("corpus module is not an object");
  const { CORPUS_ID: id, CORPUS_VERSION: version, RULES: rules, collect } = mod;

  if (typeof id !== "string" || !id) throw new CorpusContractError("corpus has no CORPUS_ID");
  if (typeof version !== "string" || !version) {
    throw new CorpusContractError(`corpus "${id}" has no CORPUS_VERSION. A report cites the version it ran under, so there has to be one.`);
  }
  if (typeof collect !== "function") {
    throw new CorpusContractError(`corpus "${id}" has no collect function, so it can gather no facts`);
  }
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new CorpusContractError(
      `corpus "${id}" loaded ZERO rules. A corpus that examines nothing and reports success is the ` +
      `defect this product exists to detect, so this is a failure rather than an empty result.`,
    );
  }

  const seen = new Set();
  for (const r of rules) {
    const rid = typeof r?.id === "string" && r.id ? r.id : null;
    if (!rid) throw new CorpusContractError(`a rule in "${id}" has no id`);
    if (seen.has(rid)) fail(rid, "duplicate id, so one of the two would silently never report");
    seen.add(rid);

    if (typeof r.detect !== "function") fail(rid, "detect is not a function");
    if (typeof r.family !== "string" || !r.family) fail(rid, "no family");
    if (typeof r.title !== "string" || !r.title) fail(rid, "no title");
    if (typeof r.since !== "string" || !r.since) fail(rid, "no since version");
    if (!["low", "medium", "high"].includes(r.severity)) {
      fail(rid, `severity is ${JSON.stringify(r.severity)}, expected low, medium or high`);
    }
    if (!Number.isFinite(r.weight) || r.weight < 1 || r.weight > 10) {
      fail(rid, `weight is ${JSON.stringify(r.weight)}, expected 1 to 10 so nothing can dominate a report`);
    }
    if (typeof r.rationale !== "string" || r.rationale.trim().length < 40) {
      fail(rid, "rationale is missing or too short to explain the rule to somebody who disagrees with it");
    }
    if (typeof r.prevention !== "string" || !r.prevention.trim()) {
      fail(rid, "no prevention, so it can fire and not say what to change");
    }

    // The one the loader exists for.
    const note = r.falsePositiveNote;
    if (typeof note !== "string" || !note.trim()) {
      fail(rid, "no falsePositiveNote. It is the published condition under which this rule is WRONG and it is mandatory.");
    }
    /*
     * ORDER MATTERS HERE, and it was wrong first time.
     *
     * The length gate used to run first, and every hedge worth testing is shorter
     * than the 80-character minimum, so the length gate rejected all of them and
     * the hedge gate was never reached by any input. It was dead code, and a
     * mutation that disabled it left the whole suite green. Same shape as the
     * unreachable catch block recorded in docs/LEARNINGS.md P-03: structural
     * validation placed BEFORE a semantic check absorbs every input a test author
     * naturally reaches for.
     *
     * The hedge gate now runs FIRST, so a short hedge is told it is a hedge rather
     * than told it is short, and the phrases are unanchored so a hedge padded out
     * past the minimum is still caught.
     */
    for (const placeholder of PLACEHOLDER_NOTES) {
      if (placeholder.test(note)) {
        fail(rid, `falsePositiveNote is a placeholder: ${JSON.stringify(note.trim())}`);
      }
    }
    const hedges = HEDGE_PHRASES.some((h) => h.test(note));
    const conditions = CONDITION_MARKERS.some((c) => c.test(note));
    if (hedges && !conditions) {
      fail(
        rid,
        `falsePositiveNote hedges without naming a condition: ${JSON.stringify(note.trim().slice(0, 120))}. ` +
        `Say WHEN the rule is wrong and on WHAT, not that it can be.`,
      );
    }
    if (note.trim().length < MIN_NOTE_LENGTH) {
      fail(
        rid,
        `falsePositiveNote is ${note.trim().length} characters, under the ${MIN_NOTE_LENGTH} minimum. ` +
        `Name the legitimate artifact that trips this rule, not the fact that it can be wrong.`,
      );
    }
  }

  return { id, version, rules, collect };
}
