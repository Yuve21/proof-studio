/**
 * Tests for the `claims-officer` corpus.
 *
 * THE NEGATION CASES ARE THE MOST IMPORTANT TESTS IN THIS FILE, more than the
 * ones that prove a claim is caught.
 *
 * This project's own claims guard failed a build on the sentence "Nobody can
 * promise a ranking, a position, an amount of traffic or a number of customers",
 * which is the opposite of a promise and is exactly the sentence a careful legal
 * page needs. A guard that rejects that sentence is a guard somebody edits around
 * rather than obeys, and then it protects nothing.
 *
 * So every rule is asserted in both directions, and the disclaimer half is
 * asserted with the real sentences from our own terms page rather than with
 * invented ones.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { loadCorpus } from "./load.mjs";
import * as claims from "./claims-officer.mjs";
import { assess } from "../report/run.mjs";

const PAD =
  "<p>Padding so the page clears the readability floor and is assessed rather than withheld, " +
  "because a withheld report publishes nothing and this fixture would then be testing abstention " +
  "instead of the rules it exists for. A few more words make the length unambiguous.</p>";

const page = (body) =>
  `<!doctype html><html lang="en"><head><title>T</title></head><body><main>${body}${PAD}</main></body></html>`;

const run = (html) => {
  const corpus = loadCorpus(claims);
  const { document } = parseHTML(html);
  const facts = new Function("document", `return (${corpus.collect.toString()})();`)(document);
  return { report: assess(corpus, facts), facts };
};
const firedIds = (report) => new Set(report.findings.map((f) => f.ruleId));

test("the corpus loads and satisfies the contract", () => {
  const c = loadCorpus(claims);
  assert.equal(c.id, "claims-officer");
  assert.equal(c.rules.length, 8);
  assert.deepEqual(c.requiresSubject, { key: "sentences", label: "sentence of visible text" });
});

test("each rule fires on the claim it is written for", () => {
  const cases = [
    ["claims.performance-figure", "<p>Our system is 94% accurate on real customer data.</p>"],
    ["claims.guaranteed-ranking", "<p>We guarantee page one on Google within ninety days.</p>"],
    ["claims.guaranteed-outcome", "<p>Guaranteed results: we will double your sales this quarter.</p>"],
    ["claims.health-benefit", "<p>Our maple lemonade boosts your immune system every morning.</p>"],
    ["claims.natural-or-organic-unqualified", "<p>Every bottle is 100% all natural.</p>"],
    ["claims.free-with-strings", "<p>Get a free tote when you spend $40 in one visit.</p>"],
    ["claims.unqualified-superlative", "<p>The best lemonade in the city, three years running.</p>"],
  ];
  for (const [id, body] of cases) {
    const { report, facts } = run(page(body));
    assert.ok(facts.counts.sentences > 0, "the fixture must produce sentences");
    assert.ok(firedIds(report).has(id), `${id} should have fired on: ${body}`);
  }
});

test("a deadline in the past fires, and one without a year never does", () => {
  const passed = run(page("<p>This offer ends March 1, 2020, so do not wait.</p>"));
  assert.ok(firedIds(passed.report).has("claims.deadline-already-passed"));
  const finding = passed.report.findings.find((f) => f.ruleId === "claims.deadline-already-passed");
  assert.match(finding.evidence.observed, /has passed/);

  /*
   * The half that keeps this rule usable. "Ends Sunday" is almost always true and
   * there is no way to tell from parsed text, so a rule that fired on it would be
   * wrong most of the time and would be switched off.
   */
  for (const body of [
    "<p>This offer ends Sunday, so do not wait.</p>",
    "<p>This weekend only, at the market.</p>",
    "<p>Last chance before we close for the season.</p>",
  ]) {
    assert.ok(
      !firedIds(run(page(body)).report).has("claims.deadline-already-passed"),
      `must not fire without a full date: ${body}`,
    );
  }

  // And a FUTURE dated deadline must not fire either.
  const future = `<p>This offer ends December 1, ${new Date().getFullYear() + 2}.</p>`;
  assert.ok(!firedIds(run(page(future)).report).has("claims.deadline-already-passed"));
});

test("A DISCLAIMER IS NOT A CLAIM, using the real sentences from our own terms page", () => {
  /*
   * These are the sentences that broke this project's own build. Every one of
   * them is the OPPOSITE of the claim its rule looks for, and every one is a
   * sentence a careful site wants to contain.
   */
  const disclaimers = [
    "Nobody can promise a ranking, a position, an amount of traffic or a number of customers.",
    "It is not a prediction about search results, and we do not make one.",
    "We do not guarantee results and we never have.",
    "We make no health claims about any of our drinks.",
    "None of this is clinically proven and we do not say it is.",
    "There is no guarantee of page one and anybody offering one is guessing.",
    "Nothing here is 100% all natural, and we do not label it that way.",
  ];
  for (const sentence of disclaimers) {
    const { report } = run(page(`<p>${sentence}</p>`));
    assert.deepEqual(
      report.findings.map((f) => f.ruleId),
      [],
      `this disclaimer must not be reported as a claim: ${sentence}`,
    );
  }
});

