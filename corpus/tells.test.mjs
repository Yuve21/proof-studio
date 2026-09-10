/**
 * Tests for the `template-tells` corpus.
 *
 * TWO THINGS HERE MATTER MORE THAN THE PER-RULE TESTS.
 *
 * The first is the SUBSET assertion. This rulebook exists because the plan
 * claimed it would be "the slop-scorer corpus itself, 104 rules" and it cannot
 * be: thirty of that corpus's fifty-one web rules need a real browser. The
 * vendored scaffold-title list is therefore a positive-match list, and a test
 * asserts a title absent from it is never reported, so nobody can quietly turn a
 * subset into a vocabulary check.
 *
 * The second is that `tells.builder-generator-with-another-tell` is CONDITIONAL.
 * Firing on a builder's generator tag alone would report every Squarespace and
 * Webflow site on the web as defective. Both directions are asserted.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { factsFromHtml } from "../mcp/dom.mjs";
import { loadCorpus } from "./load.mjs";
import * as tells from "./template-tells.mjs";
import { assess } from "../report/run.mjs";

const PAD =
  "<p>Padding so the page clears the readability floor and is assessed rather than withheld, " +
  "because a withheld report publishes nothing and this fixture would then be testing abstention " +
  "instead of the rules it exists for. A few more words make the length unambiguous.</p>";

/** A finished head, so a fixture differs only in the thing it is testing. */
const FINISHED_HEAD =
  `<meta charset="utf-8"><title>Acme Plumbing, emergency repairs in Brooklyn</title>` +
  `<link rel="icon" href="/favicon.svg">` +
  `<meta property="og:image" content="https://acme.test/share.png">` +
  `<link rel="canonical" href="https://acmeplumbing.test/">`;

const page = (body = "", head = FINISHED_HEAD) =>
  `<!doctype html><html lang="en"><head>${head}</head><body><main>${body}${PAD}</main></body></html>`;

/** Raw HTML, for the one test that reads our own built page. */
const runHtml = (html) => {
  const corpus = loadCorpus(tells);
  // The same boundary the customer's install uses. See mcp/parser-conformance.mjs.
  const facts = factsFromHtml(html, corpus.collect);
  return { report: assess(corpus, facts), facts };
};

/**
 * A BODY and optionally a head, wrapped into a whole page.
 *
 * The first version of this file passed body fragments straight to the raw-HTML
 * helper, so every fixture fell under the readability floor and thirteen of
 * fourteen tests failed with not_assessed. Thirteen failures, one cause: the
 * fixture builder existed and was never called.
 */
const run = (body = "", head = FINISHED_HEAD) => runHtml(page(body, head));
const firedIds = (report) => new Set(report.findings.map((f) => f.ruleId));
const observedFor = (report, id) =>
  report.findings.filter((f) => f.ruleId === id).map((f) => f.evidence.observed);

test("the corpus loads and satisfies the contract", () => {
  const c = loadCorpus(tells);
  assert.equal(c.id, "template-tells");
  assert.equal(c.rules.length, 10);
  assert.equal(c.requiresSubject, null);
});

test("A FINISHED PAGE PRODUCES NOTHING, which is what makes the rest meaningful", () => {
  const { report } = run(
    `<h1>Acme Plumbing</h1><p>We fix burst pipes across Brooklyn, same day.</p>` +
      `<a href="https://instagram.com/acmeplumbing">Instagram</a>` +
      `<a href="https://facebook.com/acmeplumbing">Facebook</a>` +
      `<footer><p>&copy; ${new Date().getFullYear()} Acme Plumbing</p></footer>`,
  );
  assert.equal(report.status, "assessed");
  assert.deepEqual(
    report.findings.map((f) => `${f.ruleId} @ ${f.evidence.observed}`),
    [],
    "a finished page must produce nothing",
  );
});

test("a scaffold title is reported, and a real title of any shape is not", () => {
  for (const title of [
    "Create Next App",
    "create next app",
    "  Vite + React  ",
    "React App",
    "Untitled",
    "Document",
    "My Site",
  ]) {
    const { report } = run("", `<meta charset="utf-8"><title>${title}</title>${FINISHED_HEAD.replace(/<title>[^<]*<\/title>/, "")}`);
    assert.ok(
      firedIds(report).has("tells.scaffold-title"),
      `should fire on the framework default: ${JSON.stringify(title)}`,
    );
  }

  for (const title of [
    "Acme Plumbing, emergency repairs in Brooklyn",
    "Pricing",
    "About us",
    "Bakery in Greenpoint since 1994",
  ]) {
    const { report } = run("", `<meta charset="utf-8"><title>${title}</title><link rel="icon" href="/f.svg"><meta property="og:image" content="https://a.test/s.png">`);
    assert.ok(
      !firedIds(report).has("tells.scaffold-title"),
      `must not fire on a real title: ${JSON.stringify(title)}`,
    );
  }
});

