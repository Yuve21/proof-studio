/**
 * Tests for the `seo-structured-data` corpus and its vendored vocabulary.
 *
 * THE VOCABULARY TESTS AT THE TOP MATTER MORE THAN THE RULE TESTS, for the same
 * reason they did for ARIA: a vendored list and a table keyed by it are two
 * hand-maintained spellings of the same fact, and nothing compares them unless
 * something here does. A typo in a REQUIRED_PROPERTIES key does not throw. It
 * makes that type's rule silently never fire, which is the failure this product
 * exists to detect, arriving in our own corpus.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { factsFromHtml } from "../mcp/dom.mjs";
import { loadCorpus } from "./load.mjs";
import * as sd from "./seo-structured-data.mjs";
import {
  KNOWN_TYPES,
  TYPES_BY_LOWERCASE,
  REQUIRED_PROPERTIES,
  SELF_SERVING_REVIEW_HOSTS,
} from "./schema-org-vocabulary.mjs";
import { assess } from "../report/run.mjs";

const PAD =
  "<p>Padding so the page clears the readability floor and is assessed rather than withheld, " +
  "because a withheld report publishes nothing and this fixture would then be testing abstention " +
  "instead of the rules it exists for. A few more words make the length unambiguous.</p>";

/** A page with one JSON-LD block, given as an object or as a raw string. */
const page = (jsonLd, body = "") => {
  const raw = typeof jsonLd === "string" ? jsonLd : JSON.stringify(jsonLd);
  return (
    `<!doctype html><html lang="en"><head><title>T</title>` +
    `<script type="application/ld+json">${raw}</script></head>` +
    `<body><main>${body}${PAD}</main></body></html>`
  );
};

const run = (html) => {
  const corpus = loadCorpus(sd);
  // THE SAME boundary the customer's install uses, so the suite cannot be green
  // against a DOM production does not have. See mcp/parser-conformance.mjs.
  const facts = factsFromHtml(html, corpus.collect);
  return { report: assess(corpus, facts), facts };
};
const firedIds = (report) => new Set(report.findings.map((f) => f.ruleId));
const org = (extra = {}) => ({ "@context": "https://schema.org", "@type": "Organization", name: "Acme", ...extra });

// --------------------------------------------------------------------------
// the vendored vocabulary, compared in BOTH directions
// --------------------------------------------------------------------------

test("every type the required-property table is keyed by exists in the vendored type list", () => {
  /*
   * The direction that fails SILENTLY. `REQUIRED_PROPERTIES.LocalBussiness`
   * would be a table entry no node ever matches, so the rule would report
   * nothing for every LocalBusiness on every page and look clean.
   */
  const missing = Object.keys(REQUIRED_PROPERTIES).filter((t) => !KNOWN_TYPES.has(t));
  assert.deepEqual(missing, [], "these required-property keys are not types in the vendored list");
});

test("every self-serving review host exists in the vendored type list", () => {
  const missing = [...SELF_SERVING_REVIEW_HOSTS].filter((t) => !KNOWN_TYPES.has(t));
  assert.deepEqual(missing, []);
});

test("the lowercase index loses nothing, so no type is unreachable by the case rule", () => {
  /*
   * If two entries in KNOWN_TYPES differed only by case, the Map would keep one
   * and the other would be permanently invisible to `sd.type-wrong-case`, which
   * is the one rule the whole vocabulary exists to serve.
   */
  assert.equal(TYPES_BY_LOWERCASE.size, KNOWN_TYPES.size);
  for (const t of KNOWN_TYPES) assert.equal(TYPES_BY_LOWERCASE.get(t.toLowerCase()), t);
});

test("the type list is a subset and the corpus never treats absence as a defect", () => {
  /*
   * The load-bearing property of the whole design, asserted rather than trusted
   * to a comment. `Taxi` is a real schema.org type we did not vendor. If any
   * rule ever reports it, somebody has written the unknown-type rule the
   * vocabulary file forbids.
   */
  assert.ok(!KNOWN_TYPES.has("Taxi"), "if Taxi is now vendored, pick another unvendored real type");
  const { report } = run(page({ "@context": "https://schema.org", "@type": "Taxi", name: "Acme Cabs" }));
  assert.deepEqual(report.findings.map((f) => f.ruleId), []);
});