test("a negation in a DIFFERENT sentence does not excuse a claim in this one", () => {
  /*
   * The other half of the negation problem, and the reason the collector splits
   * on sentence boundaries rather than on blocks. If a negation anywhere nearby
   * excused a claim, any promise could hide behind an unrelated disclaimer.
   */
  const html = page("<p>We do not cut corners. We guarantee page one on Google.</p>");
  const { report, facts } = run(html);
  assert.ok(facts.counts.sentences >= 2, "the block must have split into sentences");
  assert.ok(
    firedIds(report).has("claims.guaranteed-ranking"),
    "a disclaimer in the previous sentence must not excuse the claim in this one",
  );
});

test("our own marketing page produces no findings, over a real denominator", () => {
  /*
   * The dogfood assertion. It is only meaningful because the denominator is
   * reported: 'nothing fired' over zero sentences would be silence, and over ~189
   * it is a result. The corpus declares `sentences` as its subject precisely so
   * the empty case abstains instead of looking clean.
   */
  const built = ".next/server/app/index.html";
  let html;
  try {
    html = readFileSync(built, "utf8");
  } catch {
    // The build output is not always present, for example on a fresh clone before
    // `npm run build`. Skipping is honest; pretending to have checked is not.
    console.log("    (skipped: no build output at " + built + ", run npm run build first)");
    return;
  }
  const { report, facts } = run(html);
  assert.ok(facts.counts.sentences > 100, `expected a real page, got ${facts.counts.sentences} sentences`);
  assert.equal(report.status, "assessed");
  assert.deepEqual(
    report.findings.map((f) => `${f.ruleId} @ ${f.evidence.selector}`),
    [],
    "our own marketing page must not carry an unsubstantiated claim",
  );
});

test("a page with no prose abstains rather than reporting clean claims", () => {
  const { report } = run(`<!doctype html><html lang="en"><head><title>T</title></head><body><div></div></body></html>`);
  assert.equal(report.status, "not_assessed");
  // Either abstention is correct here: the page is both unreadable and has no
  // sentences. What matters is that it is NOT reported as assessed and clean.
  assert.ok(["nothing_to_assess", "page_not_readable"].includes(report.abstention.code));
  assert.deepEqual(report.findings, []);
});

test("every finding carries the sentence it read, so a reader can judge it", () => {
  const { report } = run(page("<p>We guarantee page one and 99% satisfaction.</p>"));
  assert.ok(report.findings.length >= 1);
  for (const f of report.findings) {
    assert.ok(f.evidence.selector, `${f.ruleId} has no locator`);
    assert.match(f.evidence.observed, /guarantee|99%/, `${f.ruleId} must quote what it read`);
    // The rebuttal travels with the finding, because a claims finding a customer
    // cannot argue with is one they will either ignore or over-correct.
    assert.ok(f.falsePositiveNote.length >= 80);
    assert.ok(f.prevention.length > 20);
  }
});

test("a negation AFTER the claim does not suppress it, which is the failure that hides", () => {
  /*
   * FOUND BY A FAILING TEST, and it is the opposite defect from the one the
   * negation check exists to prevent.
   *
   * The first version tested the WHOLE sentence for a negator, so
   * "This offer ends March 1, 2020, so do not wait" was silently skipped, because
   * "do not" appears after the claim as part of an urgency phrase.
   *
   * That is worse than a false positive. A claim wrongly reported gets argued
   * with and corrected. A claim silently skipped is invisible, and the customer
   * believes the page was checked. So a negation only disclaims what FOLLOWS it.
   */
  const cases = [
    ["claims.guaranteed-ranking", "We guarantee page one on Google, so do not miss out."],
    ["claims.guaranteed-outcome", "Guaranteed results in ninety days, no excuses."],
    ["claims.health-benefit", "It boosts your immune system, and nothing else comes close."],
    ["claims.performance-figure", "We are 99% accurate, never less."],
  ];
  for (const [id, sentence] of cases) {
    const { report } = run(page(`<p>${sentence}</p>`));
    assert.ok(
      firedIds(report).has(id),
      `a negation after the claim must not suppress it: ${sentence}`,
    );
  }

  // And the pairing that proves the check still works in the direction it was
  // written for: the SAME claim, negated BEFORE, stays quiet.
  for (const [id, sentence] of [
    ["claims.guaranteed-ranking", "We do not guarantee page one on Google."],
    ["claims.health-benefit", "It does not boost your immune system."],
    ["claims.performance-figure", "We never claim to be 99% accurate."],
  ]) {
    const { report } = run(page(`<p>${sentence}</p>`));
    assert.ok(!firedIds(report).has(id), `a negation before the claim must suppress it: ${sentence}`);
  }
});

