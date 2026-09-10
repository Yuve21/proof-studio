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
import { parseHTML } from "linkedom";
import { chromium } from "playwright";
import { loadCorpus } from "../corpus/load.mjs";
import * as seoOnpage from "../corpus/seo-onpage.mjs";
import { CORPORA } from "../report/run.mjs";
import { conformToHtmlParsing, isForeignRoot } from "./parser-conformance.mjs";
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

test("no blurb reaches a customer carrying raw markdown", async () => {
  /*
   * FOUND BY USING THE PRODUCT rather than by reading it. The plan document is
   * markdown, and a blurb goes straight to a customer through list_agents and
   * through every department prompt. Three of the sixty-two carried raw
   * emphasis, so a real MCP client displayed
   * "pass, fail or **skipped, with a denominator for each**" to a paying
   * customer.
   *
   * Asserted over the WHOLE roster rather than the three that were wrong,
   * because the plan is markdown by design and the next person to write a seat
   * will use emphasis again.
   */
  const { loadRoster } = await import("../licence/roster.mjs");
  const roster = loadRoster("docs/AGENT-ROSTER-PLAN.md");
  assert.equal(roster.size, 62, "the denominator, so this cannot pass over an empty roster");

  const offenders = [...roster.values()].filter((s) => /\*\*|`|\[[^\]]*\]\(/.test(s.blurb));
  assert.deepEqual(
    offenders.map((s) => s.id),
    [],
    "these blurbs would show markdown syntax to a customer",
  );

  // And the presence half: the sanitiser must not have eaten the text. These
  // three are the ones that carried emphasis, so they are the proof it stripped
  // syntax rather than content.
  assert.match(roster.get("release-verifier").blurb, /pass, fail or skipped, with a denominator/);
  assert.match(roster.get("false-positive-hunter").blurb, /Mandatory second reviewer/);
  assert.ok(roster.get("claims-officer").blurb.length > 40);
});


/**
 * THE GAP THAT LET A REAL DEFECT THROUGH, closed here.
 *
 * Everything above compares ONE rulebook, `seo-onpage`, against a fixture I wrote
 * by hand in lowercase HTML. Both halves of that turned out to matter.
 *
 * A dogfood test in `corpus/technical.test.mjs` reported that our own home page
 * has no charset declaration. It is the first element in the head. The cause was
 * that linkedom preserves attribute case while a browser lowercases it, and React
 * emits `charSet`, so `getAttribute("charset")` returned null on the customer's
 * path and the correct value in a browser. `forms.autocomplete-missing` had the
 * same defect against React's `autoComplete`.
 *
 * The parity test could not see either, for two reasons that are both about
 * coverage rather than about the comparison: the fixture contained no camelCase
 * attribute, and four of the five rulebooks were not compared at all.
 *
 * So this fixture is deliberately written the way React SERIALISES a page, and
 * the comparison runs over every corpus the product ships.
 */
const REACT_FIXTURE = `<!doctype html>
<html lang="en">
<head>
  <meta charSet="utf-8"/>
  <title>A page serialised the way React writes one, with camelCase attribute names</title>
  <meta name="description" content="A description."/>
  <link rel="canonical" href="https://example.test/"/>
  <link rel="alternate" hrefLang="en-GB" href="https://example.test/gb"/>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Example","url":"https://example.test/"}</script>
</head>
<body>
  <main>
    <h1>The heading</h1>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M0 0h24v24H0z"/></svg>
    <form action="/api/apply" method="post">
      <label for="email">Your email</label>
      <input id="email" name="email" type="email" autoComplete="email" required/>
      <input id="tel" name="tel" type="tel" autoComplete="tel"/>
      <button type="submit">Apply</button>
    </form>
    <table>
      <tr><th scope="col">Item</th><th scope="col">Price</th></tr>
      <tr><td colSpan="2">Nothing yet</td></tr>
    </table>
    <a href="/about" tabIndex="0">About us and what we do</a>
    <p>Enough body text that the readability floor is comfortably cleared, because a thin page is
    withheld rather than assessed and that would make this fixture test abstention instead of
    parity. This sentence exists to add length and it is doing its job.</p>
  </main>
</body>
</html>`;


/**
 * Its own temp directory, created on demand. The shared one above is removed by
 * the teardown test, and these tests run after it: reusing it produced an ENOENT
 * that looked like a parity failure rather than a harness mistake.
 */
const reactFixtureFile = () => {
  const d = mkdtempSync(path.join(tmpdir(), "proof-parity-react-"));
  const p = path.join(d, "react.html");
  writeFileSync(p, REACT_FIXTURE, "utf8");
  return p;
};

test("the normaliser actually renames something, so parity below cannot pass by doing nothing", () => {
  /*
   * The denominator for the two tests that follow. If the fixture stopped
   * containing a camelCase attribute, or the normaliser became a no-op, the
   * comparisons would still pass and would be proving nothing. This asserts the
   * divergence EXISTS before asserting it is corrected.
   */
  const { document } = parseHTML(REACT_FIXTURE);
  const before = document.querySelector("meta[charset]");
  assert.equal(before, null, "linkedom must NOT match charset before normalisation, or this whole file is moot");

  // And the second divergence: a browser generates a tbody, linkedom does not.
  assert.equal(document.querySelectorAll("tbody").length, 0, "linkedom must not generate a tbody, or that half is moot");

  const result = conformToHtmlParsing(document);
  assert.ok(result.attributes.renamed >= 5, `expected several renames, got ${result.attributes.renamed}`);
  assert.deepEqual(result.attributes.names, ["autoComplete", "charSet", "colSpan", "hrefLang", "tabIndex"]);
  assert.ok(document.querySelector("meta[charset]"), "charset must match after normalisation");
  assert.ok(result.tbody.groups >= 1, "a tbody must have been generated");
  assert.equal(document.querySelectorAll("tbody").length, result.tbody.groups);
  // The rows moved INTO it rather than being copied, so the table still has each row once.
  assert.equal(document.querySelectorAll("table > tr").length, 0, "no tr may remain a direct child of table");
  assert.equal(document.querySelectorAll("table tr").length, result.tbody.wrapped);

  // And SVG is left alone, because its attributes are genuinely case-sensitive.
  assert.equal(document.querySelector("svg").getAttribute("viewBox"), "0 0 24 24");
  assert.equal(document.querySelector("svg").getAttribute("viewbox"), null);
});

test("EVERY corpus collects the same facts and reports the same findings under both DOMs", async () => {
  const reactFile = reactFixtureFile();

  const browser = await chromium.launch();
  const results = [];
  try {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(reactFile).href, { waitUntil: "domcontentloaded" });

    for (const mod of CORPORA) {
      const corpus = loadCorpus(mod);
      const parsed = factsFromFile(reactFile, corpus.collect);
      const real = await page.evaluate(corpus.collect);
      results.push({ corpus, parsed, real });
    }
  } finally {
    await browser.close();
  }

  // The denominator, asserted before any comparison. Five empty objects would
  // compare equal five times and certify silence.
  assert.equal(results.length, CORPORA.length);
  assert.ok(results.length >= 5, `expected every shipped rulebook, got ${results.length}`);

  for (const { corpus, parsed, real } of results) {
    for (const key of Object.keys(real.counts)) {
      if (key === "bodyTextLength") {
        // Legitimately differs by whitespace handling; compared against a floor.
        assert.ok(
          Math.abs(parsed.counts[key] - real.counts[key]) < 80,
          `${corpus.id}: body text length differs by more than whitespace: ` +
            `${parsed.counts[key]} vs ${real.counts[key]}`,
        );
        continue;
      }
      assert.equal(
        parsed.counts[key],
        real.counts[key],
        `${corpus.id}: counts.${key} differs between the parser and a browser ` +
          `(${parsed.counts[key]} vs ${real.counts[key]})`,
      );
    }

    const ids = (facts) =>
      assess(corpus, facts)
        .findings.map((f) => `${f.ruleId}@${f.evidence.selector}`)
        .sort();
    assert.deepEqual(
      ids(parsed),
      ids(real),
      `${corpus.id}: the two paths report different findings on React-serialised markup`,
    );
  }
});

test("and the React fixture proves the specific rules that were wrong are now right", async () => {
  /*
   * Parity alone would be satisfied if BOTH paths were wrong in the same way, so
   * this asserts the actual answer rather than only that the two agree. These are
   * the two rules that were silently reporting correct markup as defective.
   */
  const reactFile = reactFixtureFile();

  for (const mod of CORPORA) {
    const corpus = loadCorpus(mod);
    const report = assess(corpus, factsFromFile(reactFile, corpus.collect));
    const fired = new Set(report.findings.map((f) => f.ruleId));

    if (corpus.id === "seo-technical") {
      assert.ok(
        !fired.has("technical.charset-missing-or-late"),
        "the charset is the first element in head; reporting it missing is the defect this closes",
      );
    }
    if (corpus.id === "forms-and-capture") {
      assert.ok(
        !fired.has("forms.autocomplete-missing"),
        "both fields carry autoComplete; reporting it missing is the same defect",
      );
    }
  }
});

test("the foreign-element carve-out is case-insensitive, which parity CANNOT observe", () => {
  /*
   * A mutation making this comparison case-sensitive again survived the whole
   * parity suite, and the reason is worth stating: the normaliser only runs on
   * the linkedom path, because a browser needs no correction, so the browser's
   * lowercase `svg` spelling is never reached there. The uppercase comparison was
   * correct against today's parser.
   *
   * The case-insensitive version stays as defence against that spelling changing,
   * and it is tested here rather than through parity, because a guarantee no test
   * can observe is not a guarantee. It is asserted against BOTH spellings, which
   * is the whole content of the claim.
   */
  for (const tagName of ["svg", "SVG", "math", "MATH"]) {
    assert.equal(isForeignRoot({ tagName }), true, `${tagName} is foreign content`);
  }
  for (const tagName of ["div", "DIV", "meta", "META", "svgicon", ""]) {
    assert.equal(isForeignRoot({ tagName }), false, `${tagName} is not foreign content`);
  }
  // And a missing tagName must not throw, because the walk up parentElement
  // reaches nodes this predicate was not written for.
  assert.equal(isForeignRoot({}), false);
});
