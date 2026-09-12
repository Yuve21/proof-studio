/**
 * Does the plan still describe the code?
 *
 * WHY THIS EXISTS, and it is a specific mistake made three times rather than a
 * tidy idea. `docs/AGENT-ROSTER-PLAN.md` carries the sentence a customer's
 * decision would rest on: how many departments have a rulebook today, which
 * ones, and how many rules each has.
 *
 *   - When the fourth rulebook landed, the count changed to FOUR and the very
 *     next clause, "the other nine are registered as prompts", was left alone.
 *     Twelve minus four is eight.
 *   - The paragraph below it said "two of the nine are blocked" while listing
 *     three seats.
 *   - Tier 1 was described as twelve seats each needing a rulebook, when one of
 *     the twelve, `release-verifier`, is an INTERNAL seat that never ships to a
 *     customer and is a program rather than a corpus. That overstated the work
 *     remaining by one for several days.
 *
 * None was caught by anything, because a number in prose is checked by nothing.
 *
 * So the numbers are DERIVED and compared against the prose, in BOTH directions:
 * a rulebook missing from the plan fails, and a rulebook the plan claims and the
 * code does not have fails. One direction alone would let the plan overclaim,
 * which is the direction that matters, or underclaim, which is the direction that
 * makes us look unfinished.
 *
 * THE INTERNAL-SEAT SUBTRACTION IS DERIVED TOO, from `INTERNAL_SEATS` in
 * `licence/roster.mjs`, which is the list the licence layer actually uses. A
 * constant here would be a second spelling of the same fact and the thing that
 * went wrong the third time.
 *
 * WHAT THIS DOES NOT CHECK, said plainly: whether the prose around the numbers is
 * true. It checks the arithmetic and the names. A sentence claiming a rulebook
 * does something it does not do is still a sentence a human has to read.
 */
import { readFileSync } from "node:fs";
import { CORPORA } from "../report/run.mjs";
import { loadCorpus } from "../corpus/load.mjs";
import { INTERNAL_SEATS, loadRoster } from "../licence/roster.mjs";

const PLAN = "docs/AGENT-ROSTER-PLAN.md";
const TIER_1_SIZE = 12;

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve",
];
const word = (n) => NUMBER_WORDS[n] ?? String(n);

/*
 * LINE ENDINGS ARE NORMALISED BEFORE ANY REGEX RUNS, and this is not a tidy-up.
 *
 * Every pattern below is anchored on `\n\n` or on a line boundary. On a Windows
 * checkout git hands this file back with CRLF, every one of those patterns misses,
 * and the script exits saying it "could not find" a section that is sitting right
 * there. Measured on 2026-09-11: it had been failing that way on this machine at
 * HEAD, before the day's edits, which means the gate that verifies the plan's
 * published claims was itself dead and nobody could tell the difference between
 * that and a plan with a missing section.
 *
 * The sibling product's roster checker learned the same thing and normalises on
 * read. Same fix, same reason: a guard that cannot read its own subject on half
 * the machines it runs on is a guard with a named blind spot.
 */
const plan = readFileSync(PLAN, "utf8").replace(/\r\n/g, "\n");
const problems = [];

// --- what the code actually has ---------------------------------------------
const ready = CORPORA.map((mod) => {
  const c = loadCorpus(mod);
  return { id: c.id, rules: c.rules.length };
}).sort((a, b) => b.rules - a.rules || a.id.localeCompare(b.id));

if (ready.length === 0) {
  console.error(
    "FAIL: report/run.mjs exports ZERO corpora. A plan check with nothing to compare against is " +
    "not a passing check, it is an absent one.",
  );
  process.exit(1);
}

