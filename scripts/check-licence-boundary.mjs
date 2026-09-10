/**
 * Fails the build if the licence SIGNING code can reach anything a customer runs.
 *
 * WHY THIS EXISTS AS A GATE AND NOT AS A COMMENT. The sibling product's published
 * MCP bundle contained the entire private reproduction pipeline: the dependency
 * was three hops deep through a barrel, absent from the package manifest, and
 * visible only in the bundler's graph. Its LEARNINGS entry L-04 puts it plainly:
 * a private/public boundary expressed only in a dependency list is not enforced.
 *
 * `licence/issue.mjs` holds the signing path. If it is ever reachable from the MCP
 * server a customer installs, the customer can issue their own licences, and the
 * whole entitlement model is decoration.
 *
 * WHAT THIS CHECKS, AND WHAT IT CANNOT. It reads the import graph statically from
 * the declared entry points. It CANNOT see a dynamic `import(variable)`, so those
 * are refused outright in shipping files rather than being resolved. And it
 * asserts its own denominator: an entry point that does not exist, or a graph that
 * walked zero files, is a failure and not a quiet pass. Right now SHIPPING_ENTRIES
 * is empty because the MCP package does not exist yet, and the script says so out
 * loud every run instead of printing a green tick over nothing.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Entry points for code that RUNS ON A CUSTOMER MACHINE.
 *
 * This was empty for as long as the MCP server did not exist, and the script
 * printed that fact on every run rather than a green tick, because a graph check
 * over zero entry points is the shape of a gate that scans nothing and reports
 * success. The server exists now, so the graph is real and the check has teeth
 * for the first time.
 */
const SHIPPING_ENTRIES = ["mcp/bin.mjs"];

/** Files allowed to import the signing path. Anything else is a failure. */
const SIGNING_IMPORTERS_ALLOWED = [
  // Both test files need to MINT tokens in order to verify them. Neither ships:
  // they are excluded from the MCP package by construction, and this gate will
  // walk the shipping graph and prove it once SHIPPING_ENTRIES is filled in.
  "licence/licence.test.mjs",
  "licence/operational.test.mjs",
  // The billing bridge. It mints a licence when Stripe confirms a payment, so it
  // needs the signing path, and it is server-only: a Next route handler never
  // reaches the browser bundle. When the MCP package exists and SHIPPING_ENTRIES
  // is filled in, the graph walk below will prove that rather than asserting it.
  "lib/billing/issueForPayment.mjs",
  // The billing readiness probe. It signs a throwaway licence and verifies it
  // against the compiled-in public key, because a write-only secret cannot be
  // checked by reading it back, only by using it. Server-only: a Next route
  // handler never reaches a browser bundle.
  "app/api/health/billing/route.ts",
];

const SIGNING_MODULE = "licence/issue.mjs";

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

const rel = (p) => path.relative(".", p).split(path.sep).join("/");

/**
 * Every static import specifier in a file, plus any dynamic import it attempts.
 *
 * THE PATTERN ALLOWS NEWLINES, AND THAT WAS A REAL HOLE. The first version used
 * `[^\n;]*?` between `import` and `from`, so it could only see a SINGLE-LINE
 * import. A multi-line one, which is the ordinary style for several named
 * imports, was invisible:
 *
 *     import {
 *       listAgents,
 *       getBrief,
 *     } from "./tools.mjs";
 *
 * Measured on the day the gate got a real graph to walk: it saw ONE of the two
 * local imports in `mcp/bin.mjs`, missed `./tools.mjs`, and therefore walked 3
 * files instead of 8 while printing "licence/issue.mjs is unreachable". Sound
 * about what it examined, and examining a fraction of the graph. That is L-15's
 * defect inside the gate that protects the signing key.
 *
 * `[^;]*?` allows newlines but not semicolons, so it still cannot run past the
 * end of a statement, and it errs toward finding MORE edges, which is the safe
 * direction for a reachability check.
 */
/**
 * Strip comments before counting anything.
 *
 * Needed because the completeness check below fired on this very file: its own
 * comments contain an EXAMPLE multi-line import, `} from "./tools.mjs";`, which
 * the crude counter read as a real one. Both measures are about code, so both
 * must see code. A check that cannot tell an example from the thing it exemplifies
 * will always fire first on the file that documents it.
 */
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const importsOf = (file) => {
  const src = codeOnly(readFileSync(file, "utf8"));
  const statics = [...src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g)].map(
    (m) => m[1],
  );
  const bareImports = [...src.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const dynamic = [...src.matchAll(/\bimport\s*\(\s*([^)]*)\)/g)].map((m) => m[1].trim());
  const found = [...statics, ...bareImports];

  /*
   * THE COMPLETENESS CHECK, which is what would have caught the above
   * immediately instead of a day later.
   *
   * A second, independent and much cruder count of local specifiers: every
   * occurrence of `from "."`. It cannot be fooled by statement shape because it
   * does not parse statements. If the parser finds fewer local imports than the
   * crude count, the parser has a blind spot and the whole reachability result is
   * worthless, so it fails rather than reporting a smaller graph.
   *
   * Two measures of one quantity, neither derived from the other. That is the
   * only kind of self-check worth having.
   */
  const crudeLocal = (src.match(/from\s*["']\.[^"']*["']/g) || []).length;
  const parsedLocal = found.filter((s) => s.startsWith(".")).length;
  if (parsedLocal < crudeLocal) {
    fail(
      `the import parser found ${parsedLocal} local import(s) in ${rel(file)} but a crude count ` +
      `finds ${crudeLocal}. The parser has a blind spot, so no reachability claim from this run is ` +
      `trustworthy. Fix the pattern rather than the count.`,
    );
  }

  return { statics: found, dynamic };
};

