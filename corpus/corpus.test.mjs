/**
 * Tests for the corpus contract and the assessor.
 *
 * The loader is the only thing standing between "we wrote a rule" and "we shipped
 * a rule", so most of this file is about what it REFUSES. Every refusal test
 * first proves the same corpus loads when the one thing under test is correct,
 * because a test asserting a refusal over a corpus that was broken for another
 * reason proves nothing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadCorpus, CorpusContractError } from "./load.mjs";
import * as seoOnpage from "./seo-onpage.mjs";
import { assess } from "../report/run.mjs";

/** A minimal corpus that PASSES, used as the base for every refusal case. */
const validRule = () => ({
  id: "test.rule",
  family: "structure",
  weight: 3,
  severity: "medium",
  title: "A test rule",
  rationale:
    "This rationale exists to be long enough to explain the rule to a reader who disagrees with it.",
  falsePositiveNote:
    "This rule is wrong on a page that deliberately does the thing it flags, for example a demo " +
    "page built to show the defect, where flagging it is the point rather than a mistake.",
  prevention: "Do not do the thing.",
  since: "test-2026.09",
  detect: () => [],
});

const corpusWith = (rule) => ({
  CORPUS_ID: "test",
  CORPUS_VERSION: "test-2026.09",
  collect: () => ({}),
  RULES: [rule],
});

const facts = (over = {}) => ({
  lang: "en",
  title: "A title",
  metaDescription: "A description",
  canonical: "https://example.com/",
  viewport: "width=device-width",
  headings: [{ level: 1, text: "H", selector: "h1" }],
  images: [],
  links: [],
  counts: { headings: 1, images: 0, links: 0, bodyTextLength: 1000 },
  ...over,
});

test("the real corpus loads, and every rule in it satisfies the contract", () => {
  const c = loadCorpus(seoOnpage);
  assert.equal(c.id, "seo-onpage");
  assert.ok(c.rules.length >= 10, `expected at least 10 rules, got ${c.rules.length}`);
  // Absolute members, not just a count, so emptying the corpus and the assertion
  // together is still caught.
  const ids = c.rules.map((r) => r.id);
  for (const required of ["onpage.title-missing", "onpage.h1-missing", "onpage.image-alt-missing"]) {
    assert.ok(ids.includes(required), `the corpus must define ${required}`);
  }
});

test("a corpus with no rules is a FAILURE, not an empty result", () => {
  assert.equal(loadCorpus(corpusWith(validRule())).rules.length, 1, "presence: one rule loads");
  assert.throws(
    () => loadCorpus({ CORPUS_ID: "t", CORPUS_VERSION: "v", collect: () => ({}), RULES: [] }),
    /loaded ZERO rules/,
  );
});

test("a rule with no falsePositiveNote is refused, which is the loader's whole reason to exist", () => {
  assert.doesNotThrow(() => loadCorpus(corpusWith(validRule())), "presence: the note-carrying rule loads");
  const r = validRule();
  delete r.falsePositiveNote;
  assert.throws(() => loadCorpus(corpusWith(r)), /no falsePositiveNote/);
});

