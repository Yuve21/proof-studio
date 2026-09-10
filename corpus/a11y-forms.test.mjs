/**
 * Tests for the `accessibility` and `forms-and-capture` corpora.
 *
 * EVERY RULE IS TESTED IN BOTH DIRECTIONS. A rule that only ever fires is not a
 * check, it is a complaint, and the half that proves a rule discriminates is the
 * case where it stays quiet. So each fixture below deliberately contains the
 * correct version of the thing next to the broken one: a labelled input beside an
 * unlabelled one, an icon button with an aria-label beside one without.
 *
 * The alternative, a fixture full of defects, produces a corpus that fires on
 * everything and a customer who stops reading.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { factsFromHtml } from "../mcp/dom.mjs";
import { loadCorpus } from "./load.mjs";
import * as accessibility from "./accessibility.mjs";
import * as forms from "./forms-and-capture.mjs";
import { assess } from "../report/run.mjs";
import { CONCRETE_ROLES, ABSTRACT_ROLES, ALL_ROLES, classifyRole } from "./aria-vocabulary.mjs";

/** Run a corpus over an HTML string without a browser or a temp file. */
const run = (mod, html) => {
  const corpus = loadCorpus(mod);
  // THE SAME boundary the customer's install uses, so the suite cannot be green
  // against a DOM production does not have. See mcp/parser-conformance.mjs.
  const facts = factsFromHtml(html, corpus.collect);
  return { report: assess(corpus, facts), facts, corpus };
};

const fired = (report) => new Set(report.findings.map((f) => f.ruleId));
const PAD =
  "<p>Padding so the page clears the readability floor and is assessed rather than withheld, " +
  "because a withheld report publishes no findings at all and this fixture would then be testing " +
  "abstention instead of the rules it was written for. More words follow to be certain of it.</p>";

// --------------------------------------------------------------------------
// accessibility
// --------------------------------------------------------------------------

const A11Y_FIXTURE = `<!doctype html><html lang="en"><head><title>T</title></head><body>
  <main>
    <label for="good">Your email</label>
    <input id="good" name="email" type="email" autocomplete="email">

    <input id="bad" name="phone" type="text">

    <label for="nowhere">Points at nothing</label>

    <input id="aria-named" aria-label="Search the menu" placeholder="Search">

    <button aria-label="Close the dialog">&times;</button>
    <button></button>
    <a href="/named">Read the market schedule</a>
    <a href="/unnamed"><img src="/i.png"></a>

    <div role="button" tabindex="0">A real role</div>
    <div role="buton">A misspelled role</div>
    <div role="widget">An ABSTRACT role, which is different</div>

    <div tabindex="3">Positive tabindex</div>
    <div tabindex="0">Fine</div>

    <div aria-hidden="true"><a href="/trap">Focusable inside aria-hidden</a></div>
    <div aria-hidden="true"><a href="/ok" tabindex="-1">Correctly paired</a></div>

    <table><tr><td>1</td></tr><tr><td>2</td></tr></table>
    <table role="presentation"><tr><td>layout</td></tr><tr><td>layout</td></tr></table>
    <table><tr><th scope="col">Day</th></tr><tr><td>Saturday</td></tr></table>

    <video autoplay src="/v.mp4"></video>
    <video autoplay muted src="/ok.mp4"></video>
    <video autoplay controls src="/ok2.mp4"></video>

    <div id="dupe">first</div><div id="dupe">second</div>
    ${PAD}
  </main>
</body></html>`;

test("the accessibility corpus loads and satisfies the contract", () => {
  const c = loadCorpus(accessibility);
  assert.equal(c.id, "accessibility");
  assert.ok(c.rules.length >= 13, `expected at least 13 rules, got ${c.rules.length}`);
  for (const required of [
    "a11y.control-unlabelled",
    "a11y.interactive-no-name",
    "a11y.duplicate-id",
    "a11y.role-is-abstract",
  ]) {
    assert.ok(c.rules.some((r) => r.id === required), `must define ${required}`);
  }
});

