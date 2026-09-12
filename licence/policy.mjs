/**
 * The seat card, made executable.
 *
 * WHY THIS FILE EXISTS. `seat-cards.mjs` gave every seat a stopping contract: a
 * budget, a ceiling, a handback and an expiry. All four were PROSE, in a document
 * an agent reads. An agent can ignore prose. It cannot exceed a limit the runtime
 * applies before the payload leaves this process.
 *
 * The idea is not ours. It is the shape naive.ai publishes as `naive.config.ts`,
 * where agents, delegation, budgets and tool policy are declared in one committed
 * file, with the property that matters stated plainly: no agent can edit the file
 * that binds it. Ours is narrower and the same in kind. The limits live here, in
 * the published package, and the server applies them on the way out. A caller can
 * ask for a scan; it cannot ask for more findings than the seat's ceiling.
 *
 * WHAT IS ENFORCED, and nothing else claims to be:
 *
 *   the ceiling    at most `maxFindings` come back, ranked by severity, and the
 *                  number suppressed is ALWAYS stated. A seat that returns
 *                  everything it found has delegated triage to the reader, and a
 *                  truncation that does not say it truncated is worse than no
 *                  truncation at all.
 *   the expiry     stamped on every payload, so a finding cannot be quoted six
 *                  weeks later as though it were current.
 *   the human      carried on every payload, so the caller knows which decision
 *                  is not the agent's to make.
 *
 * THE BUDGET AND THE HANDBACK LIVE IN `session.mjs`, because both are properties
 * of a RUN and this module sees one payload at a time. They were unenforced when
 * this file was written and are enforced now: a repeated read of identical bytes
 * is served from memory, and a department that has read its published number of
 * files ends the run with a coded abstention.
 */

import { SEAT_CARDS } from "./seat-cards.mjs";

/** Severity order for the ceiling. Highest first: a truncated list must drop the least important. */
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

/**
 * The numeric half of each card's ceiling.
 *
 * SEPARATE FROM THE PROSE ON PURPOSE, and reconciled by a test rather than by
 * hope. The prose says why the number is what it is, which a reader needs; the
 * number is what the runtime can apply, which prose cannot be. Two expressions of
 * one fact is exactly the drift this house names most often, so the test asserts
 * that when the prose states a number, it is THIS number.
 */
export const LIMITS = {
  "template-tells": { maxFindings: 40 },
  "broken-things": { maxFindings: 40 },
  accessibility: { maxFindings: 40 },
  "seo-technical": { maxFindings: 25 },
  "seo-onpage": { maxFindings: 25 },
  "seo-structured-data": { maxFindings: 25 },
  "forms-and-capture": { maxFindings: 40 },
  "claims-officer": { maxFindings: 25 },
  measurement: { maxFindings: 40 },
  "conversion-auditor": { maxFindings: 25 },
};

/**
 * Apply a seat's policy to a report on its way out of the server.
 *
 * Returns a NEW object. The report is not mutated, because the caller may still
 * want the full set for its own receipt and a function that quietly shortens its
 * argument is the kind of surprise this codebase exists to find.
 */
export function applyPolicy(seatId, report) {
  const card = SEAT_CARDS[seatId];
  const limit = LIMITS[seatId];

  // No card or no limit is not an error and is not silent. A seat can legitimately
  // have neither yet, and the payload says so rather than implying an unlimited
  // policy was a decision somebody made.
  if (!card || !limit) {
    return { ...report, policy: { applied: false, why: `no published limit for "${seatId}", so nothing was suppressed` } };
  }

  const ranked = [...report.findings].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9),
  );
  const kept = ranked.slice(0, limit.maxFindings);
  const suppressed = ranked.length - kept.length;

  return {
    ...report,
    findings: kept,
    policy: {
      applied: true,
      ceiling: limit.maxFindings,
      returned: kept.length,
      /*
       * ALWAYS PRESENT, including when it is zero. A field that appears only when
       * something was hidden teaches a reader that its absence means nothing was,
       * and then a missing field and a zero look identical.
       */
      suppressed,
      suppressedNote:
        suppressed > 0
          ? `${suppressed} lower-severity finding(s) are not in this payload. Raise the ceiling or scan a narrower target to see them.`
          : "Nothing was suppressed: the full set is here.",
      expiry: card.interrupts.expiry,
      theHuman: card.theHuman,
    },
  };
}