// --------------------------------------------------------------------------
// the contract, and one test per rule
// --------------------------------------------------------------------------

test("the corpus loads and satisfies the contract", () => {
  const c = loadCorpus(sd);
  assert.equal(c.id, "seo-structured-data");
  assert.equal(c.rules.length, 9);
  assert.deepEqual(c.requiresSubject, {
    key: "structuredDataBlocks",
    label: "JSON-LD structured data block",
  });
});

test("a block that is not valid JSON is reported, quoting the parser", () => {
  const { report, facts } = run(page('{"@context":"https://schema.org","@type":"Organization",}'));
  assert.equal(facts.counts.parseFailures, 1);
  const f = report.findings.find((x) => x.ruleId === "sd.json-unparseable");
  assert.ok(f, "an unparseable block must be reported");
  assert.match(f.evidence.observed, /did not parse/);
  assert.match(f.evidence.observed, /bytes/, "the size is part of the locator");
});

test("a missing or non-schema.org context is reported, and an object context is reported as such", () => {
  assert.ok(firedIds(run(page({ "@type": "Organization", name: "Acme" })).report).has("sd.context-missing"));
  assert.ok(
    firedIds(run(page({ "@context": "https://example.org/ns", "@type": "Organization", name: "Acme" })).report).has(
      "sd.context-missing",
    ),
  );
  // An OBJECT context is valid JSON-LD. It must not be reported as absent.
  const objCtx = run(page({ "@context": { "@vocab": "https://schema.org/" }, "@type": "Organization", name: "Acme" }));
  assert.ok(!firedIds(objCtx.report).has("sd.context-missing"));
  // And the ordinary correct case stays quiet.
  assert.ok(!firedIds(run(page(org())).report).has("sd.context-missing"));
});

test("a top-level entity with no @type is reported, and a nested value bag is not", () => {
  const untyped = run(page({ "@context": "https://schema.org", name: "Acme", url: "https://acme.test" }));
  assert.ok(firedIds(untyped.report).has("sd.entity-has-no-type"));

  /*
   * The half that keeps the rule usable. An untyped object nested under a
   * property is a plain value bag and is not a defect, so the collector only
   * looks at top-level entities and direct @graph members.
   */
  const nested = run(page(org({ contactPoint: { telephone: "+1 212 555 0100" } })));
  assert.ok(!firedIds(nested.report).has("sd.entity-has-no-type"));

  // A direct @graph member without a type IS reported, because nothing else will.
  const graph = run(page({ "@context": "https://schema.org", "@graph": [{ name: "Acme" }] }));
  assert.ok(firedIds(graph.report).has("sd.entity-has-no-type"));
});

test("a known type spelled with the wrong case is reported, and the right spelling is not", () => {
  for (const bad of ["localbusiness", "LOCALBUSINESS", "Localbusiness"]) {
    const { report } = run(page({ "@context": "https://schema.org", "@type": bad, name: "A", address: "B" }));
    const f = report.findings.find((x) => x.ruleId === "sd.type-wrong-case");
    assert.ok(f, `${bad} should have been reported`);
    assert.match(f.evidence.observed, /the type is LocalBusiness/);
  }
  const good = run(page({ "@context": "https://schema.org", "@type": "LocalBusiness", name: "A", address: "B" }));
  assert.ok(!firedIds(good.report).has("sd.type-wrong-case"));
});

