/**
 * Tests for the `broken-things` corpus.
 *
 * THE NEGATIVE DIRECTION IS WHERE THE RISK IS, more here than in any other
 * rulebook. These rules read EVERY URL and EVERY block of text on the page,
 * which is the widest surface any corpus in this product touches, so a pattern
 * that is slightly too broad does not produce one wrong finding, it produces
 * dozens on a single page and the report becomes unreadable.
 *
 * Three specific false positives are asserted directly, because each one would
 * have opened a report by telling a customer their own correct site is broken:
 *   - a business genuinely called "Infinity Pools"
 *   - a URL path containing the word "nullify"
 *   - a real vercel.app or netlify.app address, which for many small sites IS
 *     the live public address
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { factsFromHtml } from "../mcp/dom.mjs";
import { loadCorpus } from "./load.mjs";
import * as broken from "./broken-things.mjs";
import { assess } from "../report/run.mjs";

const PAD =
  "<p>Padding so the page clears the readability floor and is assessed rather than withheld, " +
  "because a withheld report publishes nothing and this fixture would then be testing abstention " +
  "instead of the rules it exists for. A few more words make the length unambiguous.</p>";

const page = (body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>T</title></head>` +
  `<body><main>${body}${PAD}</main></body></html>`;

const run = (html) => {
  const corpus = loadCorpus(broken);
  // THE SAME boundary the customer's install uses, so the suite cannot be green
  // against a DOM production does not have. See mcp/parser-conformance.mjs.
  const facts = factsFromHtml(html, corpus.collect);
  return { report: assess(corpus, facts), facts };
};
const firedIds = (report) => new Set(report.findings.map((f) => f.ruleId));
const observedFor = (report, id) =>
  report.findings.filter((f) => f.ruleId === id).map((f) => f.evidence.observed);

test("the corpus loads, satisfies the contract, and declares no subject", () => {
  const c = loadCorpus(broken);
  assert.equal(c.id, "broken-things");
  assert.equal(c.rules.length, 12);
  assert.equal(c.requiresSubject, null);
});

test("AN ORDINARY CORRECT PAGE PRODUCES NOTHING, which is what makes the rest meaningful", () => {
  /*
   * The most important test in the file. These rules read every URL and every
   * text block, so a pattern a little too broad fires many times on one page.
   */
  const { report, facts } = run(
    page(
      `<h1>Acme Plumbing</h1>` +
        `<p>Open today until six. Call us or send an email and we will come out.</p>` +
        `<a href="/pricing">Pricing</a>` +
        `<a href="#opening-hours">Opening hours</a>` +
        `<h2 id="opening-hours">Opening hours</h2>` +
        `<a href="mailto:hello@acme.test">hello@acme.test</a>` +
        `<a href="tel:+12125550100">(212) 555 0100</a>` +
        `<a href="https://acme.test/terms">Terms</a>` +
        `<img src="/logo.png" alt="Acme Plumbing" width="200" height="80">` +
        `<form action="/api/enquiry" method="post"><button>Send</button></form>`,
    ),
  );
  assert.ok(facts.counts.urls >= 7, `the fixture must have URLs, got ${facts.counts.urls}`);
  assert.ok(facts.counts.textBlocks >= 4, `the fixture must have text, got ${facts.counts.textBlocks}`);
  assert.equal(report.status, "assessed");
  assert.deepEqual(
    report.findings.map((f) => `${f.ruleId} @ ${f.evidence.observed}`),
    [],
    "an ordinary correct page must produce nothing",
  );
});

test("a failed interpolation is reported in text, in an attribute and in a URL", () => {
  const inText = run(page("<p>Welcome back, undefined!</p>"));
  const observed = observedFor(inText.report, "broken.interpolation-failed");
  assert.equal(observed.length, 1);
  assert.match(observed[0], /visible text contains "undefined"/);

  assert.ok(
    firedIds(run(page(`<img src="/a.png" alt="Photo of [object Object]">`)).report).has(
      "broken.interpolation-failed",
    ),
  );
  assert.ok(
    firedIds(run(page(`<a href="/product/undefined">Buy</a>`)).report).has("broken.interpolation-failed"),
  );
  assert.ok(firedIds(run(page("<p>Total: NaN per hour</p>")).report).has("broken.interpolation-failed"));
});