test("accessibility fires on every defect the fixture contains", () => {
  const { report, facts } = run(accessibility, A11Y_FIXTURE);
  // Denominator first, so this cannot pass over a page that parsed as nothing.
  assert.ok(facts.counts.controls >= 3, `fixture must have controls, got ${facts.counts.controls}`);
  assert.ok(facts.counts.interactive >= 4, `fixture must have interactive elements`);
  assert.equal(report.status, "assessed");

  const f = fired(report);
  for (const id of [
    "a11y.control-unlabelled",
    "a11y.placeholder-as-label",
    "a11y.interactive-no-name",
    "a11y.duplicate-id",
    "a11y.label-points-nowhere",
    "a11y.tabindex-positive",
    "a11y.aria-hidden-focusable",
    "a11y.role-not-in-vocabulary",
    "a11y.role-is-abstract",
    "a11y.data-table-no-headers",
    "a11y.media-autoplay-uncontrolled",
  ]) {
    assert.ok(f.has(id), `${id} should have fired on this fixture`);
  }
});

test("accessibility stays QUIET on the correct version of each thing", () => {
  const { report } = run(accessibility, A11Y_FIXTURE);
  const byRule = (id) => report.findings.filter((x) => x.ruleId === id);

  // A labelled input, an aria-labelled input and a text input: only ONE is unnamed.
  const unlabelled = byRule("a11y.control-unlabelled");
  assert.equal(unlabelled.length, 1, "only the input with no label of any kind should fire");
  assert.match(unlabelled[0].evidence.observed, /name="phone"/);

  // Two named controls beside one unnamed: only the empty button and the
  // image-link with no alt should fire.
  const unnamed = byRule("a11y.interactive-no-name");
  assert.equal(unnamed.length, 2, `expected exactly 2 unnamed interactives, got ${unnamed.length}`);

  // One positive tabindex, not the tabindex="0" beside it.
  assert.equal(byRule("a11y.tabindex-positive").length, 1);

  // The aria-hidden link WITHOUT tabindex="-1" only.
  assert.equal(byRule("a11y.aria-hidden-focusable").length, 1);

  // Three tables: one data table with no th fires, the role=presentation one and
  // the one WITH a th do not.
  assert.equal(byRule("a11y.data-table-no-headers").length, 1);

  // Three autoplaying videos: only the unmuted one with no controls.
  assert.equal(byRule("a11y.media-autoplay-uncontrolled").length, 1);

  // The valid role does not fire on either role rule.
  const roleFindings = [...byRule("a11y.role-not-in-vocabulary"), ...byRule("a11y.role-is-abstract")];
  assert.equal(roleFindings.length, 2, "the valid role=button must not be reported");
  assert.ok(!roleFindings.some((x) => /role="button"/.test(x.evidence.observed)));

  // And the main landmark exists, so neither landmark rule fires.
  assert.equal(byRule("a11y.no-main-landmark").length, 0);
  assert.equal(byRule("a11y.multiple-main-landmarks").length, 0);
});

test("a clean page produces NO accessibility findings, which proves the rules can be quiet", () => {
  const clean = `<!doctype html><html lang="en"><head><title>T</title></head><body><main>
    <label for="e">Email</label><input id="e" name="email" type="email" autocomplete="email">
    <button>Send</button>
    <a href="/x">Read the market schedule</a>
    ${PAD}
  </main></body></html>`;
  const { report } = run(accessibility, clean);
  assert.equal(report.status, "assessed");
  assert.deepEqual(report.findings.map((f) => f.ruleId), [], "a correct page must report nothing");
  assert.equal(report.coverage, 1, "and every rule must still have RUN");
});

test("the abstract-role rule is separate from the unknown-role rule, and that matters", () => {
  /*
   * A vocabulary has THREE states here, not two: valid, abstract and absent.
   * Abstract roles are real, published and spelled correctly, and the
   * specification forbids putting them on an element. A checker that only asks
   * whether a role exists passes them; one that only knows concrete roles calls
   * them typos and sends the author hunting a misspelling that is not there.
   */
  const { report } = run(accessibility, A11Y_FIXTURE);
  const abstract = report.findings.filter((f) => f.ruleId === "a11y.role-is-abstract");
  const unknown = report.findings.filter((f) => f.ruleId === "a11y.role-not-in-vocabulary");
  assert.equal(abstract.length, 1);
  assert.match(abstract[0].evidence.observed, /role="widget"/);
  assert.match(abstract[0].evidence.observed, /ABSTRACT/);
  assert.equal(unknown.length, 1);
  assert.match(unknown[0].evidence.observed, /role="buton"/);
});