test("a required property is reported, and a REFERENCE node is left alone", () => {
  const offer = run(
    page({ "@context": "https://schema.org", "@type": "Offer", availability: "InStock" }),
  );
  const ids = report_ids(offer.report, "sd.required-property-missing");
  assert.equal(ids.length, 2, "price and priceCurrency are both required");
  assert.ok(ids.some((o) => /no price$/.test(o)));
  assert.ok(ids.some((o) => /no priceCurrency$/.test(o)));

  /*
   * THE MOST LIKELY FALSE POSITIVE IN THE RULEBOOK, asserted directly. A
   * reference node points at an entity defined elsewhere and correctly carries
   * nothing but an identifier.
   */
  const ref = run(
    page({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "H",
      publisher: { "@type": "Organization", "@id": "https://acme.test/#org" },
    }),
  );
  assert.ok(
    !firedIds(ref.report).has("sd.required-property-missing"),
    "a reference node must not be told it is missing a name",
  );

  // An empty string counts as missing, because a present-but-empty property is
  // the same defect wearing a different shape.
  const empty = run(page({ "@context": "https://schema.org", "@type": "Person", name: "   " }));
  assert.ok(firedIds(empty.report).has("sd.required-property-missing"));

  // anyOf: EITHER alternative satisfies it.
  for (const key of ["ratingCount", "reviewCount"]) {
    const ok = run(
      page(
        { "@context": "https://schema.org", "@type": "AggregateRating", ratingValue: "4.7", [key]: 12 },
        "<p>Rated 4.7 by our customers.</p>",
      ),
    );
    assert.ok(
      !firedIds(ok.report).has("sd.required-property-missing"),
      `${key} alone should satisfy the anyOf group`,
    );
  }
  const neither = run(
    page({ "@context": "https://schema.org", "@type": "AggregateRating", ratingValue: "4.7" }, "<p>Rated 4.7.</p>"),
  );
  assert.ok(firedIds(neither.report).has("sd.required-property-missing"));
});

test("a placeholder is reported as a whole value but a real name containing the word is not", () => {
  const bad = run(page(org({ name: "Your Company Name", url: "https://example.com/about" })));
  const observed = report_ids(bad.report, "sd.placeholder-value");
  assert.equal(observed.length, 2, "the name and the example.com url are both placeholders");

  /*
   * The asymmetry that makes this rule survivable: short generic words are
   * matched only as the WHOLE value, distinctive strings anywhere. A real
   * company called Example Industries selling a Test Kit is not reported.
   */
  const real = run(page(org({ name: "Example Industries", description: "We sell the Test Kit." })));
  assert.ok(!firedIds(real.report).has("sd.placeholder-value"));

  // But the bare word alone IS a placeholder.
  assert.ok(firedIds(run(page(org({ name: "Example" }))).report).has("sd.placeholder-value"));
  assert.ok(firedIds(run(page(org({ name: "TODO" }))).report).has("sd.placeholder-value"));
});

test("a rating absent from the page is reported, and one in an aria-label is not", () => {
  const rating = (extra) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Widget",
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: 31 },
    ...extra,
  });

  const hidden = run(page(rating(), "<p>A widget you will like.</p>"));
  const f = hidden.report.findings.find((x) => x.ruleId === "sd.aggregate-rating-not-on-page");
  assert.ok(f, "a rating nowhere on the page must be reported");
  assert.match(f.evidence.observed, /4\.8/);

  // Visible in text: quiet.
  assert.ok(
    !firedIds(run(page(rating(), "<p>Rated 4.8 out of 5.</p>")).report).has("sd.aggregate-rating-not-on-page"),
  );

  /*
   * THE FALSE POSITIVE THIS RULE WOULD OTHERWISE HAVE. A star widget renders no
   * text and puts the number in an accessible label. The collector reads
   * aria-label, title, alt, content and value for exactly this case.
   */
  assert.ok(
    !firedIds(
      run(page(rating(), '<div role="img" aria-label="Rated 4.8 out of 5 stars"></div>')).report,
    ).has("sd.aggregate-rating-not-on-page"),
    "a rating in an aria-label is on the page",
  );

  // 4.80 in the markup against 4.8 on the page is not a defect.
  const trailing = {
    "@context": "https://schema.org",
    "@type": "AggregateRating",
    ratingValue: "4.80",
    reviewCount: 9,
  };
  assert.ok(
    !firedIds(run(page(trailing, "<p>Rated 4.8 by nine people.</p>")).report).has(
      "sd.aggregate-rating-not-on-page",
    ),
  );
});

test("a business marking up reviews of itself is reported, on the shape rather than as a violation", () => {
  const selfServing = run(
    page(
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Acme Plumbing",
        address: "1 Main St",
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: 40 },
      },
      "<p>Rated 4.9 by 40 customers.</p>",
    ),
  );
  assert.ok(firedIds(selfServing.report).has("sd.self-serving-review"));

  // The same rating on a Product is the correct place for it.
  const onProduct = run(
    page(
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Drain service",
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: 40 },
      },
      "<p>Rated 4.9 by 40 customers.</p>",
    ),
  );
  assert.ok(!firedIds(onProduct.report).has("sd.self-serving-review"));
});