test("only the SMALLEST element containing the text is reported, not every ancestor", () => {
  /*
   * Without the own-text restriction in the collector, one broken string in a
   * paragraph reports on the paragraph, the div, main and body. Four findings
   * for one defect, all pointing at the same characters.
   */
  const { report } = run(page("<section><div><p>Welcome back, undefined!</p></div></section>"));
  const observed = observedFor(report, "broken.interpolation-failed");
  assert.equal(observed.length, 1, `expected exactly one finding, got: ${observed.join(" | ")}`);
  const finding = report.findings.find((f) => f.ruleId === "broken.interpolation-failed");
  assert.match(finding.evidence.selector, /p$/, "the locator must be the paragraph, not an ancestor");
});

test("A BUSINESS CALLED INFINITY POOLS IS NOT A DEFECT, and neither is prose about null", () => {
  /*
   * The false positive that would have opened a report by telling a customer
   * their own name is a bug. `Infinity` is deliberately absent from the text
   * pattern and present in the URL one.
   */
  for (const body of [
    "<p>Infinity Pools has been installing since 1994.</p>",
    "<h1>Infinity Salon</h1>",
    "<p>The warranty is null and void if the seal is broken.</p>",
    "<p>A null hypothesis is the starting point of the study.</p>",
  ]) {
    const { report } = run(page(body));
    assert.deepEqual(
      observedFor(report, "broken.interpolation-failed"),
      [],
      `this is ordinary copy and must not be reported: ${body}`,
    );
  }

  // But in a URL, where it cannot be a business name, Infinity IS reported.
  assert.ok(
    firedIds(run(page(`<img src="/rate/Infinity" alt="x">`)).report).has("broken.interpolation-failed"),
  );
});

test("a URL merely CONTAINING a failed value as part of a longer word is not reported", () => {
  /*
   * The first draft matched `includes("/null")`, which reports both of these.
   * Anchoring to a separator on both sides is what makes the rule usable.
   */
  for (const href of ["/nullify-the-contract", "/undefinedly-good", "/products/nullarbor"]) {
    const { report } = run(page(`<a href="${href}">Read</a>`));
    assert.deepEqual(
      observedFor(report, "broken.interpolation-failed"),
      [],
      `${href} is a real path and must not be reported`,
    );
  }
});

test("unrendered template syntax is reported in all five families", () => {
  const cases = [
    "<p>Welcome to {{ business.name }}</p>",
    "<p>Call ${phone} today</p>",
    "<p>Open <%= hours %> daily</p>",
    "<p>Serving {% city %} since 1994</p>",
    "<p>Find us at [[address]]</p>",
  ];
  for (const body of cases) {
    assert.ok(
      firedIds(run(page(body)).report).has("broken.template-syntax-unrendered"),
      `should fire: ${body}`,
    );
  }
  // In a URL too.
  assert.ok(
    firedIds(run(page(`<a href="/book/{{slug}}">Book</a>`)).report).has("broken.template-syntax-unrendered"),
  );
  // And ordinary copy with braces in it is not template syntax.
  for (const body of ["<p>We open at 9 (or 10 on Sundays).</p>", "<p>Set A = {1, 2, 3} in the handout.</p>"]) {
    assert.ok(
      !firedIds(run(page(body)).report).has("broken.template-syntax-unrendered"),
      `must not fire: ${body}`,
    );
  }
});

test("a localhost URL is reported and a real host is not", () => {
  for (const href of [
    "http://localhost:3000/checkout",
    "http://127.0.0.1:8080/api",
    "//localhost/x",
    "http://0.0.0.0:5000/",
  ]) {
    assert.ok(firedIds(run(page(`<a href="${href}">Go</a>`)).report).has("broken.local-address"), href);
  }
  for (const href of ["https://acme.test/checkout", "/checkout", "https://localhosting.test/x"]) {
    assert.ok(
      !firedIds(run(page(`<a href="${href}">Go</a>`)).report).has("broken.local-address"),
      `${href} is a real address`,
    );
  }
});

