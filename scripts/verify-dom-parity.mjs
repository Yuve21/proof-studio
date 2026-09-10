/**
 * Proves the Next build renders the SAME DOM as the original static page.
 *
 * WHY THIS SHAPE. Each of these is a defect this check already had, found by
 * running it rather than by reading it.
 *
 * 1. IT COMPARES THE BUILD ARTIFACT ON DISK, not a running server.
 *    The first version pointed at `next start` on a fixed port. During mutation
 *    testing the restart silently failed to bind (EADDRINUSE, errno -4091), the
 *    old process kept serving the OLD build, and the check printed OK over a
 *    mutation it could not see. That is a gate reporting success because it
 *    could only see what it thought to look for. Comparing the `.next/server/app`
 *    output removes the entire class: no port, no second process, and the thing
 *    compared is exactly what the build just emitted.
 *
 * 2. IT PROVES THE BUILD IS NOT STALE, twice.
 *    The artifact must carry the build id from `.next/BUILD_ID` (Next writes it
 *    as an HTML comment after the doctype), and the artifact must not be older
 *    than the sources it is generated from. Either failing means "run the build
 *    again", which is a different message from "the DOM differs", and a reader
 *    needs to be told which one it is.
 *
 * 3. JAVASCRIPT IS DISABLED on both sides.
 *    The choreography mutates inline styles, transforms and text on nearly every
 *    element. Comparing with scripts running would either drown in animation
 *    noise or get "normalised" until it stopped comparing anything. With JS off,
 *    both pages are pure server output and every difference is a port difference.
 *
 * 4. IT ASSERTS ITS OWN DENOMINATOR.
 *    A parity check over an empty page would otherwise pass. It fails below
 *    MIN_NODES and always prints the count it actually compared.
 *
 * 5. IT COMPARES ATTRIBUTES AS A SORTED SET, not innerHTML.
 *    React does not preserve attribute order and no browser cares, so an
 *    innerHTML diff would be red forever and would then be deleted.
 *
 * WHAT IT CANNOT DO, stated so nobody assumes otherwise: it says nothing about
 * whether the animation still works. That needs a browser with JS on, watching
 * the choreography reach its end state, and it is a separate check.
 *
 * MUTATIONS, each with the gate it is aimed at named, per LEARNINGS L-19:
 *   M1 rename one class in index.html         -> parity: 1 node difference
 *   M2 delete the rail div from index.html    -> parity: cascading differences
 *   M3 empty <main> in index.html             -> denominator: below MIN_NODES
 *   M4 drop one data-prob from app/page.tsx   -> parity: 1 node difference
 *   M5 touch app/page.tsx without rebuilding  -> staleness: source newer than build
 *
 * Usage: npx next build && node scripts/verify-dom-parity.mjs
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const SOURCE_HTML = path.resolve("index.html");
const BUILT_HTML = path.resolve(".next/server/app/index.html");
const BUILD_ID_FILE = path.resolve(".next/BUILD_ID");
const SOURCES = [path.resolve("app/page.tsx"), path.resolve("app/layout.tsx")];
const MIN_NODES = 400;

const IGNORED_TAGS = ["SCRIPT", "TEMPLATE", "NOSCRIPT", "LINK", "META", "STYLE", "TITLE"];
const IGNORED_ATTRS = ["data-reactroot", "data-nscript", "nonce"];

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

// --- 1. the build must exist, match its own id, and not be older than its source
if (!existsSync(BUILT_HTML)) {
  fail(`${path.relative(".", BUILT_HTML)} does not exist. Run: npx next build`);
}
if (!existsSync(BUILD_ID_FILE)) fail(`.next/BUILD_ID does not exist. Run: npx next build`);

const buildId = readFileSync(BUILD_ID_FILE, "utf8").trim();
const builtHead = readFileSync(BUILT_HTML, "utf8").slice(0, 200);

/*
 * Next SANITISES the build id when it embeds it in the page: hyphens become
 * underscores. `.next/BUILD_ID` said `r-5aE-UOeJ51mJ-_494Oq` while the artifact
 * said `<!--r_5aE_UOeJ51mJ__494Oq-->`, from the same build, two seconds apart.
 *
 * Worth recording HOW this was found, because the first three runs of this check
 * PASSED. Those build ids happened to contain no hyphen, so a strict equality
 * test agreed by luck. A check that only works when the input lacks the one
 * character that breaks it is a hypothesis about the input rather than a check,
 * and it fails in the direction that looks like success.
 *
 * Both sides are normalised the same way now, so the comparison is about the
 * build and not about the alphabet.
 */
const normaliseId = (id) => id.replace(/-/g, "_");
if (!builtHead.includes(`<!--${normaliseId(buildId)}-->`)) {
  fail(
    `the built page does not carry build id ${buildId} (normalised ` +
    `${normaliseId(buildId)}), so .next/BUILD_ID and the artifact came from ` +
    `different builds. Run: npx next build`,
  );
}