test("THE SCAFFOLD LIST IS A SUBSET, and absence from it is never treated as a defect", () => {
  /*
   * The load-bearing property, asserted rather than trusted to a comment. These
   * are titles that ARE framework defaults from tools the list does not cover.
   * If any of them is ever reported, somebody has turned the positive-match list
   * into a vocabulary check, which is the mistake the schema.org vocabulary file
   * exists to prevent.
   */
  for (const title of ["Fresh App", "Bun App", "Deno Fresh Starter", "Laravel"]) {
    const { report } = run("", `<meta charset="utf-8"><title>${title}</title><link rel="icon" href="/f.svg"><meta property="og:image" content="https://a.test/s.png">`);
    assert.ok(
      !firedIds(report).has("tells.scaffold-title"),
      `absence from the vendored list must not be evidence of anything: ${title}`,
    );
  }
  // And absence of a title entirely is onpage's finding, not this one's.
  const noTitle = run("", `<meta charset="utf-8"><link rel="icon" href="/f.svg"><meta property="og:image" content="https://a.test/s.png">`);
  assert.ok(!firedIds(noTitle.report).has("tells.scaffold-title"));
});

test("placeholder copy is reported on the smallest element, and real copy is not", () => {
  const { report } = run("<section><div><p>Lorem ipsum dolor sit amet, consectetur.</p></div></section>");
  const observed = observedFor(report, "tells.placeholder-copy");
  assert.equal(observed.length, 1, `expected one finding, got: ${observed.join(" | ")}`);
  const finding = report.findings.find((f) => f.ruleId === "tells.placeholder-copy");
  assert.match(finding.evidence.selector, /p$/, "the locator must be the paragraph, not an ancestor");

  for (const body of [
    "<h2>Your headline here</h2>",
    "<p>Add your own text in this section.</p>",
    "<h3>Feature One</h3>",
    "<p>Click here to edit this text.</p>",
    "<h4>Subheading</h4>",
  ]) {
    assert.ok(firedIds(run(body).report).has("tells.placeholder-copy"), `should fire: ${body}`);
  }

  for (const body of [
    "<p>We fix burst pipes across Brooklyn, same day.</p>",
    "<h2>What we charge</h2>",
    "<p>Our first van was a 1994 Transit and we still have it.</p>",
  ]) {
    assert.ok(!firedIds(run(body).report).has("tells.placeholder-copy"), `must not fire: ${body}`);
  }
});

test("a social link to the platform front page is reported; a profile and a share link are not", () => {
  for (const href of [
    "https://instagram.com",
    "https://www.instagram.com/",
    "https://facebook.com/",
    "https://x.com",
    "https://www.yelp.com/",
    /*
     * A front page carrying tracking parameters. The first version of the rule
     * skipped any URL with a query string and would have exempted this, which a
     * surviving mutation exposed: a share link is already excluded by having a
     * PATH, so the query guard was doing nothing it claimed and was letting a
     * real placeholder through.
     */
    "https://instagram.com/?utm_source=footer",
    "https://facebook.com/?ref=nav",
  ]) {
    const { report } = run(`<a href="${href}">Follow us</a>`);
    assert.ok(
      firedIds(report).has("tells.social-link-has-no-account"),
      `${href} is the platform front page, not an account`,
    );
  }

  for (const href of [
    "https://instagram.com/acmeplumbing",
    "https://www.facebook.com/acmeplumbing",
    "https://x.com/acme",
    // A share intent carries a query string and is not a placeholder.
    "https://twitter.com/intent/tweet?url=https%3A%2F%2Facme.test",
    "https://acmeplumbing.test/instagram",
  ]) {
    const { report } = run(`<a href="${href}">Share</a>`);
    assert.ok(
      !firedIds(report).has("tells.social-link-has-no-account"),
      `${href} must not be reported`,
    );
  }
});

test("a missing favicon and a missing share image are reported, and every icon rel counts", () => {
  const bare = run("", `<meta charset="utf-8"><title>Acme Plumbing of Brooklyn</title>`);
  assert.ok(firedIds(bare.report).has("tells.no-favicon"));
  assert.ok(firedIds(bare.report).has("tells.no-share-image"));

  for (const rel of ["icon", "shortcut icon", "apple-touch-icon", "mask-icon"]) {
    const { report } = run(
      "",
      `<meta charset="utf-8"><title>Acme Plumbing of Brooklyn</title><link rel="${rel}" href="/f.png">` +
        `<meta property="og:image" content="https://a.test/s.png">`,
    );
    assert.ok(!firedIds(report).has("tells.no-favicon"), `rel="${rel}" is an icon declaration`);
    assert.ok(!firedIds(report).has("tells.no-share-image"));
  }

  // A link tag with the right rel but no href is not a declaration.
  const empty = run("", `<meta charset="utf-8"><title>Acme Plumbing of Brooklyn</title><link rel="icon"><meta property="og:image" content="https://a.test/s.png">`);
  assert.ok(firedIds(empty.report).has("tells.no-favicon"));
});