test("a HEDGE is refused even when it is LONG enough to pass the length gate", () => {
  /*
   * FOUND BY MUTATION. The first version of this test used only short hedges, all
   * of them under the 80-character minimum, so the LENGTH gate rejected every one
   * and the hedge gate was never reached by any input in the suite. Disabling the
   * hedge gate left all 41 tests green: it was dead code.
   *
   * So the cases below are padded past the minimum. If the hedge gate is removed
   * these pass the length check and load, which is what makes this test live.
   */
  const longHedges = [
    "This rule may occasionally be wrong, and the reader should weigh it against the rest of the " +
      "report before acting on anything it says at all.",
    "It is sometimes wrong, so treat the output as advisory rather than as a definitive statement " +
      "about the quality of the page in question.",
    "Not always accurate. Use your own judgement about whether this finding is worth acting on, " +
      "since every page is different from every other page.",
  ];
  for (const hedge of longHedges) {
    assert.ok(hedge.length >= 80, "the case must be long enough to reach the hedge gate");
    assert.throws(
      () => loadCorpus(corpusWith({ ...validRule(), falsePositiveNote: hedge })),
      /hedges without naming a condition/,
      `expected refusal for ${JSON.stringify(hedge.slice(0, 40))}`,
    );
  }

  // And the discriminating case: a note that hedges AND names the condition is
  // ACCEPTED, because otherwise the gate would fire on honest prose and honest
  // prose is what a real note reads like.
  assert.doesNotThrow(
    () =>
      loadCorpus(
        corpusWith({
          ...validRule(),
          falsePositiveNote:
            "This may be wrong on an email template or an embedded widget, where the artifact was " +
            "never a whole page a person could navigate to.",
        }),
      ),
    "a hedge that names its condition is a real note and must load",
  );
});

test("a placeholder note is refused whatever its length", () => {
  for (const p of ["n/a", "TBD", "Not applicable.", "See above"]) {
    assert.throws(
      () => loadCorpus(corpusWith({ ...validRule(), falsePositiveNote: p })),
      CorpusContractError,
      `expected refusal for ${JSON.stringify(p)}`,
    );
  }
  assert.doesNotThrow(() => loadCorpus(corpusWith(validRule())));
});

test("a note that is short but not on the hedge list is still refused, by length", () => {
  const r = { ...validRule(), falsePositiveNote: "Wrong on single-page sites." };
  assert.throws(() => loadCorpus(corpusWith(r)), /under the 80 minimum/);
});

test("duplicate ids, bad weights, bad severities and missing fields are each refused", () => {
  const base = validRule();
  const cases = [
    ["duplicate id", { ...base, id: base.id }, /duplicate id/, true],
    ["weight 0", { ...base, weight: 0 }, /expected 1 to 10/, false],
    ["weight 11", { ...base, weight: 11 }, /expected 1 to 10/, false],
    ["severity", { ...base, severity: "critical" }, /expected low, medium or high/, false],
    ["no prevention", { ...base, prevention: "" }, /no prevention/, false],
    ["short rationale", { ...base, rationale: "too short" }, /rationale is missing or too short/, false],
    ["no since", { ...base, since: "" }, /no since version/, false],
    ["detect not a function", { ...base, detect: "nope" }, /detect is not a function/, false],
  ];
  for (const [label, rule, re, isDuplicate] of cases) {
    const mod = isDuplicate
      ? { CORPUS_ID: "t", CORPUS_VERSION: "v", collect: () => ({}), RULES: [base, rule] }
      : corpusWith(rule);
    assert.throws(() => loadCorpus(mod), re, `expected refusal for ${label}`);
  }
  assert.doesNotThrow(() => loadCorpus(corpusWith(validRule())));
});

test("a corpus with no version is refused, because a receipt cites the version it ran under", () => {
  assert.throws(
    () => loadCorpus({ CORPUS_ID: "t", collect: () => ({}), RULES: [validRule()] }),
    /has no CORPUS_VERSION/,
  );
});

// --- the assessor ------------------------------------------------------------

test("a page with too little text is not_assessed, and its findings are WITHHELD not printed", () => {
  const corpus = loadCorpus(seoOnpage);
  const empty = facts({
    title: null,
    lang: null,
    metaDescription: null,
    canonical: null,
    headings: [],
    counts: { headings: 0, images: 0, links: 0, bodyTextLength: 12 },
  });
  const r = assess(corpus, empty);
  assert.equal(r.status, "not_assessed");
  assert.equal(r.abstention.code, "page_not_readable");
  assert.deepEqual(r.findings, [], "a withheld report must not publish the findings it withheld");
  assert.ok(r.findingsWithheld > 0, "and it must say how many it withheld, not pretend there were none");
});

