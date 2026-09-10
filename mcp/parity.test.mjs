/**
 * The corpus runs under TWO DOM implementations. This is what compares them.
 *
 * WHY IT HAS TO EXIST. `collect` was written against a real browser DOM, which is
 * what we use on our side. The customer's MCP server runs the same function
 * against a lightweight parser instead, because the privacy page promises the
 * installed software "makes no network requests of any kind" and shipping a
 * browser to check a heading level is not reasonable.
 *
 * That leaves one behaviour with two implementations and nothing comparing them,
 * which is the defect this house names most often. Without this test, the whole
 * `mcp/dom.mjs` file is a guess: the checks would run, produce plausible output,
 * and quietly disagree with the receipts we send from our own side.
 *
 * SO THIS RUNS BOTH AGAINST THE SAME HTML AND DIFFS THE FACTS. A difference is a
 * finding, not a tolerance to widen.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { loadCorpus } from "../corpus/load.mjs";
import * as seoOnpage from "../corpus/seo-onpage.mjs";
import { assess } from "../report/run.mjs";
import { factsFromFile, TargetError } from "./dom.mjs";

/**
 * A fixture that exercises every branch `collect` has, deliberately including
 * the awkward cases: an empty alt (correct, must not fire), a missing alt
 * (must fire), a generic link with an aria-label (must not fire), a generic link
 * without one (must fire), a skipped heading level, and nested elements deep
 * enough to test the selector builder's depth cap.
 */
const FIXTURE = `<!doctype html>
<html lang="en-GB">
<head>
  <title>A page whose title is comfortably over the sixty character truncation limit</title>
  <meta name="description" content="A description.">
  <link rel="canonical" href="https://example.test/">
  <meta name="viewport" content="width=device-width">
</head>
<body>
  <h1 id="main">The heading</h1>
  <section>
    <h3>Skips a level on purpose</h3>
    <div><div><div><p>Deeply nested, to exercise the selector depth cap.</p></div></div></div>
  </section>
  <h2>Second section</h2>
  <img src="/decorative.svg" alt="">
  <img src="/meaningful.png">
  <img src="/described.png" alt="A described image">
  <a href="/a">Learn more</a>
  <a href="/b" aria-label="See this weekend's market schedule">Learn more</a>
  <a href="/c"><img src="/icon.png" alt="Home"></a>
  <a href="/d">See this weekend's market schedule</a>
  <p>Enough body text that the coverage floor is comfortably cleared, because a thin page is
  withheld rather than assessed and that would make this fixture test the wrong thing. Padding
  follows so the character count is unambiguous and the assertion is about parity rather than
  about abstention. Lorem ipsum is avoided deliberately; this sentence exists to add length.</p>
</body>
</html>`;

let dir;
let file;

test("setup", () => {
  dir = mkdtempSync(path.join(tmpdir(), "proof-parity-"));
  file = path.join(dir, "fixture.html");
  writeFileSync(file, FIXTURE, "utf8");
});

test("the parser and a real browser collect the SAME facts from the same HTML", async () => {
  const corpus = loadCorpus(seoOnpage);

  // The customer's path: a local parser, no browser, no network.
  const parsed = factsFromFile(file, corpus.collect);

  // Our path: a real browser.
  const browser = await chromium.launch();
  let real;
  try {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded" });
    real = await page.evaluate(corpus.collect);
  } finally {
    await browser.close();
  }

  // The denominator first. Two empty objects would compare equal and prove
  // nothing, which is the shape of a test that certifies silence.
  assert.ok(real.counts.headings >= 3, `the fixture must have headings, got ${real.counts.headings}`);
  assert.ok(real.counts.images >= 3, `the fixture must have images, got ${real.counts.images}`);
  assert.ok(real.counts.links >= 4, `the fixture must have links, got ${real.counts.links}`);

  // The scalars.
  assert.equal(parsed.lang, real.lang, "lang differs between implementations");
  assert.equal(parsed.title, real.title, "title differs");
  assert.equal(parsed.metaDescription, real.metaDescription, "meta description differs");
  assert.equal(parsed.canonical, real.canonical, "canonical differs");
  assert.equal(parsed.viewport, real.viewport, "viewport differs");

  // The collections, compared structurally including their selectors, because a
  // selector is the LOCATOR on every finding: if the two implementations build
  // different ones, our receipt cites something the customer's run does not.
  assert.deepEqual(parsed.headings, real.headings, "headings, text or selectors differ");
  assert.deepEqual(parsed.images, real.images, "images, alt values or selectors differ");
  assert.deepEqual(parsed.links, real.links, "links, hrefs, aria-labels or selectors differ");

  // Counts, except body text length, which legitimately differs by whitespace
  // handling and is only ever compared against a floor.
  assert.equal(parsed.counts.headings, real.counts.headings);
  assert.equal(parsed.counts.images, real.counts.images);
  assert.equal(parsed.counts.links, real.counts.links);
  assert.ok(
    Math.abs(parsed.counts.bodyTextLength - real.counts.bodyTextLength) < 60,
    `body text length differs by more than whitespace: ${parsed.counts.bodyTextLength} vs ${real.counts.bodyTextLength}`,
  );
});

