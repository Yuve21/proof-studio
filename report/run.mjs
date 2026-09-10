/**
 * Runs a corpus over a page in a real browser and produces a RECEIPT.
 *
 * This is the deliverable. Not a score out of a hundred, not a grade: a list of
 * findings, each citing a locator the reader can go and look at, each carrying
 * the condition under which the rule is wrong, and the version of the rulebook it
 * ran under so the whole thing can be re-derived.
 *
 * THREE PROPERTIES INHERITED FROM THE SIBLING PRODUCT, each of which exists
 * because its absence has cost somebody something:
 *
 * 1. ABSTENTION IS A STATUS, NOT A SCORE OF ZERO. `assessed`, `inconclusive` and
 *    `not_assessed` are outcomes. A page we could not read enough of does not get
 *    a clean report, it gets a withheld one with the reason. Refusing to say
 *    "clean" when we mean "could not tell" is the whole difference between a
 *    receipt and a marketing artifact.
 *
 * 2. EVERY COLLECTION ASSERTS ITS OWN DENOMINATOR. A probe that examined zero
 *    things is a failure regardless of exit code. So the receipt always carries
 *    what was counted, and a corpus that found nothing over an empty page reports
 *    `not_assessed` rather than a perfect result. "We found no problems" and "we
 *    read nothing" are different sentences and a count is what separates them.
 *
 * 3. NO EGRESS. The page is loaded from a local file or from a URL the caller
 *    explicitly passed, and nothing else is fetched. There is no telemetry, no
 *    lookup, no model call. Fonts and third-party assets referenced BY the page
 *    are the page's own requests, not ours, and `--offline` blocks even those.
 *
 * Usage:
 *   node report/run.mjs <file-or-url> [--json] [--offline]
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { loadCorpus } from "../corpus/load.mjs";
import * as seoOnpage from "../corpus/seo-onpage.mjs";

/** Corpora available to a run. One today; the tier-1 list is the destination. */
export const CORPORA = [seoOnpage];

/** Below this much body text we did not read a page, we read a shell. */
const MIN_BODY_TEXT = 200;

/**
 * Turn collected facts into findings. Pure, so it is testable without a browser,
 * which is the reason `collect` and `assess` are separate functions at all.
 *
 * @param {object} corpus a loaded corpus
 * @param {object} facts what collect() returned
 */
export function assess(corpus, facts) {
  const findings = [];
  const evaluated = [];
  const errors = [];

  for (const rule of corpus.rules) {
    let hits;
    try {
      hits = rule.detect(facts);
    } catch (err) {
      // A rule that throws is OUR defect, not the page's. It must never present
      // as "this page is fine": the rule is recorded as not evaluated, which
      // lowers coverage, and the error is surfaced.
      errors.push({ ruleId: rule.id, message: err.message });
      continue;
    }
    evaluated.push(rule.id);
    if (!Array.isArray(hits)) {
      errors.push({ ruleId: rule.id, message: "detect did not return an array" });
      continue;
    }
    for (const hit of hits) {
      findings.push({
        ruleId: rule.id,
        family: rule.family,
        severity: rule.severity,
        weight: rule.weight,
        title: rule.title,
        rationale: rule.rationale,
        // The note travels WITH the finding, always. A reader disagreeing with a
        // finding should not have to go and look the rebuttal up.
        falsePositiveNote: rule.falsePositiveNote,
        prevention: rule.prevention,
        evidence: { selector: hit.selector, observed: hit.observed },
      });
    }
  }

  const coverage = corpus.rules.length === 0 ? 0 : evaluated.length / corpus.rules.length;

  // Status, and the order of these branches is the honesty of the whole report.
  let status = "assessed";
  let abstention = null;
  if (facts.counts.bodyTextLength < MIN_BODY_TEXT) {
    status = "not_assessed";
    abstention = {
      code: "page_not_readable",
      reason:
        `the page yielded ${facts.counts.bodyTextLength} characters of text, under the ${MIN_BODY_TEXT} ` +
        `minimum. That is a shell rather than a page: it may not have finished rendering, or it may ` +
        `require an interaction this probe did not perform. No finding below is reliable and none is ` +
        `published.`,
    };
  } else if (coverage < 1) {
    status = "inconclusive";
    abstention = {
      code: "rules_failed",
      reason:
        `${corpus.rules.length - evaluated.length} of ${corpus.rules.length} rules could not be ` +
        `evaluated, so this report is incomplete. The failures are listed under errors and they are ` +
        `ours to fix, not yours.`,
    };
  }

  return {
    corpus: corpus.id,
    corpusVersion: corpus.version,
    status,
    abstention,
    // Withheld rather than published, because a withheld result must not be
    // printed one screen below the place it was withheld.
    findings: status === "not_assessed" ? [] : findings,
    findingsWithheld: status === "not_assessed" ? findings.length : 0,
    rulesEvaluated: evaluated,
    coverage,
    counts: facts.counts,
    errors,
  };
}