test("the vendored ARIA vocabulary is compared in BOTH directions", () => {
  /*
   * The discipline this house follows for a vocabulary somebody else publishes:
   * vendor their list as data, keep it in a different file, and compare in both
   * directions, because deriving one list from the other makes the check a mirror.
   *
   * Direction one: the classifier must recognise every role in the snapshot.
   * Direction two: the two sets must not overlap, since a role cannot be both
   * concrete and abstract, and an overlap would mean one classification silently
   * wins.
   */
  assert.ok(CONCRETE_ROLES.size >= 80, `expected the concrete taxonomy, got ${CONCRETE_ROLES.size}`);
  assert.ok(ABSTRACT_ROLES.size >= 10, `expected the abstract taxonomy, got ${ABSTRACT_ROLES.size}`);
  assert.equal(ALL_ROLES.size, CONCRETE_ROLES.size + ABSTRACT_ROLES.size, "the two sets must not overlap");

  for (const role of CONCRETE_ROLES) assert.equal(classifyRole(role), "valid", `${role} should be valid`);
  for (const role of ABSTRACT_ROLES) assert.equal(classifyRole(role), "abstract", `${role} should be abstract`);

  // And absent is its own answer, not a fallback into either.
  assert.equal(classifyRole("buton"), "unknown");
  assert.equal(classifyRole(""), "unknown");
  assert.equal(classifyRole(null), "unknown");

  // Specific members taken from the specification rather than from our own list,
  // so shrinking both together is still caught.
  for (const r of ["button", "navigation", "tablist", "switch", "searchbox"]) {
    assert.ok(CONCRETE_ROLES.has(r), `the taxonomy must contain the concrete role ${r}`);
  }
  for (const r of ["widget", "landmark", "input", "roletype"]) {
    assert.ok(ABSTRACT_ROLES.has(r), `the taxonomy must contain the abstract role ${r}`);
  }
});

// --------------------------------------------------------------------------
// forms-and-capture
// --------------------------------------------------------------------------

const FORMS_FIXTURE = `<!doctype html><html lang="en"><head><title>T</title></head><body><main>
  <form id="broken" novalidate>
    <input name="email" type="text" required>
    <input name="phone" type="text">
    <input type="radio" name="day" value="sat"><input type="radio" name="day" value="sun">
  </form>
  <form id="fine" action="/apply" method="post">
    <input name="email" type="email" autocomplete="email" required>
    <fieldset><legend>Which day</legend>
      <input type="radio" name="when" value="sat"><input type="radio" name="when" value="sun">
    </fieldset>
    <button type="submit">Send</button>
  </form>
  ${PAD}
</main></body></html>`;

test("the forms corpus loads and satisfies the contract", () => {
  const c = loadCorpus(forms);
  assert.equal(c.id, "forms-and-capture");
  assert.ok(c.rules.length >= 6, `expected at least 6 rules, got ${c.rules.length}`);
});

test("forms fires on the broken form and stays quiet on the good one beside it", () => {
  const { report, facts } = run(forms, FORMS_FIXTURE);
  assert.equal(facts.counts.forms, 2, "the fixture must contain both a broken and a correct form");
  assert.ok(facts.counts.fields >= 6);
  assert.equal(report.status, "assessed");

  const f = fired(report);
  for (const id of [
    "forms.no-declared-destination",
    "forms.no-submit-control",
    "forms.email-field-wrong-type",
    "forms.autocomplete-missing",
    "forms.radio-group-no-fieldset",
    "forms.novalidate-with-required",
  ]) {
    assert.ok(f.has(id), `${id} should have fired`);
  }

  // Every finding must point at the BROKEN form, never the correct one. This is
  // the assertion that proves the rules discriminate rather than complain.
  for (const finding of report.findings) {
    assert.ok(
      !finding.evidence.selector.includes("#fine"),
      `${finding.ruleId} fired on the correct form: ${finding.evidence.selector}`,
    );
  }
  assert.equal(report.findings.filter((x) => x.ruleId === "forms.no-declared-destination").length, 1);
  assert.equal(report.findings.filter((x) => x.ruleId === "forms.no-submit-control").length, 1);
});