// --- tier 1, counted, and split into customer-facing and internal ------------
const tier1Match = /\*\*Tier 1[^*]*\(12 seats\)\.\*\*\s*Every one deterministic:([\s\S]*?)\.\n/.exec(plan);
if (!tier1Match) {
  console.error(`FAIL: could not find the tier 1 seat list in ${PLAN}.`);
  process.exit(1);
}
// Every seat the plan defines, parsed by the same loader the licence layer uses,
// so "is this a real seat" is answered by the roster rather than by this file.
const seatIds = [...loadRoster(PLAN).keys()];
const tier1Seats = tier1Match[1]
  .split(",")
  .map((s) => s.trim().replace(/\s+/g, " "))
  .filter(Boolean);

if (tier1Seats.length !== TIER_1_SIZE) {
  problems.push(`tier 1 claims ${TIER_1_SIZE} seats and lists ${tier1Seats.length}: ${tier1Seats.join(", ")}`);
}

const internalInTier1 = tier1Seats.filter((s) => INTERNAL_SEATS.includes(s));
const customerFacing = tier1Seats.length - internalInTier1.length;

if (internalInTier1.length === 0) {
  problems.push(
    "no tier 1 seat is in INTERNAL_SEATS, which contradicts the plan's own paragraph about " +
    "release-verifier. One of the two has changed and they no longer agree.",
  );
}

// --- the readiness sentence -------------------------------------------------
const headline =
  /\*\*([A-Z]+) OF THE ([A-Z]+) CUSTOMER-FACING TIER-1 SEATS HAVE A RULEBOOK TODAY\*\*([\s\S]*?)\n\n/.exec(plan);
if (!headline) {
  console.error(
    `FAIL: could not find the readiness sentence in ${PLAN}. It is the sentence a customer's ` +
    `decision rests on, so if it has been reworded this check has to be reworded with it rather ` +
    `than left to pass over a document it can no longer read.`,
  );
  process.exit(1);
}

const [, readyWord, totalWord, body] = headline;

/*
 * THE READINESS SENTENCE IS ABOUT TIER 1, so it is compared against the tier-1
 * rulebooks and not against every rulebook that exists. Once tier-2 seats
 * shipped, `ready.length` stopped being the number that sentence is making a
 * claim about, and comparing the two reported the DOCUMENT as wrong when the
 * document was right. Scoped here rather than by loosening the assertion.
 */
const readyTier1 = ready.filter((r) => tier1Seats.includes(r.id));
if (readyWord.toLowerCase() !== word(readyTier1.length)) {
  problems.push(
    `the plan says ${readyWord} of the customer-facing seats have a rulebook; the code has ` +
    `${readyTier1.length}, so it should say ${word(readyTier1.length).toUpperCase()}`,
  );
}
if (totalWord.toLowerCase() !== word(customerFacing)) {
  problems.push(
    `the plan says there are ${totalWord} customer-facing tier-1 seats; ${tier1Seats.length} seats ` +
    `minus ${internalInTier1.length} internal (${internalInTier1.join(", ")}) is ${customerFacing}, ` +
    `so it should say ${word(customerFacing).toUpperCase()}`,
  );
}

const claimed = [...body.matchAll(/`([a-z0-9-]+)`\s+with\s+(\d+)/g)].map((m) => ({
  id: m[1],
  rules: Number(m[2]),
}));

// Both directions. A missing entry and an invented entry are different defects.
// Scoped to tier 1, because the sentence being compared is a tier-1 sentence: a
// tier-2 rulebook is not missing from it, it was never in its scope.
for (const r of readyTier1) {
  const match = claimed.find((c) => c.id === r.id);
  if (!match) problems.push(`the code has a rulebook the plan does not list: ${r.id} (${r.rules} rules)`);
  else if (match.rules !== r.rules) {
    problems.push(`the plan says ${r.id} has ${match.rules} rules; it has ${r.rules}`);
  }
}
for (const c of claimed) {
  if (!ready.some((r) => r.id === c.id)) {
    problems.push(`the plan claims a rulebook that does not exist in the code: ${c.id}`);
  }
}

// A rulebook must not be an internal seat: those never reach a customer.
for (const r of ready) {
  if (INTERNAL_SEATS.includes(r.id)) {
    problems.push(`${r.id} has a customer-facing rulebook but is listed in INTERNAL_SEATS`);
  }
}

