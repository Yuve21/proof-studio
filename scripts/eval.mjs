#!/usr/bin/env node
/**
 * `npm run eval` — the per-seat eval.
 *
 *   node scripts/eval.mjs            compare every mutation against its declared expectation
 *   node scripts/eval.mjs --record   print what each mutation actually fires, and change nothing
 *
 * `--record` exists because writing an expectation by guessing a rule id is how a
 * test ends up asserting the behaviour the code happens to have. Run it, read what
 * fired, decide whether that is right, and only then write it down.
 *
 * THE CONTROL RUNS FIRST AND ITS FAILURE IS FATAL. Every expectation below is
 * stated as "exactly these rules and nothing else", which is only meaningful if
 * the unmutated page fires nothing at all. If the clean page has started firing,
 * every comparison after it is measuring two things at once, so the run stops
 * rather than reporting a list of failures whose cause is one page.
 */
import { readFileSync } from "node:fs";
import { CORPORA, assess } from "../report/run.mjs";
import { loadCorpus } from "../corpus/load.mjs";
import { factsFromHtml } from "../mcp/dom.mjs";
import { CLEAN_PAGE, MUTATIONS } from "../calibration/mutations.mjs";

const record = process.argv.includes("--record");
const clean = readFileSync(CLEAN_PAGE, "utf8").replace(/\r\n/g, "\n");
const corpora = CORPORA.map(loadCorpus);

/** Every rule id that fires across every rulebook, plus anything that abstained. */
function scan(html) {
  const fired = [];
  const abstained = [];
  for (const c of corpora) {
    const r = assess(c, factsFromHtml(html, c.collect));
    if (r.status !== "assessed") {
      // An abstention is not a finding and is not a pass. It is recorded so a
      // mutation that accidentally makes a page unreadable is visible rather
      // than looking like a rule that stopped firing.
      abstained.push(`${c.id}:${r.abstention?.code ?? "unknown"}`);
      continue;
    }
    for (const f of r.findings) fired.push(f.ruleId);
  }
  return { fired: fired.sort(), abstained: abstained.sort() };
}

const problems = [];

// --- the control -------------------------------------------------------------
const control = scan(clean);
const controlAbstentions = control.abstained.filter((a) => !a.endsWith(":nothing_to_assess"));
if (control.fired.length > 0 || controlAbstentions.length > 0) {
  console.error(
    `FAIL: the clean page is no longer clean, so nothing below can be measured.\n` +
      `  fired: ${control.fired.join(", ") || "none"}\n` +
      `  abstained: ${controlAbstentions.join(", ") || "none"}\n\n` +
      `Either a rule changed or the page did. Fix that first: every expectation in\n` +
      `calibration/mutations.mjs is stated as "exactly these and nothing else", and\n` +
      `that sentence is meaningless while the control fires.`,
  );
  process.exit(1);
}

// --- every mutation ----------------------------------------------------------
const rows = [];
for (const m of MUTATIONS) {
  let mutated;
  try {
    mutated = m.apply(clean);
  } catch (err) {
    problems.push(`${m.id}: ${err.message}`);
    continue;
  }
  if (mutated === clean) {
    // A mutation that changed nothing passes every assertion it makes, which is
    // the vacuous shape this whole product exists to detect.
    problems.push(`${m.id}: the mutation produced an identical page, so it tests nothing`);
    continue;
  }

  const { fired, abstained } = scan(mutated);
  rows.push({ id: m.id, seat: m.seat, fired, abstained });
  if (record) continue;

  const missing = m.expects.filter((id) => !fired.includes(id));
  const unexpected = fired.filter((id) => !m.expects.includes(id));

  for (const id of missing) {
    problems.push(`${m.id}: expected ${id} to fire and it did not. The rule has stopped catching the defect it was written for.`);
  }
  for (const id of unexpected) {
    problems.push(`${m.id}: ${id} fired and is not expected. One change to the page produced a finding somewhere else, which is a false positive until somebody says otherwise.`);
  }
  const realAbstentions = abstained.filter((a) => !a.endsWith(":nothing_to_assess"));
  for (const a of realAbstentions) {
    problems.push(`${m.id}: ${a} abstained. The mutation made a page unreadable rather than defective, so this case is measuring nothing.`);
  }
}

if (record) {
  for (const r of rows) {
    console.log(`${r.id} [${r.seat}]`);
    console.log(`  fired:     ${r.fired.join(", ") || "nothing"}`);
    const real = r.abstained.filter((a) => !a.endsWith(":nothing_to_assess"));
    if (real.length) console.log(`  abstained: ${real.join(", ")}`);
  }
  process.exit(0);
}

// --- the denominators --------------------------------------------------------
const expectedTotal = MUTATIONS.reduce((n, m) => n + m.expects.length, 0);
const seats = [...new Set(MUTATIONS.map((m) => m.seat))];
console.log(
  `eval: ${MUTATIONS.length} mutation(s) of one clean page, across ${corpora.length} rulebook(s), ` +
    `covering ${seats.length} seat(s) (${seats.join(", ")}); ` +
    `${expectedTotal} expectation(s) checked exactly, control fired nothing`,
);

if (MUTATIONS.length === 0) {
  console.error("FAIL: zero mutations. An eval that graded nothing must never report a pass.");
  process.exit(1);
}

if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s).`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("OK: every rule caught its own defect, and no mutation produced a finding anywhere else.");
