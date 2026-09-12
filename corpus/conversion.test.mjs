/**
 * Tests for the `conversion-auditor` corpus.
 *
 * THE PHONE RULE IS THE ONE TO WATCH. It reads free text looking for something
 * shaped like a number a person would dial, and the failure mode is not missing a
 * dead number, it is flagging an order reference on every invoice page a client
 * has. So the negative cases here carry the shapes that are NOT phone numbers,
 * and they are the reason the pattern requires separators or a country prefix.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { factsFromHtml } from "../mcp/dom.mjs";
import { loadCorpus } from "./load.mjs";
import * as conversion from "./conversion-auditor.mjs";
import { assess } from "../report/run.mjs";

const corpus = loadCorpus(conversion);

const PAD =
  "<p>Padding so the page clears the readability floor and is assessed rather than withheld, " +
  "because a withheld report publishes nothing and this fixture would then be testing abstention " +
  "instead of the rules it exists for. A few more words make the length unambiguous.</p>";

const page = (body) =>
  `<!doctype html><html lang="en"><head><title>Test</title></head><body><h1>Test</h1>${PAD}${body}</body></html>`;

const run = (html) => assess(corpus, factsFromHtml(html, conversion.collect));
const fired = (r) => r.findings.map((f) => f.ruleId);

const CALL = '<a href="tel:+15551234567">Call us on (555) 123-4567</a>';

test("a page with no interactive element at all abstains rather than reporting a clean path", () => {
  const r = run(page("<p>Just words, no links and no forms.</p>"));
  assert.notEqual(r.status, "assessed");
  assert.equal(r.abstention.code, "nothing_to_assess");
  assert.equal(r.findings.length, 0);
});

test("a page with links but no action is reported", () => {
  const r = run(page('<a href="/about">About</a> <a href="/history">Our history</a>'));
  assert.ok(fired(r).includes("conversion.no-route-to-any-action"));
});

test("a page with a contact link is not reported as having no action", () => {
  const r = run(page('<a href="/about">About</a> <a href="/contact">Contact us</a>'));
  assert.ok(!fired(r).includes("conversion.no-route-to-any-action"));
});

test("a phone number in text with no tel: link fires", () => {
  const r = run(page("<p>Ring the shop on (555) 123-4567 any weekday.</p><a href=\"/contact\">Contact</a>"));
  assert.ok(fired(r).includes("conversion.phone-number-is-not-tappable"));
});

test("the same number as a tel: link does NOT fire", () => {
  const r = run(page(`<p>Ring the shop on (555) 123-4567.</p>${CALL}`));
  assert.ok(!fired(r).includes("conversion.phone-number-is-not-tappable"));
});

test("digit strings that are not phone numbers do not fire, which is what keeps this rule usable", () => {
  // Each of these would be caught by a naive "nine or more digits" rule, and each
  // appears on ordinary small-business pages.
  for (const notAPhone of [
    "<p>Order reference 998877665 shipped on time.</p>",
    "<p>Company number 12345678 registered in 2019.</p>",
    "<p>Open 2019 through 2026, every day.</p>",
    "<p>We have served 10000 customers since opening.</p>",
  ]) {
    const r = run(page(`${notAPhone}<a href="/contact">Contact</a>`));
    assert.ok(
      !fired(r).includes("conversion.phone-number-is-not-tappable"),
      `fired on non-phone text: ${notAPhone}`,
    );
  }
});

test("an unlinked email fires at medium, and a mailto does not", () => {
  const unlinked = run(page('<p>Write to hello@example.com.</p><a href="/contact">Contact</a>'));
  const hit = unlinked.findings.find((f) => f.ruleId === "conversion.email-is-not-a-mailto");
  assert.ok(hit);
  // Medium on purpose: unlinking an address to deter scrapers is a real trade.
  assert.equal(hit.severity, "medium");

  const linked = run(page('<a href="mailto:hello@example.com">hello@example.com</a>'));
  assert.ok(!fired(linked).includes("conversion.email-is-not-a-mailto"));
});

test("a disabled action button fires; a disabled non-action button does not", () => {
  const action = run(page('<button disabled>Book now</button><a href="/contact">Contact</a>'));
  assert.ok(fired(action).includes("conversion.primary-action-shipped-disabled"));

  // A disabled pagination or filter control is not the page's action and must not
  // be reported as one.
  const other = run(page('<button disabled>Previous page</button><a href="/contact">Contact us</a>'));
  assert.ok(!fired(other).includes("conversion.primary-action-shipped-disabled"));
});

test("an action that exists only in the footer fires; the same action in the body does not", () => {
  const footerOnly = run(page('<p>Words.</p><footer><a href="/contact">Contact us</a></footer>'));
  assert.ok(fired(footerOnly).includes("conversion.action-only-in-the-footer"));

  const both = run(page('<a href="/contact">Contact us</a><footer><a href="/contact">Contact us</a></footer>'));
  assert.ok(!fired(both).includes("conversion.action-only-in-the-footer"));
});

test("a form requiring more than five fields fires and names them", () => {
  const fields = ["name", "email", "phone", "company", "budget", "timeline"]
    .map((n) => `<input name="${n}" required>`)
    .join("");
  const r = run(page(`<form action="/send">${fields}<button>Send</button></form>`));
  const hit = r.findings.find((f) => f.ruleId === "conversion.form-asks-for-too-much");
  assert.ok(hit);
  assert.match(hit.evidence.observed, /timeline/);

  const lean = run(page('<form action="/send"><input name="email" required><textarea name="msg" required></textarea><button>Send</button></form>'));
  assert.ok(!fired(lean).includes("conversion.form-asks-for-too-much"));
});

test("a well-built contact page fires NOTHING, which is the case that decides whether this ships", () => {
  const clean = page(
    `${CALL}<a href="mailto:hello@example.com">hello@example.com</a>` +
      '<form action="/send"><input name="email" required><textarea name="msg" required></textarea><button>Send</button></form>',
  );
  const r = run(clean);
  assert.deepEqual(fired(r), [], `a clean page fired: ${fired(r).join(", ")}`);
});

test("every rule names the condition under which it is wrong", () => {
  for (const rule of conversion.RULES) {
    assert.ok(rule.falsePositiveNote.length > 80, `${rule.id}: note too short`);
    assert.ok(/wrong|deliberate|expected|cannot/i.test(rule.falsePositiveNote), `${rule.id}: not a real note`);
  }
});