test("a filesystem path is reported, on both Windows and unix shapes", () => {
  for (const src of [
    "file:///C:/Users/someone/Desktop/logo.png",
    "C:\\Users\\someone\\Pictures\\logo.png",
    "/Users/someone/Desktop/logo.png",
    "/home/someone/Downloads/logo.png",
  ]) {
    assert.ok(
      firedIds(run(page(`<img src="${src.replace(/\\/g, "&#92;")}" alt="Logo">`)).report).has(
        "broken.filesystem-path",
      ) ||
        firedIds(run(page(`<img src='${src}' alt="Logo">`)).report).has("broken.filesystem-path"),
      src,
    );
  }
  // A served path that merely starts with /home or /users is not a filesystem
  // path: the rule requires a user directory after it.
  for (const src of ["/home", "/home/index.png", "/users/reviews.png"]) {
    assert.ok(
      !firedIds(run(page(`<img src="${src}" alt="x">`)).report).has("broken.filesystem-path"),
      `${src} is a served path`,
    );
  }
});

test("A REAL VERCEL OR NETLIFY ADDRESS IS NOT A STAGING HOST, which is the care in this rule", () => {
  /*
   * For a great many small business sites the vercel.app or netlify.app
   * subdomain IS the live public address. Reporting it would tell somebody their
   * real domain is a mistake, which is the direction that loses the customer.
   */
  for (const href of [
    "https://acme-plumbing.vercel.app/pricing",
    "https://acme-plumbing.netlify.app/pricing",
    "https://acme.pages.dev/pricing",
  ]) {
    assert.ok(
      !firedIds(run(page(`<a href="${href}">Pricing</a>`)).report).has("broken.development-host"),
      `${href} can be a genuine public address`,
    );
  }

  // Hosts that cannot be a public address ARE reported.
  for (const href of [
    "https://staging.acme.test/pricing",
    "https://acme.staging.example/pricing",
    "https://a1b2c3.ngrok-free.app/pricing",
    "http://macbook.local:3000/pricing",
  ]) {
    assert.ok(
      firedIds(run(page(`<a href="${href}">Pricing</a>`)).report).has("broken.development-host"),
      `${href} is not reachable by a visitor`,
    );
  }

  // And localhost is reported by its OWN rule, not twice.
  const local = run(page(`<a href="http://localhost:3000/x">Go</a>`));
  assert.ok(firedIds(local.report).has("broken.local-address"));
  assert.ok(
    !firedIds(local.report).has("broken.development-host"),
    "one address must not produce two findings",
  );
});

test("an image with nothing to load is reported; one with a srcset is not", () => {
  assert.ok(firedIds(run(page(`<img alt="Logo">`)).report).has("broken.image-has-no-source"));
  assert.ok(firedIds(run(page(`<img src="" alt="Logo">`)).report).has("broken.image-has-no-source"));
  assert.ok(firedIds(run(page(`<img src="#" alt="Logo">`)).report).has("broken.image-has-no-source"));

  /*
   * The lazy-loading exemption. An img with a srcset and no src is how
   * responsive and deferred images are commonly written, and reporting it would
   * fire on a working page.
   */
  assert.ok(
    !firedIds(run(page(`<img srcset="/a-400.png 400w, /a-800.png 800w" alt="Logo">`)).report).has(
      "broken.image-has-no-source",
    ),
  );
  assert.ok(!firedIds(run(page(`<img src="/logo.png" alt="Logo">`)).report).has("broken.image-has-no-source"));
});

test("an empty URL attribute is reported", () => {
  const { report } = run(page(`<a href="">Home</a><form action="  "><button>Go</button></form>`));
  assert.equal(observedFor(report, "broken.empty-url").length, 2);
  assert.ok(!firedIds(run(page(`<a href="/">Home</a>`)).report).has("broken.empty-url"));
});

