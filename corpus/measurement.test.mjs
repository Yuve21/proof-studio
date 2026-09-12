/**
 * Tests for the `measurement` corpus.
 *
 * THE NEGATIVE CASES MATTER MORE THAN THE POSITIVE ONES HERE, for a specific
 * reason. Every rule in this rulebook fires on an ABSENCE: no tag, no
 * verification, no consent attribute. An absence-detector that is slightly wrong
 * fires on every correctly built site at once, and a department that flags all of
 * a studio's own work is a department the studio turns off in week two.
 *
 * So each rule is asserted in both directions, and the clean fixture is a page
 * built the way we would build one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { factsFromHtml } from "../mcp/dom.mjs";
import { loadCorpus } from "./load.mjs";
import * as measurement from "./measurement.mjs";
import { assess } from "../report/run.mjs";

const corpus = loadCorpus(measurement);

const PAD =
  "<p>Padding so the page clears the readability floor and is assessed rather than withheld, " +
  "because a withheld report publishes nothing and this fixture would then be testing abstention " +
  "instead of the rules it exists for. A few more words make the length unambiguous.</p>";

const page = (head = "", body = "") =>
  `<!doctype html><html lang="en"><head><title>Test page</title>${head}</head><body><h1>Test page</h1>${PAD}${body}</body></html>`;

const GA = '<script src="https://www.googletagmanager.com/gtag/js?id=G-4RTQ9PZ1XK"></script>';
const VERIFY = '<meta name="google-site-verification" content="abc123">';

const run = (html) => assess(corpus, factsFromHtml(html, measurement.collect));
const fired = (report) => report.findings.map((f) => f.ruleId);

test("a page with no analytics at all is reported, because the absence is the finding", () => {
  const ids = fired(run(page()));
  assert.ok(ids.includes("measurement.nothing-is-counting"));
});

test("a page with a real tag does NOT fire the nothing-is-counting rule", () => {
  const ids = fired(run(page(GA + VERIFY)));
  assert.ok(!ids.includes("measurement.nothing-is-counting"), `fired: ${ids.join(", ")}`);
});

test("a placeholder measurement id is caught, and a real one is not", () => {
  const bad = page('<script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>');
  assert.ok(fired(run(bad)).includes("measurement.placeholder-id"));
  assert.ok(!fired(run(page(GA))).includes("measurement.placeholder-id"));
});

test("two general-purpose analytics tools fire; a general tool beside a session recorder does not", () => {
  const two = page(GA + '<script src="https://plausible.io/js/script.js"></script>');
  assert.ok(fired(run(two)).includes("measurement.two-tools-counting-the-same-thing"));

  // Hotjar is not general-purpose: it records sessions, it does not publish the
  // traffic number anybody quotes. Firing here would flag a normal, correct stack.
  const oneAndARecorder = page(GA + '<script src="https://static.hotjar.com/c/hotjar-123.js"></script>');
  assert.ok(!fired(run(oneAndARecorder)).includes("measurement.two-tools-counting-the-same-thing"));
});

test("a meta CSP that omits the analytics host fires, and one that lists it does not", () => {
  const blocked = page(
    '<meta http-equiv="Content-Security-Policy" content="script-src \'self\'">' + GA,
  );
  assert.ok(fired(run(blocked)).includes("measurement.csp-blocks-its-own-tag"));

  const allowed = page(
    '<meta http-equiv="Content-Security-Policy" content="script-src \'self\' https://www.googletagmanager.com">' + GA,
  );
  assert.ok(!fired(run(allowed)).includes("measurement.csp-blocks-its-own-tag"));

  // No meta CSP at all must stay silent rather than claim the policy is fine:
  // the common case is an HTTP header this parser cannot see.
  assert.ok(!fired(run(page(GA))).includes("measurement.csp-blocks-its-own-tag"));
});

test("a cookie banner beside an unconditional tag fires; a properly marked tag does not", () => {
  const banner = '<div id="cookie-banner">We use cookies. Accept all cookies</div>';
  assert.ok(fired(run(page(GA, banner))).includes("measurement.consent-ui-with-unconditional-tag"));

  // A CMP that marks its tags is the correct wiring, and must not be punished for
  // existing. This is the case that would make a studio turn the department off.
  const marked = '<script type="text/plain" data-cookieconsent="statistics" src="https://www.googletagmanager.com/gtag/js?id=G-4RTQ9PZ1XK"></script>';
  assert.ok(!fired(run(page(marked, banner))).includes("measurement.consent-ui-with-unconditional-tag"));

  // And no banner means no finding, whatever the tag looks like.
  assert.ok(!fired(run(page(GA))).includes("measurement.consent-ui-with-unconditional-tag"));
});

test("a policy page is compared in BOTH directions, and a normal page is not compared at all", () => {
  const policyNamingMissingTool = `<!doctype html><html lang="en"><head><title>Privacy Policy</title>${VERIFY}${GA}</head><body><h1>Privacy Policy</h1>${PAD}<p>We use Google Analytics and Hotjar to understand traffic.</p></body></html>`;
  const ids = fired(run(policyNamingMissingTool));
  assert.ok(ids.includes("measurement.policy-and-page-disagree"));

  // The same tools on a page that is not a policy page: out of scope, silent.
  const normal = page(GA + VERIFY, "<p>We use Google Analytics and Hotjar.</p>");
  assert.ok(!fired(run(normal)).includes("measurement.policy-and-page-disagree"));
});

test("a missing verification token fires at low severity, and a present one does not", () => {
  const report = run(page(GA));
  const hit = report.findings.find((f) => f.ruleId === "measurement.no-search-console-verification");
  assert.ok(hit, "expected the verification rule to fire");
  assert.equal(hit.severity, "low", "this rule is frequently wrong and must stay low");
  assert.ok(!fired(run(page(GA + VERIFY))).includes("measurement.no-search-console-verification"));
});

test("a correctly built page fires NOTHING, which is the case that decides whether this ships", () => {
  const clean = page(GA + VERIFY);
  const report = run(clean);
  assert.deepEqual(fired(report), [], `a clean page fired: ${fired(report).join(", ")}`);
});

test("every rule carries a false-positive note that names a case, not a hedge", () => {
  for (const rule of measurement.RULES) {
    assert.ok(rule.falsePositiveNote && rule.falsePositiveNote.length > 80, `${rule.id}: note too short`);
    assert.ok(
      /wrong|common|cannot see|scoped|only the/i.test(rule.falsePositiveNote),
      `${rule.id}: the note must name the condition under which the rule is wrong`,
    );
    assert.ok(!/may occasionally|sometimes wrong/i.test(rule.falsePositiveNote), `${rule.id}: hedge, not a note`);
  }
});