/**
 * @param {string} target a local file path or an http(s) URL
 * @param {{offline?: boolean}} [opts]
 */
export async function runReport(target, opts = {}) {
  const isUrl = /^https?:\/\//i.test(target);
  let url;
  if (isUrl) {
    url = target;
  } else {
    const abs = path.resolve(target);
    if (!existsSync(abs)) throw new Error(`${target} does not exist`);
    url = pathToFileURL(abs).href;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  if (opts.offline) {
    // Blocks everything the PAGE would fetch as well as anything else. Used by
    // the tests so a run cannot depend on a font CDN being up.
    await context.route("**/*", (route) =>
      /^(file|data):/.test(route.request().url()) || route.request().url() === url
        ? route.continue()
        : route.abort(),
    );
  }

  const reports = [];
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    for (const mod of CORPORA) {
      const corpus = loadCorpus(mod);
      const facts = await page.evaluate(corpus.collect);
      reports.push(assess(corpus, facts));
    }
  } finally {
    await browser.close();
  }

  return { target, url, ranAt: new Date().toISOString(), reports };
}

/** Human-readable receipt. The thing a client actually receives. */
export function formatReceipt(result) {
  const lines = [];
  lines.push(`PROOF CHECK`);
  lines.push(`target   ${result.target}`);
  lines.push(`ran      ${result.ranAt}`);
  lines.push("");

  for (const r of result.reports) {
    lines.push(`${r.corpus}  (rulebook ${r.corpusVersion})`);
    lines.push(
      `  status ${r.status}   coverage ${r.rulesEvaluated.length}/${r.rulesEvaluated.length + r.errors.length} rules   ` +
      `read ${r.counts.headings} headings, ${r.counts.images} images, ${r.counts.links} links, ` +
      `${r.counts.bodyTextLength} characters of text`,
    );
    if (r.abstention) {
      lines.push("");
      lines.push(`  WITHHELD (${r.abstention.code})`);
      lines.push(`  ${r.abstention.reason}`);
      if (r.findingsWithheld) {
        lines.push(`  ${r.findingsWithheld} finding(s) were computed and are NOT published, for that reason.`);
      }
    }
    if (r.errors.length) {
      lines.push("");
      for (const e of r.errors) lines.push(`  RULE ERROR ${e.ruleId}: ${e.message}`);
    }
    if (r.findings.length === 0 && r.status === "assessed") {
      lines.push("");
      lines.push(`  Nothing fired. Every one of the ${r.rulesEvaluated.length} rules ran and none matched.`);
    }
    for (const f of r.findings) {
      lines.push("");
      lines.push(`  [${f.severity}] ${f.title}`);
      lines.push(`    rule      ${f.ruleId}`);
      lines.push(`    where     ${f.evidence.selector}`);
      lines.push(`    observed  ${f.evidence.observed}`);
      lines.push(`    why       ${f.rationale}`);
      lines.push(`    fix       ${f.prevention}`);
      lines.push(`    WRONG IF  ${f.falsePositiveNote}`);
    }
    lines.push("");
  }

  lines.push(
    "Every finding above names the thing it looked at, so you can go and check it. Every rule is " +
    "published with the case where it is wrong, which is the paragraph marked WRONG IF. Nothing here " +
    "is a ranking prediction and nothing about this site left this machine to produce it.",
  );
  return lines.join("\n");
}

if (process.argv[1] && process.argv[1].endsWith("run.mjs")) {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node report/run.mjs <file-or-url> [--json] [--offline]");
    process.exit(2);
  }
  const opts = { offline: process.argv.includes("--offline") };
  runReport(target, opts)
    .then((result) => {
      console.log(process.argv.includes("--json") ? JSON.stringify(result, null, 2) : formatReceipt(result));
      const withheld = result.reports.some((r) => r.status !== "assessed");
      process.exit(withheld ? 3 : 0);
    })
    .catch((err) => {
      console.error(`FAIL: ${err.message}`);
      process.exit(1);
    });
}