test("a fragment with no target is reported, and every real target shape is not", () => {
  const missing = run(page(`<a href="#pricing">See pricing</a><h2 id="prices">Prices</h2>`));
  const observed = observedFor(missing.report, "broken.fragment-target-missing");
  assert.equal(observed.length, 1);
  assert.match(observed[0], /no element on this page has that id/);

  // An id, a legacy anchor name, and a percent-encoded fragment all resolve.
  for (const body of [
    `<a href="#pricing">P</a><h2 id="pricing">Pricing</h2>`,
    `<a href="#pricing">P</a><a name="pricing"></a>`,
    `<a href="#%C3%B6ffnungszeiten">Z</a><h2 id="\u00f6ffnungszeiten">Zeiten</h2>`,
  ]) {
    assert.ok(
      !firedIds(run(page(body)).report).has("broken.fragment-target-missing"),
      `this target resolves: ${body}`,
    );
  }

  // A bare # is not a fragment link at all; seo-technical owns that as an
  // uncrawlable link, and reporting it here as well would be one defect twice.
  assert.ok(!firedIds(run(page(`<a href="#">Top</a>`)).report).has("broken.fragment-target-missing"));
});

test("an empty contact link is reported and a real one is not", () => {
  for (const href of ["mailto:", "mailto:?subject=Hello", "tel:", "tel:+1"]) {
    assert.ok(
      firedIds(run(page(`<a href="${href}">Contact</a>`)).report).has("broken.contact-link-empty"),
      href,
    );
  }
  for (const href of [
    "mailto:hello@acme.test",
    "mailto:hello@acme.test?subject=Enquiry",
    "tel:+12125550100",
    "tel:212-555-0100",
  ]) {
    assert.ok(
      !firedIds(run(page(`<a href="${href}">Contact</a>`)).report).has("broken.contact-link-empty"),
      `${href} is a working contact link`,
    );
  }
});

test("markup shown as text is reported, and ordinary prose with a comparison is not", () => {
  assert.ok(
    firedIds(run(page("<p>&lt;strong&gt;Open today&lt;/strong&gt; until six</p>")).report).has(
      "broken.escaped-markup-in-text",
    ),
  );
  for (const body of [
    "<p>Prices are 10 &lt; 20 in every case.</p>",
    "<p>Use the a to z index at the back.</p>",
    "<p>We are open 9&ndash;5.</p>",
  ]) {
    assert.ok(
      !firedIds(run(page(body)).report).has("broken.escaped-markup-in-text"),
      `must not fire: ${body}`,
    );
  }
});

test("a zero-dimension image and a doubled path separator are reported, weighted low", () => {
  const c = loadCorpus(broken);
  for (const id of ["broken.zero-dimension-image", "broken.doubled-path-separator"]) {
    const rule = c.rules.find((r) => r.id === id);
    assert.equal(rule.severity, "low", `${id} must stay low: both have common legitimate causes`);
  }

  assert.ok(
    firedIds(run(page(`<img src="/pixel.gif" width="0" height="0" alt="">`)).report).has(
      "broken.zero-dimension-image",
    ),
  );
  assert.ok(
    firedIds(run(page(`<img src="/assets//logo.png" alt="Logo">`)).report).has(
      "broken.doubled-path-separator",
    ),
  );

  /*
   * The scheme's own two slashes and a protocol-relative URL are both excluded,
   * because neither is the case this rule describes. Without stripping the
   * authority first, EVERY absolute URL on the page would be reported.
   */
  /*
   * A data: URI carries a whole document in its body, and an inline SVG contains
   * "http://www.w3.org/2000/svg". This rule fired on our own home page favicon
   * for exactly that reason, so opaque schemes are excluded and asserted here.
   */
  const dataUri =
    "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3C/svg%3E";
  assert.ok(
    !firedIds(run(page(`<img src="${dataUri}" alt="Icon">`)).report).has("broken.doubled-path-separator"),
    "a data: URI has no path for this rule to be about",
  );

  for (const src of ["https://acme.test/logo.png", "//cdn.acme.test/logo.png", "/assets/logo.png"]) {
    assert.ok(
      !firedIds(run(page(`<img src="${src}" alt="Logo">`)).report).has("broken.doubled-path-separator"),
      `${src} has no doubled separator in its path`,
    );
  }
});