test("a relative URL is reported; a scheme, a protocol-relative URL and a data URI are not", () => {
  const bad = run(page(org({ url: "/about", logo: "images/logo.png" })));
  assert.equal(report_ids(bad.report, "sd.relative-url").length, 2);

  for (const value of [
    "https://acme.test/logo.png",
    "//cdn.acme.test/logo.png",
    "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
  ]) {
    const ok = run(page(org({ logo: value })));
    assert.ok(!firedIds(ok.report).has("sd.relative-url"), `${value} resolves and must not be reported`);
  }
});

// --------------------------------------------------------------------------
// abstention, which is the honesty of the rulebook rather than a feature of it
// --------------------------------------------------------------------------

test("a page with no JSON-LD abstains rather than reporting clean structured data", () => {
  const html = `<!doctype html><html lang="en"><head><title>T</title></head><body><main>${PAD}</main></body></html>`;
  const { report } = run(html);
  assert.equal(report.status, "not_assessed");
  assert.equal(report.abstention.code, "nothing_to_assess");
  assert.match(report.abstention.reason, /JSON-LD structured data block/);
  assert.deepEqual(report.findings, []);
});

test("a microdata-only page still abstains, but the microdata is COUNTED so the report is not misleading", () => {
  /*
   * The distinction the corpus header promises. We evaluate JSON-LD only. A page
   * using microdata has structured data, and abstaining while reporting zero of
   * anything would suggest it has none.
   */
  const html =
    `<!doctype html><html lang="en"><head><title>T</title></head><body><main>` +
    `<div itemscope itemtype="https://schema.org/Organization"><span itemprop="name">Acme</span></div>` +
    `${PAD}</main></body></html>`;
  const { report, facts } = run(html);
  assert.equal(facts.counts.microdataBlocks, 1);
  assert.equal(facts.counts.structuredDataBlocks, 0);
  assert.equal(report.status, "not_assessed");
});

test("findings carry a path inside the block, not just a selector at the script tag", () => {
  /*
   * A CSS selector pointing at a script tag locates the block and nothing
   * inside it, and a minified block can be forty kilobytes. The path is what
   * makes a finding actionable.
   */
  const { report } = run(
    page({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "Acme", url: "/about" },
        { "@type": "Offer", availability: "InStock" },
      ],
    }),
  );
  assert.ok(report.findings.length >= 3);
  for (const f of report.findings) {
    assert.ok(f.evidence.selector, `${f.ruleId} has no selector`);
    assert.match(f.evidence.observed, /block 1/, `${f.ruleId} must name the block it read`);
    assert.ok(f.falsePositiveNote.length >= 80);
    assert.ok(f.prevention.length > 20);
  }
  const paths = report.findings.map((f) => f.evidence.observed);
  assert.ok(paths.some((p) => /@graph\[0\]/.test(p)));
  assert.ok(paths.some((p) => /@graph\[1\]/.test(p)));
});

test("a second block is read, and one bad block does not hide the other", () => {
  /*
   * A page usually has several blocks and a parse failure in the first is the
   * case most likely to make a collector give up early.
   */
  const html =
    `<!doctype html><html lang="en"><head><title>T</title>` +
    `<script type="application/ld+json">{oops}</script>` +
    `<script type="application/ld+json">${JSON.stringify(org({ url: "/about" }))}</script>` +
    `</head><body><main>${PAD}</main></body></html>`;
  const { report, facts } = run(html);
  assert.equal(facts.counts.structuredDataBlocks, 2);
  assert.equal(facts.counts.parseFailures, 1);
  const ids = firedIds(report);
  assert.ok(ids.has("sd.json-unparseable"));
  assert.ok(ids.has("sd.relative-url"), "the second block must still be evaluated");
});

/** The observed strings for one rule, which is what most assertions here read. */
function report_ids(report, ruleId) {
  return report.findings.filter((f) => f.ruleId === ruleId).map((f) => f.evidence.observed);
}