test("a clean page is assessed with zero findings, which is different from not_assessed", () => {
  const corpus = loadCorpus(seoOnpage);
  const r = assess(corpus, facts());
  assert.equal(r.status, "assessed");
  assert.deepEqual(r.findings, []);
  assert.equal(r.coverage, 1);
  assert.equal(r.rulesEvaluated.length, corpus.rules.length);
  // The distinction this whole design rests on: "we found nothing" and "we read
  // nothing" must not produce the same report.
  assert.notEqual(r.status, "not_assessed");
});

test("a rule that throws lowers coverage and makes the report inconclusive, never clean", () => {
  const corpus = loadCorpus({
    CORPUS_ID: "t",
    CORPUS_VERSION: "v",
    collect: () => ({}),
    RULES: [
      validRule(),
      { ...validRule(), id: "test.explodes", detect: () => { throw new Error("boom"); } },
    ],
  });
  const r = assess(corpus, facts());
  assert.equal(r.status, "inconclusive", "a broken rule must never present as a clean page");
  assert.equal(r.coverage, 0.5);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].ruleId, "test.explodes");
  assert.match(r.abstention.reason, /ours to fix, not yours/);
});

test("every finding carries a locator, an observed value and the false-positive note", () => {
  const corpus = loadCorpus(seoOnpage);
  const bad = facts({
    title: null,
    lang: null,
    metaDescription: null,
    canonical: null,
    headings: [],
    images: [{ alt: null, src: "/a.png", selector: "img" }],
    counts: { headings: 0, images: 1, links: 0, bodyTextLength: 1000 },
  });
  const r = assess(corpus, bad);
  assert.ok(r.findings.length >= 5, `expected several findings, got ${r.findings.length}`);
  for (const f of r.findings) {
    assert.ok(f.evidence.selector, `${f.ruleId} has no locator`);
    assert.ok(f.evidence.observed, `${f.ruleId} has no observed value`);
    assert.ok(f.falsePositiveNote.length >= 80, `${f.ruleId} lost its note on the way to the report`);
    assert.ok(f.prevention, `${f.ruleId} can fire and cannot say what to change`);
  }
});

test("an empty alt is CORRECT and does not fire, which is the point of that rule", () => {
  const corpus = loadCorpus(seoOnpage);
  const decorative = facts({
    images: [{ alt: "", src: "/decoration.svg", selector: "img" }],
    counts: { headings: 1, images: 1, links: 0, bodyTextLength: 1000 },
  });
  const r = assess(corpus, decorative);
  assert.ok(
    !r.findings.some((f) => f.ruleId === "onpage.image-alt-missing"),
    'alt="" means decorative and must not be reported as missing',
  );
  // Presence: a genuinely absent attribute DOES fire, so the above is not the
  // rule being dead.
  const missing = facts({
    images: [{ alt: null, src: "/x.png", selector: "img" }],
    counts: { headings: 1, images: 1, links: 0, bodyTextLength: 1000 },
  });
  assert.ok(assess(corpus, missing).findings.some((f) => f.ruleId === "onpage.image-alt-missing"));
});

test("a generic link with an aria-label or an image does not fire", () => {
  const corpus = loadCorpus(seoOnpage);
  const fired = (links) =>
    assess(corpus, facts({ links, counts: { headings: 1, images: 0, links: links.length, bodyTextLength: 1000 } }))
      .findings.some((f) => f.ruleId === "onpage.link-text-generic");

  // Presence first: a bare generic link fires.
  assert.equal(fired([{ text: "Learn more", href: "/x", selector: "a", hasImage: false, ariaLabel: null }]), true);
  // Then the two documented exemptions.
  assert.equal(
    fired([{ text: "Learn more", href: "/x", selector: "a", hasImage: false, ariaLabel: "See the market schedule" }]),
    false,
    "an aria-label that says where it goes is the accessible name",
  );
  assert.equal(
    fired([{ text: "more", href: "/x", selector: "a", hasImage: true, ariaLabel: null }]),
    false,
    "a link wrapping an image is named by the image's alt text",
  );
});
