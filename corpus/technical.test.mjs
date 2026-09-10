/**
 * Tests for the `seo-technical` corpus.
 *
 * EVERY RULE IS ASSERTED IN BOTH DIRECTIONS, and in this rulebook the negative
 * direction carries most of the risk. These rules read the head of the document,
 * which is where the boilerplate lives, so a rule that is slightly too broad
 * fires on every page of every site and turns the report into noise that gets
 * skimmed. `technical.insecure-subresource` firing on a preconnect hint, or
 * `technical.link-not-crawlable` firing on an ordinary anchor, would each be
 * enough to do that.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { factsFromHtml } from "../mcp/dom.mjs";
import { loadCorpus } from "./load.mjs";
import * as technical from "./seo-technical.mjs";
import { assess } from "../report/run.mjs";

const BODY =
  "<main><p>Padding so the page clears the readability floor and is assessed rather than withheld, " +
  "because a withheld report publishes nothing and this fixture would then be testing abstention " +
  "instead of the rules it exists for. A few more words make the length unambiguous.</p></main>";

/** A page with a correct head, so a fixture only differs in the thing it tests. */
const page = (head = "", body = BODY) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>T</title>${head}</head>` +
  `<body>${body}</body></html>`;

const run = (html) => {
  const corpus = loadCorpus(technical);
  // THE SAME boundary the customer's install uses, so the suite cannot be green
  // against a DOM production does not have. See mcp/parser-conformance.mjs.
  const facts = factsFromHtml(html, corpus.collect);
  return { report: assess(corpus, facts), facts };
};
const firedIds = (report) => new Set(report.findings.map((f) => f.ruleId));
const observedFor = (report, id) =>
  report.findings.filter((f) => f.ruleId === id).map((f) => f.evidence.observed);

test("the corpus loads, satisfies the contract, and declares no subject", () => {
  const c = loadCorpus(technical);
  assert.equal(c.id, "seo-technical");
  assert.equal(c.rules.length, 11);
  /*
   * Deliberately null. Every HTML document has a head and a set of links, so
   * there is no subject whose absence would make this rulebook honestly silent.
   * Asserted so that adding one becomes a decision rather than a drift.
   */
  assert.equal(c.requiresSubject, null);
});

test("A CLEAN PAGE PRODUCES NOTHING, which is what makes the rest of this file meaningful", () => {
  /*
   * The most important test in the file. These rules read boilerplate, so a rule
   * that is a little too broad fires on every page ever built and the whole
   * report becomes noise. This fixture is an ordinary correct head.
   */
  const { report } = run(
    page(
      `<meta name="description" content="d">` +
        `<link rel="canonical" href="https://acme.test/">` +
        `<link rel="preconnect" href="http://cdn.acme.test">` +
        `<link rel="stylesheet" href="/styles.css">` +
        `<link rel="alternate" hreflang="en-GB" href="https://acme.test/gb">` +
        `<link rel="alternate" hreflang="fr" href="https://acme.test/fr">` +
        `<link rel="alternate" hreflang="x-default" href="https://acme.test/">` +
        `<meta name="robots" content="index, follow">`,
      `<main><p>Text.</p><a href="/about">About us</a>` +
        `<a href="https://elsewhere.test" rel="nofollow">Elsewhere</a>` +
        `<img src="/logo.png" alt="Acme"></main>${BODY}`,
    ),
  );
  assert.equal(report.status, "assessed");
  assert.deepEqual(
    report.findings.map((f) => `${f.ruleId} @ ${f.evidence.observed}`),
    [],
    "an ordinary correct page must produce nothing",
  );
});

test("noindex is reported, from the generic name and from a crawler-specific one", () => {
  for (const head of [
    `<meta name="robots" content="noindex">`,
    `<meta name="robots" content="noindex, nofollow">`,
    `<meta name="robots" content="none">`,
    `<meta name="googlebot" content="noindex">`,
  ]) {
    assert.ok(firedIds(run(page(head)).report).has("technical.noindex-on-page"), `should fire: ${head}`);
  }
  // The directive that permits indexing must not fire, nor must an unrelated meta.
  for (const head of [
    `<meta name="robots" content="index, follow">`,
    `<meta name="robots" content="max-snippet:-1">`,
    `<meta name="viewport" content="width=device-width">`,
  ]) {
    assert.ok(!firedIds(run(page(head)).report).has("technical.noindex-on-page"), `must not fire: ${head}`);
  }
});

test("it is the highest-weighted rule in the product, asserted rather than assumed", () => {
  /*
   * The plan and the marketing page both rest on the claim that severity is
   * proportionate. A noindex removes the page from search completely, so if
   * anything ever outweighs it, that is a decision somebody should have to make
   * on purpose.
   */
  const c = loadCorpus(technical);
  const noindex = c.rules.find((r) => r.id === "technical.noindex-on-page");
  assert.equal(noindex.weight, 10);
  for (const r of c.rules) assert.ok(r.weight <= noindex.weight, `${r.id} outweighs noindex`);
});

test("contradicting robots directives are reported, within one tag and across two", () => {
  const inOne = run(page(`<meta name="robots" content="index, noindex">`));
  assert.ok(firedIds(inOne.report).has("technical.robots-directives-conflict"));
  assert.match(observedFor(inOne.report, "technical.robots-directives-conflict")[0], /one tag says both/);

  const across = run(
    page(`<meta name="robots" content="index, follow"><meta name="googlebot" content="noindex">`),
  );
  const observed = observedFor(across.report, "technical.robots-directives-conflict");
  assert.equal(observed.length, 1);
  assert.match(observed[0], /robots says .*index, follow.* and googlebot says .*noindex/);

  // Two tags that AGREE are not a conflict.
  const agree = run(page(`<meta name="robots" content="noindex"><meta name="googlebot" content="noindex">`));
  assert.ok(!firedIds(agree.report).has("technical.robots-directives-conflict"));
});

test("two canonicals are reported with both values, and one is not", () => {
  const two = run(
    page(`<link rel="canonical" href="https://a.test/x"><link rel="canonical" href="https://a.test/y">`),
  );
  const observed = observedFor(two.report, "technical.canonical-multiple");
  assert.equal(observed.length, 1);
  assert.match(observed[0], /2 canonical links/);
  assert.match(observed[0], /a\.test\/x/);
  assert.match(observed[0], /a\.test\/y/, "both values must be quoted so the reader can judge it");

  assert.ok(
    !firedIds(run(page(`<link rel="canonical" href="https://a.test/x">`)).report).has(
      "technical.canonical-multiple",
    ),
  );
});

test("a relative canonical is reported; absolute and protocol-relative are not", () => {
  assert.ok(
    firedIds(run(page(`<link rel="canonical" href="/about">`)).report).has("technical.canonical-relative"),
  );
  for (const href of ["https://a.test/about", "http://a.test/about", "//a.test/about"]) {
    assert.ok(
      !firedIds(run(page(`<link rel="canonical" href="${href}">`)).report).has("technical.canonical-relative"),
      `${href} is not relative`,
    );
  }
});

test("a meta refresh that redirects is reported; a timed self-refresh is not", () => {
  const redirect = run(page(`<meta http-equiv="refresh" content="0; url=/new-home">`));
  assert.ok(firedIds(redirect.report).has("technical.meta-refresh-redirect"));

  /*
   * The half that keeps the rule usable. A dashboard that reloads itself every
   * thirty seconds carries no url and is not a redirect.
   */
  assert.ok(
    !firedIds(run(page(`<meta http-equiv="refresh" content="30">`)).report).has(
      "technical.meta-refresh-redirect",
    ),
    "a self-refresh with no destination must not be reported as a redirect",
  );
});

test("an http subresource is reported; a preconnect hint and an http ANCHOR are not", () => {
  const insecure = run(
    page(`<script src="http://cdn.acme.test/a.js"></script><link rel="stylesheet" href="http://cdn.acme.test/a.css">`),
  );
  assert.equal(observedFor(insecure.report, "technical.insecure-subresource").length, 2);

  // A hint loads nothing.
  assert.ok(
    !firedIds(run(page(`<link rel="preconnect" href="http://cdn.acme.test">`)).report).has(
      "technical.insecure-subresource",
    ),
  );
  assert.ok(
    !firedIds(run(page(`<link rel="dns-prefetch" href="http://cdn.acme.test">`)).report).has(
      "technical.insecure-subresource",
    ),
  );

  /*
   * THE FALSE POSITIVE THAT WOULD HAVE MADE THIS RULE USELESS. An anchor to an
   * http page is an ordinary external link. Half the web is linked to over http
   * and reporting it would fire on almost every page with an outbound link.
   */
  const anchorOnly = run(page("", `<main><a href="http://example.test/page">A link out</a></main>${BODY}`));
  assert.ok(
    !firedIds(anchorOnly.report).has("technical.insecure-subresource"),
    "an anchor is not a subresource",
  );

  // An http form action IS reported, because the submission itself is insecure.
  const form = run(page("", `<main><form action="http://acme.test/submit"></form></main>${BODY}`));
  assert.ok(firedIds(form.report).has("technical.insecure-subresource"));
});

test("uncrawlable anchors are reported and ordinary ones are not", () => {
  const bad = run(
    page(
      "",
      `<main><a href="#">Top</a><a href="javascript:void(0)">Menu</a><a>Nothing</a></main>${BODY}`,
    ),
  );
  assert.equal(observedFor(bad.report, "technical.link-not-crawlable").length, 3);
  assert.ok(
    observedFor(bad.report, "technical.link-not-crawlable").some((o) => /no href attribute/.test(o)),
  );

  const fine = run(
    page(
      "",
      `<main><a href="/about">About</a><a href="#section-two">Jump to section two</a>` +
        `<a href="mailto:hi@acme.test">Email</a><a href="tel:+12125550100">Call</a></main>${BODY}`,
    ),
  );
  assert.ok(
    !firedIds(fine.report).has("technical.link-not-crawlable"),
    "a real fragment link, a mailto and a tel are all followable",
  );
});

test("nofollow on a relative link is reported; on an external link it is not", () => {
  const internal = run(page("", `<main><a href="/pricing" rel="nofollow">Pricing</a></main>${BODY}`));
  assert.ok(firedIds(internal.report).has("technical.internal-link-nofollow"));

  /*
   * The guard that makes this rule sound. We have no base URL, so the ONLY thing
   * we can know is internal is a relative href. An absolute or protocol-relative
   * href might be our own domain or somebody else's, and nofollow on an outbound
   * link is ordinary practice.
   */
  for (const href of ["https://other.test/x", "//other.test/x", "mailto:hi@acme.test"]) {
    assert.ok(
      !firedIds(run(page("", `<main><a href="${href}" rel="nofollow">x</a></main>${BODY}`)).report).has(
        "technical.internal-link-nofollow",
      ),
      `${href} cannot be known to be internal`,
    );
  }
});

test("a malformed hreflang is reported, and well-formed ones of every shape are not", () => {
  const bad = run(page(`<link rel="alternate" hreflang="en_US" href="/us">`));
  const observed = observedFor(bad.report, "technical.hreflang-malformed");
  assert.equal(observed.length, 1);
  assert.match(observed[0], /an underscore where a hyphen belongs/, "the commonest form is named");

  for (const tag of ["en", "en-GB", "fr", "zh-Hant", "zh-Hant-TW", "es-419", "x-default", "EN-gb"]) {
    assert.ok(
      !firedIds(run(page(`<link rel="alternate" hreflang="${tag}" href="/x">`)).report).has(
        "technical.hreflang-malformed",
      ),
      `${tag} is well-formed`,
    );
  }

  /*
   * The published limitation, asserted so it cannot quietly become a vocabulary
   * check. zz-ZZ names no real language and this rule stays quiet on purpose,
   * because the alternative is vendoring a subtag list from memory and reporting
   * a real language we omitted.
   */
  assert.ok(
    !firedIds(run(page(`<link rel="alternate" hreflang="zz-ZZ" href="/x">`)).report).has(
      "technical.hreflang-malformed",
    ),
    "the shape check must not have grown into a vocabulary check",
  );
});

test("one hreflang pointing at two URLs is reported; the same URL twice is not", () => {
  const conflict = run(
    page(
      `<link rel="alternate" hreflang="en-GB" href="/gb"><link rel="alternate" hreflang="en-gb" href="/uk">`,
    ),
  );
  const observed = observedFor(conflict.report, "technical.hreflang-duplicate");
  assert.equal(observed.length, 1, "case must not hide a duplicate");
  assert.match(observed[0], /"\/gb" and "\/uk"/);

  const harmless = run(
    page(
      `<link rel="alternate" hreflang="en-GB" href="/gb"><link rel="alternate" hreflang="en-GB" href="/gb">`,
    ),
  );
  assert.ok(!firedIds(harmless.report).has("technical.hreflang-duplicate"));
});

test("a missing charset is reported, a late one is reported, and a first one is not", () => {
  const missing = run(
    `<!doctype html><html lang="en"><head><title>T</title></head><body>${BODY}</body></html>`,
  );
  const observed = observedFor(missing.report, "technical.charset-missing-or-late");
  assert.equal(observed.length, 1);
  assert.match(observed[0], /no charset meta tag/);

  // Charset first inside head: correct, and the ordinary fixture already proves
  // it, but asserted directly so the rule cannot pass by never firing.
  assert.ok(!firedIds(run(page()).report).has("technical.charset-missing-or-late"));

  /*
   * Pushed past 1024 bytes by padding head with enough markup to exceed it. The
   * padding is generated rather than typed so the test states the threshold it
   * is crossing instead of hiding it in a wall of literal text.
   */
  const pad = `<meta name="keywords" content="${"x".repeat(200)}">`.repeat(6);
  const late = run(
    `<!doctype html><html lang="en"><head><title>T</title>${pad}<meta charset="utf-8">` +
      `</head><body>${BODY}</body></html>`,
  );
  const lateObserved = observedFor(late.report, "technical.charset-missing-or-late");
  assert.equal(lateObserved.length, 1, `expected a late-charset finding, head padding was ${pad.length} bytes`);
  assert.match(lateObserved[0], /past the 1024-byte limit/);

  // An http-equiv content-type counts as a declaration.
  const equiv = run(
    `<!doctype html><html lang="en"><head><meta http-equiv="content-type" content="text/html; charset=utf-8">` +
      `<title>T</title></head><body>${BODY}</body></html>`,
  );
  assert.ok(!firedIds(equiv.report).has("technical.charset-missing-or-late"));
});

test("every finding carries a locator and the rebuttal travels with it", () => {
  const { report } = run(
    page(
      `<meta name="robots" content="noindex"><link rel="canonical" href="/a"><link rel="canonical" href="/b">`,
    ),
  );
  assert.ok(report.findings.length >= 3);
  for (const f of report.findings) {
    assert.ok(f.evidence.selector, `${f.ruleId} has no locator`);
    assert.ok(f.evidence.observed, `${f.ruleId} quotes nothing`);
    assert.ok(f.falsePositiveNote.length >= 80, `${f.ruleId} has a thin rebuttal`);
    assert.ok(f.prevention.length > 20);
  }
});

test("our own built pages carry no technical defect, over a real denominator", () => {
  const built = ".next/server/app/index.html";
  let html;
  try {
    html = readFileSync(built, "utf8");
  } catch {
    console.log("    (skipped: no build output at " + built + ", run npm run build first)");
    return;
  }
  const { report, facts } = run(html);
  assert.ok(facts.counts.links > 0, `expected a real page, got ${facts.counts.links} links`);
  assert.equal(report.status, "assessed");
  assert.deepEqual(
    report.findings.map((f) => `${f.ruleId} @ ${f.evidence.selector}`),
    [],
    "our own marketing page must not carry a technical defect",
  );
});