test("a bare platform subdomain is reported, and the label boundary is respected", () => {
  const head = (canonical) =>
    `<meta charset="utf-8"><title>Acme Plumbing of Brooklyn</title><link rel="icon" href="/f.svg">` +
    `<meta property="og:image" content="https://a.test/s.png"><link rel="canonical" href="${canonical}">`;

  for (const url of [
    "https://acme.vercel.app/",
    "https://acme.netlify.app",
    "https://acme.pages.dev/x",
    "https://yuve21.github.io/proof-studio/",
    "https://acme.wixsite.com/site",
  ]) {
    assert.ok(
      firedIds(run("", head(url)).report).has("tells.bare-platform-domain"),
      `${url} is a bare platform subdomain`,
    );
  }

  /*
   * The boundary that stops this firing on a real domain that merely ends in the
   * same letters. Without matching on a label boundary, notvercel.app and
   * myexample.com would both be reported.
   */
  for (const url of [
    "https://acmeplumbing.test/",
    "https://notvercel.app.acme.test/",
    "https://vercelplumbing.com/",
  ]) {
    assert.ok(
      !firedIds(run("", head(url)).report).has("tells.bare-platform-domain"),
      `${url} is a real domain`,
    );
  }
});

test("THE BUILDER GENERATOR RULE IS CONDITIONAL, so a good Squarespace site is not reported", () => {
  /*
   * The most important negative test in this file. Firing on a builder's
   * generator tag alone would report every Squarespace and Webflow site on the
   * web, which is both wrong and insulting to the people running them.
   */
  const finished =
    `<meta charset="utf-8"><title>Acme Plumbing of Brooklyn</title><link rel="icon" href="/f.svg">` +
    `<meta property="og:image" content="https://a.test/s.png"><meta name="generator" content="Squarespace">` +
    `<link rel="canonical" href="https://acmeplumbing.test/">`;
  const ok = run("<h1>Acme Plumbing</h1><p>We fix burst pipes, same day.</p>", finished);
  assert.ok(
    !firedIds(ok.report).has("tells.builder-generator-with-another-tell"),
    "a builder tag on a finished site must not be reported",
  );

  // WITH a second tell, it fires, and the finding names which one.
  const withScaffoldTitle = finished.replace(
    "<title>Acme Plumbing of Brooklyn</title>",
    "<title>Untitled</title>",
  );
  const fired = run("<h1>Acme</h1>", withScaffoldTitle);
  const observed = observedFor(fired.report, "tells.builder-generator-with-another-tell");
  assert.equal(observed.length, 1);
  assert.match(observed[0], /Squarespace/);
  assert.match(observed[0], /the title is a framework default/);

  // Placeholder copy is also a valid second tell.
  const withPlaceholder = run("<p>Lorem ipsum dolor sit amet.</p>", finished);
  assert.ok(firedIds(withPlaceholder.report).has("tells.builder-generator-with-another-tell"));

  // A framework generator that is not a page builder never counts.
  const framework = finished.replace('content="Squarespace"', 'content="Astro v5.2"');
  const astro = run("<p>Lorem ipsum dolor sit amet.</p>", framework);
  assert.ok(!firedIds(astro.report).has("tells.builder-generator-with-another-tell"));
});

test("a link to a reserved example domain is reported", () => {
  for (const href of ["https://example.com", "http://www.example.com/about", "https://example.org/x"]) {
    assert.ok(
      firedIds(run(`<a href="${href}">Our partner</a>`).report).has("tells.example-domain-link"),
      href,
    );
  }
  for (const href of ["https://myexample.com/x", "https://example.acme.test/", "/example"]) {
    assert.ok(
      !firedIds(run(`<a href="${href}">Link</a>`).report).has("tells.example-domain-link"),
      `${href} is not a reserved documentation domain`,
    );
  }
});

