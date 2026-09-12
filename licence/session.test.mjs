/**
 * The session is the first thing here that can REFUSE to do work, so the tests
 * are mostly about the refusals being correct rather than about the cache being
 * fast.
 *
 * The failure that would matter most is the one this design was written around:
 * a budget keyed by PATH blocks `verify_fix`, whose whole job is to scan the same
 * path again after the agent edited it. That would make closing a finding
 * impossible while leaving the wasteful loop intact, so it is asserted directly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { consider, remember, resetSession, hashOf, FILES_PER_AGENT } from "./session.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "proof-session-"));
const write = (name, html) => {
  const p = path.join(dir, name);
  writeFileSync(p, html, "utf8");
  return p;
};

const PAGE = "<!doctype html><html><body><h1>A page</h1><p>Some text on it.</p></body></html>";
const report = (n) => ({ status: "assessed", findings: Array.from({ length: n }, (_, i) => ({ ruleId: `r${i}` })) });

test("a first scan runs, and is recorded against the budget", () => {
  resetSession();
  const file = write("a.html", PAGE);
  const v = consider("measurement", file);
  assert.equal(v.kind, "run");
  const out = remember("measurement", v.id, report(2));
  assert.equal(out.budget.repeat, false);
  assert.equal(out.budget.filesRead, 1);
  assert.equal(out.budget.remaining, FILES_PER_AGENT - 1);
});

test("the same bytes a second time are served from memory and SAY so", () => {
  resetSession();
  const file = write("b.html", PAGE);
  const first = consider("measurement", file);
  remember("measurement", first.id, report(2));

  const second = consider("measurement", file);
  assert.equal(second.kind, "repeat");
  assert.equal(second.report.budget.repeat, true);
  assert.match(second.report.budget.note, /already read/);
  // The earlier answer, not an empty one: a repeat must not look like a clean page.
  assert.equal(second.report.findings.length, 2);
});

test("EDITED bytes at the same path always re-run, or verify_fix is impossible", () => {
  resetSession();
  const file = write("c.html", PAGE);
  const first = consider("measurement", file);
  remember("measurement", first.id, report(3));

  // The agent fixes something and asks again. Same path, different bytes.
  writeFileSync(file, PAGE.replace("Some text", "Some corrected text"), "utf8");
  const after = consider("measurement", file);
  assert.equal(after.kind, "run", "an edited file was treated as a repeat, which breaks the fix-then-verify loop");
});

test("two departments do not share each other's cache or budget", () => {
  resetSession();
  const file = write("d.html", PAGE);
  const first = consider("measurement", file);
  remember("measurement", first.id, report(1));

  const other = consider("accessibility", file);
  assert.equal(other.kind, "run", "one department's read satisfied another department's request");
});

test("the budget ends the run, as an abstention with a code rather than an error", () => {
  resetSession();
  for (let i = 0; i < FILES_PER_AGENT; i += 1) {
    const f = write(`bulk-${i}.html`, `${PAGE}<!-- ${i} -->`);
    const v = consider("measurement", f);
    assert.equal(v.kind, "run", `file ${i} should have run`);
    remember("measurement", v.id, report(0));
  }
  const oneTooMany = write("over.html", `${PAGE}<!-- over -->`);
  const v = consider("measurement", oneTooMany);
  assert.equal(v.kind, "over-budget");
  // not_assessed with a coded reason, never an empty finding list that reads clean.
  assert.equal(v.report.status, "not_assessed");
  assert.equal(v.report.abstention.code, "budget_exhausted");
  assert.equal(v.report.findings.length, 0);
  assert.equal(v.report.budget.limit, FILES_PER_AGENT);
});

test("a target that is not a readable file is not cached, and is not an error here", () => {
  resetSession();
  assert.equal(hashOf(path.join(dir, "does-not-exist.html")), null);
  const v = consider("measurement", "https://example.com/page.html");
  // factsFromFile owns that failure and says something useful. This module simply
  // does not cache what it cannot identify, and must not block the attempt.
  assert.equal(v.kind, "run");
  assert.equal(v.id, null);
});

test("remember() on an unidentifiable target returns the report untouched", () => {
  resetSession();
  const r = report(1);
  assert.equal(remember("measurement", null, r), r);
});

test("resetSession actually clears, or every test after the first is testing the one before it", () => {
  resetSession();
  const file = write("e.html", PAGE);
  const v = consider("measurement", file);
  remember("measurement", v.id, report(1));
  assert.equal(consider("measurement", file).kind, "repeat");
  resetSession();
  assert.equal(consider("measurement", file).kind, "run");
});