const builtAt = statSync(BUILT_HTML).mtimeMs;
for (const src of SOURCES) {
  if (!existsSync(src)) fail(`${path.relative(".", src)} is missing`);
  const srcAt = statSync(src).mtimeMs;
  if (srcAt > builtAt) {
    fail(
      `${path.relative(".", src)} was modified after the build ` +
      `(source ${new Date(srcAt).toISOString()} is newer than build ${new Date(builtAt).toISOString()}). ` +
      `The comparison would run against a stale artifact. Run: npx next build`,
    );
  }
}
console.log(`build ${buildId} is current: artifact is newer than app/page.tsx and app/layout.tsx`);

// --- 2. the DOM signature, computed inside the page
// This function is serialised and runs in the browser, so it cannot see anything
// in this module's scope. Every list it needs arrives as an argument. Learned by
// running it: referencing the constants from the closure threw
// "IGNORED_TAGS is not defined" inside the page.
const signature = ({ ignoredTags, ignoredAttrs }) => {
  const TAGS = new Set(ignoredTags);
  const ATTRS = new Set(ignoredAttrs);
  const out = [];
  const rec = (el, depth) => {
    if (TAGS.has(el.tagName)) return;
    const attrs = Array.from(el.attributes)
      .filter((a) => !ATTRS.has(a.name))
      .map((a) => `${a.name}=${a.value}`)
      .sort()
      .join("|");
    // Own text only, so a parent does not restate every descendant's text and
    // turn one real difference into a hundred reported ones.
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    out.push(`${depth}\t${el.tagName}\t${attrs}\t${own}`);
    for (const child of el.children) rec(child, depth + 1);
  };
  rec(document.body, 0);
  return out;
};

/*
 * React renders `<div hidden=""><!--$--><!--/$--></div>` as the Suspense
 * boundary carrying the next/script push. It exists on the built side only, it
 * is invisible, and it is not ours.
 *
 * It is dropped rather than normalised away, and the drop carries two limits so
 * it cannot quietly become a licence to ignore real elements:
 *   - AT MOST ONE may be dropped from the built side. A second means the
 *     framework changed what it emits, which is a thing to look at, not skip.
 *   - ZERO may be dropped from the source side. Verified 2026-09-09: every
 *     `hidden` in index.html's markup is `aria-hidden`, never a bare attribute,
 *     so a bare-hidden div appearing there is OUR element and must be compared.
 */
const isFrameworkNode = (line) => {
  const [, tag, attrs, text] = line.split("\t");
  return tag === "DIV" && attrs === "hidden=" && !text;
};

const dropFramework = (sig, label, allowed) => {
  const removed = sig.filter(isFrameworkNode).length;
  if (removed > allowed) {
    fail(
      `dropped ${removed} framework node(s) from the ${label} side, but at most ` +
      `${allowed} is expected. An ignore list that grows on its own stops being an ` +
      `ignore list and becomes a blind spot.`,
    );
  }
  return { kept: sig.filter((l) => !isFrameworkNode(l)), removed };
};

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });

  const grab = async (file) => {
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded" });
    const sig = await page.evaluate(signature, {
      ignoredTags: IGNORED_TAGS,
      ignoredAttrs: IGNORED_ATTRS,
    });
    await page.close();
    return sig;
  };

  let built;
  let source;
  try {
    built = await grab(BUILT_HTML);
    source = await grab(SOURCE_HTML);
  } finally {
    await browser.close();
  }

  const a = dropFramework(built, "built", 1);
  const b = dropFramework(source, "source", 0);
  built = a.kept;
  source = b.kept;

  console.log(
    `compared ${built.length} node(s) from the build against ${source.length} from index.html ` +
    `(dropped ${a.removed} framework node from the build, ${b.removed} from the source)`,
  );

  if (built.length < MIN_NODES || source.length < MIN_NODES) {
    fail(
      `fewer than ${MIN_NODES} nodes on one side (built=${built.length}, source=${source.length}). ` +
      `A parity check over an empty page is the defect this project exists to catch.`,
    );
  }

  const diffs = [];
  const max = Math.max(built.length, source.length);
  for (let i = 0; i < max && diffs.length < 25; i += 1) {
    if (built[i] !== source[i]) {
      diffs.push({ i, built: built[i] ?? "(absent)", source: source[i] ?? "(absent)" });
    }
  }

  if (diffs.length) {
    console.error(`FAIL: ${diffs.length} node difference(s) (first 25 shown), out of ${max} compared.`);
    for (const d of diffs) {
      console.error(`\n  node #${d.i}`);
      console.error(`    source: ${d.source}`);
      console.error(`    built:  ${d.built}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: DOM identical across ${built.length} nodes, attributes compared as sorted sets, ` +
    `JS disabled on both, build id ${buildId}.`,
  );
};

run().catch((err) => fail(err.message));