test("the weighting says a broken render matters more than a doubled slash", () => {
  /*
   * The rulebook's own claim about proportion. A visitor reading "Welcome,
   * undefined" is a different order of problem from an untidy asset path, and
   * the report orders findings by weight, so this is what a customer sees first.
   */
  const c = loadCorpus(broken);
  const weight = (id) => c.rules.find((r) => r.id === id).weight;
  assert.equal(weight("broken.interpolation-failed"), 10);
  assert.equal(weight("broken.template-syntax-unrendered"), 10);
  assert.ok(weight("broken.interpolation-failed") > weight("broken.doubled-path-separator") + 4);
});

test("every finding carries a locator and the rebuttal travels with it", () => {
  const { report } = run(
    page(
      `<p>Welcome, undefined</p><a href="http://localhost:3000/x">Go</a>` +
        `<img src="file:///C:/Users/me/Desktop/a.png" alt="A"><a href="mailto:">Mail</a>`,
    ),
  );
  assert.ok(report.findings.length >= 4);
  for (const f of report.findings) {
    assert.ok(f.evidence.selector, `${f.ruleId} has no locator`);
    assert.ok(f.evidence.observed, `${f.ruleId} quotes nothing`);
    assert.ok(f.falsePositiveNote.length >= 80, `${f.ruleId} has a thin rebuttal`);
    assert.ok(f.prevention.length > 20);
  }
});

test("our own built pages are not broken, over a real denominator", () => {
  const built = ".next/server/app/index.html";
  let html;
  try {
    html = readFileSync(built, "utf8");
  } catch {
    console.log("    (skipped: no build output at " + built + ", run npm run build first)");
    return;
  }
  const { report, facts } = run(html);
  assert.ok(facts.counts.urls > 5, `expected a real page, got ${facts.counts.urls} URLs`);
  assert.ok(facts.counts.textBlocks > 20, `expected real text, got ${facts.counts.textBlocks} blocks`);
  assert.equal(report.status, "assessed");
  assert.deepEqual(
    report.findings.map((f) => `${f.ruleId} @ ${f.evidence.selector}: ${f.evidence.observed}`),
    [],
    "our own page must not be broken",
  );
});

test("THE TWO ENVIRONMENT RULES ARE DISJOINT, which is the property a dead guard was aiming at", () => {
  /*
   * `broken.development-host` used to open with a line skipping any address the
   * local-address rule had claimed, so that one URL could not produce two
   * findings. A mutation deleting that line survived the entire suite: neither
   * of the rule's patterns can match a bare localhost, so the line never changed
   * an outcome and the comment above it described a protection that was not
   * being applied.
   *
   * The line is gone. The PROPERTY it wanted is asserted here instead, where a
   * test can actually see it. If either pattern is widened until the two overlap,
   * this goes red, which the guard never would have.
   */
  const addresses = [
    "http://localhost:3000/x",
    "http://127.0.0.1:8080/x",
    "http://0.0.0.0:5000/",
    "//localhost/x",
    "https://staging.acme.test/x",
    "https://acme.staging.example/x",
    "https://a1b2c3.ngrok-free.app/x",
    "http://macbook.local:3000/x",
    "http://api.localhost:3000/x",
    "https://acme.test/x",
    "https://acme-plumbing.vercel.app/x",
  ];

  let reportedByAtLeastOne = 0;
  for (const href of addresses) {
    const fired = firedIds(run(page(`<a href="${href}">Go</a>`)).report);
    const local = fired.has("broken.local-address");
    const dev = fired.has("broken.development-host");
    assert.ok(
      !(local && dev),
      `${href} is reported by BOTH environment rules, so one URL produces two findings`,
    );
    if (local || dev) reportedByAtLeastOne += 1;
  }

  /*
   * The denominator. Disjointness is trivially satisfied if neither rule ever
   * fires, so this asserts the fixture list is actually exercising both.
   */
  assert.ok(
    reportedByAtLeastOne >= 8,
    `expected most of these addresses to be reported by one rule, got ${reportedByAtLeastOne}`,
  );
});