test("and the two paths therefore produce the SAME findings", async () => {
  /*
   * Parity of facts is the mechanism; parity of FINDINGS is what the customer
   * experiences. A receipt we send that names two problems, against a run on
   * their machine that names three, is worse than either being wrong alone.
   */
  const corpus = loadCorpus(seoOnpage);
  const parsedReport = assess(corpus, factsFromFile(file, corpus.collect));

  const browser = await chromium.launch();
  let realReport;
  try {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded" });
    realReport = assess(corpus, await page.evaluate(corpus.collect));
  } finally {
    await browser.close();
  }

  assert.equal(parsedReport.status, realReport.status, "one path withheld and the other did not");
  assert.equal(parsedReport.coverage, realReport.coverage);

  const ids = (r) => r.findings.map((f) => `${f.ruleId}@${f.evidence.selector}`).sort();
  // The fixture is built to trip several rules, so an empty comparison here would
  // be the test proving nothing.
  assert.ok(ids(realReport).length >= 3, `the fixture must produce findings, got ${ids(realReport).length}`);
  assert.deepEqual(ids(parsedReport), ids(realReport), "the two paths report different findings");
});

test("the fixture trips the rules it was built to trip, in both directions", () => {
  const corpus = loadCorpus(seoOnpage);
  const report = assess(corpus, factsFromFile(file, corpus.collect));
  const fired = new Set(report.findings.map((f) => f.ruleId));

  // Must fire.
  assert.ok(fired.has("onpage.title-truncates"), "the long title must trip truncation");
  assert.ok(fired.has("onpage.heading-level-skipped"), "h1 to h3 must trip the skip rule");
  assert.ok(fired.has("onpage.image-alt-missing"), "the img with no alt attribute must fire");
  assert.ok(fired.has("onpage.link-text-generic"), "the bare 'Learn more' must fire");

  // Must NOT fire, which is the half that proves the rules discriminate.
  assert.ok(!fired.has("onpage.title-missing"), "there is a title");
  assert.ok(!fired.has("onpage.lang-missing"), "lang is set");
  assert.ok(!fired.has("onpage.canonical-missing"), "canonical is set");
  assert.ok(!fired.has("onpage.meta-description-missing"), "a description is set");
  assert.ok(!fired.has("onpage.h1-missing"), "there is an h1");
  assert.ok(!fired.has("onpage.h1-multiple"), "there is exactly one h1");

  // And exactly one alt-missing finding: the empty alt is decorative and correct,
  // the described one is fine, only the attribute-less one counts.
  const altFindings = report.findings.filter((f) => f.ruleId === "onpage.image-alt-missing");
  assert.equal(altFindings.length, 1, "only the img with NO alt attribute should fire");

  // And exactly one generic-link finding, out of three generic-looking links.
  const linkFindings = report.findings.filter((f) => f.ruleId === "onpage.link-text-generic");
  assert.equal(linkFindings.length, 1, "aria-label and image-wrapped links are exempt");
});

test("a missing, empty or oversized target is refused with a reason, not a stack trace", () => {
  const corpus = loadCorpus(seoOnpage);
  assert.throws(() => factsFromFile("", corpus.collect), TargetError);
  assert.throws(() => factsFromFile(path.join(dir, "nope.html"), corpus.collect), /does not exist/);

  const empty = path.join(dir, "empty.html");
  writeFileSync(empty, "", "utf8");
  // Distinct from unreadable: an empty file is a build that produced nothing, and
  // saying which saves somebody debugging the wrong thing.
  assert.throws(() => factsFromFile(empty, corpus.collect), /is empty/);

  assert.throws(() => factsFromFile(dir, corpus.collect), /is a directory/);
});

test("teardown", () => {
  rmSync(dir, { recursive: true, force: true });
});