const resolveLocal = (from, spec) => {
  if (!spec.startsWith(".")) return null; // a package, not our tree
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.mjs`, `${base}.js`, `${base}.ts`, path.join(base, "index.mjs")]) {
    if (existsSync(c) && !c.endsWith(path.sep)) return c;
  }
  return null;
};

// --- 1. who imports the signing module, across the whole tree -----------------
const SCAN_DIRS = ["app", "licence", "scripts", "components", "lib", "corpus", "report"];
const SCAN_EXT = new Set([".mjs", ".js", ".ts", ".tsx"]);
const SKIP = new Set(["node_modules", ".next", ".git"]);

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.has(path.extname(entry))) out.push(full);
  }
  return out;
};

const allFiles = SCAN_DIRS.flatMap((d) => walk(d));
if (allFiles.length === 0) {
  fail(`scanned ZERO files across ${SCAN_DIRS.join(", ")}. A boundary check over nothing is absent, not passing.`);
}

const signingImporters = [];
for (const file of allFiles) {
  const { statics } = importsOf(file);
  for (const spec of statics) {
    const resolved = resolveLocal(file, spec);
    if (resolved && rel(resolved) === SIGNING_MODULE) signingImporters.push(rel(file));
  }
}

const unexpected = signingImporters.filter((f) => !SIGNING_IMPORTERS_ALLOWED.includes(f));
if (unexpected.length) {
  fail(
    `${unexpected.length} file(s) import ${SIGNING_MODULE} without being allowed to: ` +
    `${unexpected.join(", ")}.\n` +
    `      The signing path must not be reachable from anything a customer runs. If one of these ` +
    `is legitimately server-side, add it to SIGNING_IMPORTERS_ALLOWED with a reason in the commit.`,
  );
}

// The allowlist must not rot either: an entry that imports nothing is a stale
// exemption, and a stale exemption is how a real one gets waved through later.
const staleAllowances = SIGNING_IMPORTERS_ALLOWED.filter((f) => !signingImporters.includes(f));
if (staleAllowances.length) {
  fail(
    `${staleAllowances.length} entr(y/ies) in SIGNING_IMPORTERS_ALLOWED no longer import ` +
    `${SIGNING_MODULE}: ${staleAllowances.join(", ")}. Remove them. A stale exemption is a hole ` +
    `waiting for a filename to be reused.`,
  );
}

console.log(
  `scanned ${allFiles.length} file(s); ${signingImporters.length} import ${SIGNING_MODULE}, ` +
  `all ${SIGNING_IMPORTERS_ALLOWED.length} of them allowed`,
);

// --- 2. the shipping graph ----------------------------------------------------
if (SHIPPING_ENTRIES.length === 0) {
  console.log(
    `NOTE: SHIPPING_ENTRIES is empty, so no customer-facing import graph was walked. ` +
    `That is correct today (the MCP package does not exist yet) and it is printed rather than ` +
    `passed silently, because a graph check over zero entry points is exactly the shape of a gate ` +
    `that scans nothing and reports success. Add the MCP entry point here when it lands.`,
  );
  process.exit(0);
}

const seen = new Set();
const queue = [...SHIPPING_ENTRIES.map((e) => path.resolve(e))];
for (const e of queue) if (!existsSync(e)) fail(`shipping entry ${rel(e)} does not exist`);

while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);

  const { statics, dynamic } = importsOf(file);
  if (dynamic.length) {
    const computed = dynamic.filter((d) => !/^["'][^"']+["']$/.test(d));
    if (computed.length) {
      fail(
        `${rel(file)} uses a dynamic import with a computed specifier (${computed.join(", ")}). ` +
        `This check cannot follow it, so it cannot prove the signing path is unreachable. Make it ` +
        `static, or the boundary is unverified rather than safe.`,
      );
    }
  }
  for (const spec of [...statics, ...dynamic.map((d) => d.replace(/^["']|["']$/g, ""))]) {
    const resolved = resolveLocal(file, spec);
    if (!resolved) continue;
    if (rel(resolved) === SIGNING_MODULE) {
      fail(
        `the licence SIGNING path is reachable from shipping code: ${rel(file)} -> ${SIGNING_MODULE}. ` +
        `A customer who can sign licences does not need to buy one.`,
      );
    }
    queue.push(resolved);
  }
}

console.log(`OK: walked ${seen.size} file(s) from ${SHIPPING_ENTRIES.length} shipping entry point(s); ${SIGNING_MODULE} is unreachable`);