test("a stale copyright year is reported, and a current one or a range is not", () => {
  const year = new Date().getFullYear();

  const stale = run(`<footer><p>&copy; ${year - 4} Acme Plumbing</p></footer>`);
  const observed = observedFor(stale.report, "tells.copyright-year-stale");
  assert.equal(observed.length, 1);
  assert.match(observed[0], new RegExp(`copyright ${year - 4}`));
  assert.match(observed[0], /4 years behind/);

  for (const text of [
    `&copy; ${year} Acme Plumbing`,
    `&copy; ${year - 1} Acme Plumbing`,
    // A RANGE dates the business, not the last edit, and is excluded.
    `&copy; 1994-${year} Acme Plumbing`,
    `Copyright 2019 to ${year} Acme`,
    // A future year is somebody else's problem, not a stale one.
    `&copy; ${year + 1} Acme Plumbing`,
  ]) {
    assert.ok(
      !firedIds(run(`<footer><p>${text}</p></footer>`).report).has("tells.copyright-year-stale"),
      `must not fire: ${text}`,
    );
  }

  // Two years behind is the threshold, so exactly two fires and one does not.
  assert.ok(
    firedIds(run(`<footer><p>&copy; ${year - 2} Acme</p></footer>`).report).has(
      "tells.copyright-year-stale",
    ),
  );
});

test("em dash density needs a real denominator before it says anything", () => {
  const dash = String.fromCharCode(0x2014);
  const c = loadCorpus(tells);
  const rule = c.rules.find((r) => r.id === "tells.em-dash-density");
  assert.equal(rule.severity, "low", "a style signal must never be reported as serious");
  assert.equal(rule.weight, 3);

  /*
   * A SHORT page with many dashes must stay silent. Without the word floor, one
   * quoted sentence containing two dashes clears any per-thousand threshold, and
   * the rule would fire on a contact page.
   */
  const short = run(`<p>We open at nine ${dash} and close at six ${dash} most days.</p>`);
  assert.ok(
    !firedIds(short.report).has("tells.em-dash-density"),
    "under the word floor the rate is not a rate",
  );

  // A long page over the threshold fires, and the finding shows the arithmetic.
  const sentence = `Our team ${dash} which has grown ${dash} handles every job with care. `;
  const long = run(`<p>${sentence.repeat(60)}</p>`);
  const observed = observedFor(long.report, "tells.em-dash-density");
  assert.equal(observed.length, 1);
  assert.match(observed[0], /em dashes across \d+ words, a rate of \d+\.\d per thousand/);
  assert.match(observed[0], /against a threshold of 6/);

  // A long page with ordinary punctuation stays silent.
  const plain = run(`<p>${"Our team handles every job with care and we always call ahead. ".repeat(60)}</p>`);
  assert.ok(!firedIds(plain.report).has("tells.em-dash-density"));
});

test("every finding carries a locator and the rebuttal travels with it", () => {
  const { report } = run(
    "<p>Lorem ipsum dolor sit amet.</p><a href='https://instagram.com'>Follow</a>",
    `<meta charset="utf-8"><title>Create Next App</title>`,
  );
  assert.ok(report.findings.length >= 4);
  for (const f of report.findings) {
    assert.ok(f.evidence.selector, `${f.ruleId} has no locator`);
    assert.ok(f.evidence.observed, `${f.ruleId} quotes nothing`);
    assert.ok(f.falsePositiveNote.length >= 80, `${f.ruleId} has a thin rebuttal`);
    assert.ok(f.prevention.length > 20);
  }
});

test("OUR OWN PAGE trips the platform-domain rule today, and that is left in on purpose", () => {
  /*
   * Proof is served from a vercel.app subdomain because no custom domain has been
   * bought yet. That is a true finding about us. Asserting it here means the
   * rulebook cannot be quietly exempted for our own site, and it means this test
   * turns red the day a domain IS bought, which is the right moment to notice.
   */
  const built = ".next/server/app/index.html";
  let html;
  try {
    html = readFileSync(built, "utf8");
  } catch {
    console.log("    (skipped: no build output at " + built + ", run npm run build first)");
    return;
  }
  const { report, facts } = runHtml(html);
  assert.ok(facts.counts.words > 200, `expected a real page, got ${facts.counts.words} words`);
  assert.equal(report.status, "assessed");

  assert.deepEqual(
    [...new Set(report.findings.map((f) => f.ruleId))].sort(),
    ["tells.bare-platform-domain"],
    "the only KIND of tell on our own page should be the domain we have not bought yet",
  );

  /*
   * TWO findings, not one, and that is correct rather than duplication. The
   * canonical link and og:url are two separate places carrying the address, and
   * fixing one without the other leaves the site telling two different stories
   * about where it lives. The rule reports each place somebody has to edit.
   */
  const observed = observedFor(report, "tells.bare-platform-domain");
  assert.equal(observed.length, 2, `expected canonical and og:url, got: ${observed.join(" | ")}`);
  assert.ok(observed.some((o) => o.startsWith("canonical is")), "canonical must be named");
  assert.ok(observed.some((o) => o.startsWith("og:url is")), "og:url must be named");
  for (const o of observed) assert.match(o, /vercel\.app/);
});