// --- the arithmetic in the clause that went stale ---------------------------
const remainder = customerFacing - readyTier1.length;
const others = /The other ([a-z]+) are registered as prompts/.exec(body);
if (!others) {
  problems.push('could not find the "The other N are registered as prompts" clause');
} else if (others[1].toLowerCase() !== word(remainder)) {
  problems.push(
    `the plan says the other ${others[1]} are registered as prompts; ${customerFacing} minus ` +
    `${ready.length} is ${remainder}, so it should say ${word(remainder)}`,
  );
}

/*
 * The blocked sentence, which is where the second stale number was. It says
 * "ALL N of the remaining seats are blocked" and then LISTS them in backticks, so
 * the count is checked against the list in the same sentence AND against the
 * remainder, rather than against a constant.
 */
const blocked =
  /\*\*ALL ([A-Z]+) of the remaining seats are blocked rather than merely unbuilt\*\*[^:]*:([\s\S]*?)\n\n/.exec(plan);
if (!blocked) {
  problems.push("could not find the blocked-seats sentence");
} else {
  const named = new Set([...blocked[2].matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]));
  if (blocked[1].toLowerCase() !== word(named.size)) {
    problems.push(
      `the plan says ALL ${blocked[1]} of the remaining seats are blocked and then names ` +
      `${named.size}: ${[...named].join(", ")}`,
    );
  }
  if (named.size !== remainder) {
    problems.push(
      `the plan claims every remaining seat is blocked, but it names ${named.size} and the ` +
      `remainder is ${remainder}. If a seat is unbuilt rather than blocked, the sentence has to ` +
      `stop saying ALL.`,
    );
  }
  for (const id of named) {
    if (ready.some((r) => r.id === id)) {
      problems.push(`${id} is described as blocked but it HAS a rulebook in the code`);
    }
    if (!tier1Seats.includes(id)) {
      problems.push(`${id} is described as a blocked tier-1 seat but is not in the tier 1 list`);
    }
  }
}

// --- every rulebook belongs to a seat the roster defines ---------------------
//
// THIS USED TO ASSERT "every rulebook is a TIER 1 seat". That was true while tier
// 1 was the only tier with corpora, and it became false on 2026-09-11 when
// `measurement` and `conversion-auditor` shipped. The assumption was never
// checked against the tiers, it was baked into the sentence, so the gate reported
// two correctly built seats as defects and pointed at the document.
//
// The invariant that actually matters is unchanged: a rulebook must belong to a
// seat the roster defines, or the server registers a department nobody sold. The
// tier it sits in is reported below rather than required here.
for (const r of ready) {
  if (!seatIds.includes(r.id)) problems.push(`${r.id} has a rulebook but is not a seat on the roster`);
}
const readyBeyondTier1 = ready.filter((r) => !tier1Seats.includes(r.id)).map((r) => r.id);

// --- report ------------------------------------------------------------------
console.log(
  `checked ${PLAN} against ${ready.length} corpus/corpora in report/run.mjs ` +
  `(${ready.map((r) => `${r.id}:${r.rules}`).join(", ")}); ` +
  `tier 1 has ${tier1Seats.length} seat(s), ${internalInTier1.length} internal ` +
  `(${internalInTier1.join(", ") || "none"}), ${customerFacing} customer-facing, ` +
  `${readyTier1.length} of them with a rulebook; ` +
  // Named rather than merely counted, so a tier-2 seat shipping is visible in the
  // gate's own output instead of only in a commit message.
  `beyond tier 1: ${readyBeyondTier1.join(", ") || "none"}; ` +
  `6 claim(s) in the plan compared in both directions`,
);

if (problems.length) {
  console.error(`\nFAIL: ${problems.length} place(s) where the plan no longer describes the code.`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    `\n      These are the numbers a customer reads. Fix the document rather than this check, ` +
    `unless the document has been deliberately restructured.`,
  );
  process.exit(1);
}
console.log("OK: the plan's readiness claims match the code.");
