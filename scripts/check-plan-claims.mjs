/**
 * Does the plan still describe the code?
 *
 * WHY THIS EXISTS, and it is a specific mistake made twice rather than a tidy
 * idea. `docs/AGENT-ROSTER-PLAN.md` carries the sentence a customer's decision
 * would rest on: how many departments have a rulebook today, which ones, and how
 * many rules each has. That sentence went stale twice in two days. When the
 * fourth rulebook landed, the count changed to FOUR and the very next clause,
 * "the other nine are registered as prompts", was left alone: twelve minus four
 * is eight. Then the paragraph below it said "two of the nine are blocked" while
 * listing three seats.
 *
 * Neither error was caught by anything, because a number in prose is not checked
 * by anything. Both were in the most load-bearing paragraph in the document.
 *
 * So the numbers are now DERIVED from the code and compared against the prose,
 * and the comparison runs in BOTH directions: a rulebook missing from the plan
 * fails, and a rulebook the plan claims and the code does not have fails. One
 * direction alone would let the plan overclaim, which is the direction that
 * matters, or underclaim, which is the direction that makes us look unfinished.
 *
 * WHAT THIS DOES NOT CHECK, said plainly: whether the prose around the numbers
 * is true. It checks the arithmetic and the names. A sentence claiming a rulebook
 * does something it does not do is still a sentence a human has to read.
 */
import { readFileSync } from "node:fs";
import { CORPORA } from "../report/run.mjs";
import { loadCorpus } from "../corpus/load.mjs";

const PLAN = "docs/AGENT-ROSTER-PLAN.md";
const TIER_1_SIZE = 12;

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve",
];
const word = (n) => NUMBER_WORDS[n] ?? String(n);

const plan = readFileSync(PLAN, "utf8");
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

// --- the readiness sentence -------------------------------------------------
const headline = /\*\*([A-Z]+) OF THE TWELVE HAVE A RULEBOOK TODAY\*\*([\s\S]*?)\n\n/.exec(plan);
if (!headline) {
  console.error(
    `FAIL: could not find the readiness sentence in ${PLAN}. It is the sentence a customer's ` +
    `decision rests on, so if it has been reworded this check has to be reworded with it rather ` +
    `than left to pass over a document it can no longer read.`,
  );
  process.exit(1);
}

const claimedWord = headline[1].toLowerCase();
const expectedWord = word(ready.length);
if (claimedWord !== expectedWord) {
  problems.push(
    `the plan says ${claimedWord.toUpperCase()} of the twelve have a rulebook; the code has ` +
    `${ready.length}, so it should say ${expectedWord.toUpperCase()}`,
  );
}

const body = headline[2];
const claimed = [...body.matchAll(/`([a-z0-9-]+)`\s+with\s+(\d+)/g)].map((m) => ({
  id: m[1],
  rules: Number(m[2]),
}));

// Both directions. A missing entry and an invented entry are different defects.
for (const r of ready) {
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

// --- the arithmetic in the clause that went stale ---------------------------
const remainder = TIER_1_SIZE - ready.length;
const others = /The other ([a-z]+) are registered as prompts/.exec(body);
if (!others) {
  problems.push('could not find the "The other N are registered as prompts" clause');
} else if (others[1].toLowerCase() !== word(remainder)) {
  problems.push(
    `the plan says the other ${others[1]} are registered as prompts; ${TIER_1_SIZE} minus ` +
    `${ready.length} is ${remainder}, so it should say ${word(remainder)}`,
  );
}

/*
 * The blocked sentence, which is where the second stale number was. It says "N
 * of the M are blocked" and then LISTS them in backticks, so the count is
 * checked against the list in the same sentence rather than against a constant.
 */
const blocked = /([A-Z][a-z]+) of the ([a-z]+) are blocked rather than merely unbuilt[^:]*:([\s\S]*?)\n\n/.exec(plan);
if (!blocked) {
  problems.push("could not find the blocked-seats sentence");
} else {
  const named = new Set([...blocked[3].matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]));
  if (blocked[1].toLowerCase() !== word(named.size)) {
    problems.push(
      `the plan says ${blocked[1]} of the seats are blocked and then names ${named.size}: ` +
      `${[...named].join(", ")}`,
    );
  }
  if (blocked[2].toLowerCase() !== word(remainder)) {
    problems.push(
      `the blocked sentence says "of the ${blocked[2]}"; the number not yet built is ${remainder}`,
    );
  }
  for (const id of named) {
    if (ready.some((r) => r.id === id)) {
      problems.push(`${id} is described as blocked but it HAS a rulebook in the code`);
    }
  }
}

// --- tier 1 is twelve seats, counted rather than asserted -------------------
const tier1 = /\*\*Tier 1[^*]*\(12 seats\)\.\*\*\s*Every one deterministic:([\s\S]*?)\.\n/.exec(plan);
if (!tier1) {
  problems.push("could not find the tier 1 seat list");
} else {
  const seats = tier1[1]
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (seats.length !== TIER_1_SIZE) {
    problems.push(`tier 1 claims ${TIER_1_SIZE} seats and lists ${seats.length}: ${seats.join(", ")}`);
  }
  for (const r of ready) {
    if (!seats.includes(r.id)) problems.push(`${r.id} has a rulebook but is not in the tier 1 list`);
  }
}

// --- report ------------------------------------------------------------------
console.log(
  `checked ${PLAN} against ${ready.length} corpus/corpora in report/run.mjs ` +
  `(${ready.map((r) => `${r.id}:${r.rules}`).join(", ")}); ` +
  `4 claim(s) in the plan compared in both directions`,
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
