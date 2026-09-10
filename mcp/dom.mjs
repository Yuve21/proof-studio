/**
 * Running the corpus against a local file, with no browser and no network.
 *
 * WHY THIS EXISTS AT ALL. The privacy page makes a specific promise about the
 * software a customer installs: it "runs on your own machine and makes no
 * network requests of any kind". That is not a policy, it is a constraint on the
 * design, and it rules out two obvious implementations. It rules out fetching
 * their URL, and it rules out shipping a browser: Playwright is over a hundred
 * megabytes and downloads a Chromium build on install, which is not something to
 * put on a shop owner's laptop to check a heading level.
 *
 * So the corpus's `collect` runs against a parsed document instead. It only ever
 * uses querySelector, querySelectorAll, getAttribute, textContent, tagName,
 * attributes, children, childNodes, nodeType, parentElement, body and
 * documentElement, all of which a lightweight DOM provides.
 *
 * THE RISK THIS INTRODUCES, AND HOW IT IS ANSWERED. The same corpus now runs
 * under TWO DOM implementations: a real browser on our side, and this one on the
 * customer's. That is two implementations of one behaviour with nothing
 * comparing them, which is the defect this house names most often. So
 * `mcp/parity.test.mjs` runs `collect` under both against the same HTML and
 * diffs the facts. Without that test this file would be a guess.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { parseHTML } from "linkedom";

/** Refuse a file that is not plausibly a page, before parsing megabytes of it. */
const MAX_BYTES = 8 * 1024 * 1024;

export class TargetError extends Error {}

/**
 * Read a local HTML file and return the facts a corpus reasons over.
 *
 * @param {string} target absolute or relative path to an .html file
 * @param {(doc: object) => object} collect the corpus's collect function
 */
export function factsFromFile(target, collect) {
  if (typeof target !== "string" || !target.trim()) {
    throw new TargetError("no file was named");
  }

  const abs = path.resolve(target);
  if (!existsSync(abs)) {
    throw new TargetError(
      `${target} does not exist. This checks a file on your machine, usually the built HTML of a ` +
      `page, because nothing about your site leaves your machine to run it.`,
    );
  }

  const stat = statSync(abs);
  if (stat.isDirectory()) throw new TargetError(`${target} is a directory, not a page`);
  if (stat.size === 0) {
    // Distinct from "unreadable": an empty file is a build that produced nothing,
    // and saying which it is saves somebody debugging the wrong thing.
    throw new TargetError(`${target} is empty, so there is no page to check`);
  }
  if (stat.size > MAX_BYTES) {
    throw new TargetError(`${target} is ${stat.size} bytes, over the ${MAX_BYTES} limit for one page`);
  }

  const html = readFileSync(abs, "utf8");
  const { document } = parseHTML(html);

  /*
   * `collect` was written to run inside a browser, where `document` is a global.
   * Rather than rewriting the corpus for two environments, which would be two
   * copies of one behaviour, the function is called with the parsed document
   * bound to that global name. One corpus, two hosts.
   */
  const run = new Function("document", `return (${collect.toString()})();`);
  return run(document);
}