test("a correct form alone produces no findings at all", () => {
  const clean = `<!doctype html><html lang="en"><head><title>T</title></head><body><main>
    <form action="/apply" method="post">
      <label for="e">Email</label>
      <input id="e" name="email" type="email" autocomplete="email">
      <button type="submit">Send</button>
    </form>
    ${PAD}
  </main></body></html>`;
  const { report } = run(forms, clean);
  assert.deepEqual(report.findings.map((f) => f.ruleId), []);
  assert.equal(report.coverage, 1);
});

test("the two new corpora do not report the same defect twice", () => {
  /*
   * Overlap is a real risk: both corpora legitimately care about labels. A
   * customer receiving the same problem under two department names reads a padded
   * report and learns to skim, so the rule ids must be disjoint and the SUBJECTS
   * must not collide.
   */
  const a = loadCorpus(accessibility).rules.map((r) => r.id);
  const b = loadCorpus(forms).rules.map((r) => r.id);
  const shared = a.filter((id) => b.includes(id));
  assert.deepEqual(shared, [], "no rule id may appear in both corpora");

  // And on one page containing an unlabelled input, only accessibility reports
  // the missing label. forms reports the autocomplete and the type, not the label.
  const html = `<!doctype html><html lang="en"><head><title>T</title></head><body><main>
    <form action="/x"><input name="email" type="text"><button>Go</button></form>${PAD}
  </main></body></html>`;
  const aFindings = fired(run(accessibility, html).report);
  const bFindings = fired(run(forms, html).report);
  assert.ok(aFindings.has("a11y.control-unlabelled"), "accessibility owns the label");
  assert.ok(!bFindings.has("a11y.control-unlabelled"));
  assert.ok(bFindings.has("forms.email-field-wrong-type"), "forms owns the input type");
});

test("a page with NO form abstains rather than reporting a clean forms result", () => {
  /*
   * FOUND BY READING OUR OWN RECEIPT. On a page with no form the report said
   * "read 0 forms, 0 fields. Nothing fired. Every one of the 6 rules ran", which
   * a customer reads as "your forms are fine". There were no forms.
   *
   * That is the difference between "we looked and found nothing wrong" and
   * "there was nothing to look at", and this house's rule is that a probe
   * reporting zero things examined is a failure regardless of exit code.
   */
  const noForm = `<!doctype html><html lang="en"><head><title>T</title></head><body><main>
    <h1>A page with no form on it at all</h1>${PAD}
  </main></body></html>`;
  const { report } = run(forms, noForm);
  assert.equal(report.status, "not_assessed", "silence over an absent subject is not a clean result");
  assert.equal(report.abstention.code, "nothing_to_assess");
  assert.match(report.abstention.reason, /no form/);
  assert.match(report.abstention.reason, /not a clean result/);
  assert.deepEqual(report.findings, []);

  // Presence: the same corpus on a page that HAS a form is assessed, so this is
  // an abstention about the subject and not a corpus that never runs.
  const withForm = `<!doctype html><html lang="en"><head><title>T</title></head><body><main>
    <form action="/x"><input name="q" type="text"><button>Go</button></form>${PAD}
  </main></body></html>`;
  assert.equal(run(forms, withForm).report.status, "assessed");
});

test("accessibility does NOT declare a subject, because every page has elements", () => {
  // The mechanism must not be applied where it makes no sense. A page always has
  // elements, so an accessibility rulebook finding nothing is a real clean
  // result rather than an empty one.
  const c = loadCorpus(accessibility);
  assert.equal(c.requiresSubject, null);
  const f = loadCorpus(forms);
  assert.deepEqual(f.requiresSubject, { key: "forms", label: "form" });
});

test("the loader refuses a malformed subject declaration", () => {
  const base = { CORPUS_ID: "t", CORPUS_VERSION: "v", collect: () => ({}), RULES: loadCorpus(forms).rules };
  assert.throws(
    () => loadCorpus({ ...base, REQUIRES_SUBJECT: { label: "form" } }),
    /REQUIRES_SUBJECT with no key/,
  );
  assert.throws(
    () => loadCorpus({ ...base, REQUIRES_SUBJECT: { key: "forms" } }),
    /REQUIRES_SUBJECT with no label/,
  );
  // And the correct one loads, so the above is not "everything is refused".
  assert.doesNotThrow(() => loadCorpus({ ...base, REQUIRES_SUBJECT: { key: "forms", label: "form" } }));
});

