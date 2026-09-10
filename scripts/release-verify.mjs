/**
 * `release-verifier`, the seat, as a program rather than a rulebook.
 *
 * WHAT THIS SEAT IS, because it is the one tier-1 seat that is NOT a corpus and
 * that was nearly built as one. It is listed among tier 1's twelve seats, and it
 * is also one of the four INTERNAL seats in `licence/roster.mjs` that audit our
 * own corpus and our own gates. It never ships to a customer. Its brief in the
 * roster is exact: "runs every gate and reports pass, fail or skipped, with a
 * denominator for each. Exists because a gate that scanned zero things and
 * printed PASS is the failure this whole product is against."
 *
 * WHY IT IS NOT JUST `npm run verify`. That script is an `&&` chain, which has
 * two properties this seat exists to remove.
 *
 *  1. THE FIRST RED HIDES EVERY GATE AFTER IT. A chain stops. So a broken
 *     typecheck means nobody learns whether the claims guard passed, and the
 *     next commit fixes the typecheck and discovers a second failure that was
 *     there all along. This runs every gate independently and reports all of
 *     them.
 *  2. IT CANNOT TELL PASSING FROM VACUOUS. `exit 0` from a gate that examined
 *     zero files is indistinguishable from `exit 0` from a gate that examined
 *     forty-one. Every gate in this repository prints its denominator for
 *     exactly that reason, and until now nothing read them. This reads them, and
 *     a gate whose denominator is zero or missing is reported as a FAILURE even
 *     when it exited clean.
 *
 * THE THREE STATES ARE THE POINT. `pass`, `fail`, `skipped`. Skipped is a
 * first-class result, printed as loudly as the others and counted in the
 * summary, because a run that quietly omitted the slow gates and printed a green
 * total is the same lie in a different costume.
 *
 * WHAT THIS CANNOT DO, said plainly. It cannot tell whether a gate's denominator
 * is the RIGHT denominator: `claims:check` reporting 24 files means it examined
 * 24, not that 24 is all there are. That comparison is `vacuous-check-hunter`'s
 * job, another internal seat, and it is not built.
 */
import { execFileSync } from "node:child_process";
import { classify, summarise } from "./release-gates.mjs";

const isWindows = process.platform === "win32";

/**
 * Every gate, with the pattern that finds its denominator.
 *
 * `denominator` is a regex whose first capture group is the number of things the
 * gate examined. A gate with `denominator: null` declares that it has none, and
 * that is allowed but must be DECLARED: the difference between "this gate has no
 * meaningful denominator" and "this gate prints one and we failed to read it" is
 * the whole value of this file, so the second case is a failure.
 */
const GATES = [
  {
    id: "typecheck",
    cmd: ["npm", "run", "typecheck"],
    /*
     * `tsc --noEmit` prints nothing on success, so there is no count to read.
     * Declared rather than inferred. It is still worth running: it is the only
     * gate that reads the .d.ts contract on the licence modules.
     */
    denominator: null,
    denominatorNote: "tsc prints nothing on success, so there is no count to read",
  },
  {
    id: "test",
    cmd: ["npm", "run", "test"],
    denominator: /^.*?tests (\d+)$/m,
    unit: "tests",
  },
  {
    id: "licence:boundary",
    cmd: ["npm", "run", "licence:boundary"],
    denominator: /scanned (\d+) file\(s\)/,
    unit: "files scanned for licence imports",
  },
  {
    id: "mcp:shape",
    cmd: ["npm", "run", "mcp:shape"],
    denominator: /costs ~(\d+) tokens/,
    unit: "tokens at connect",
  },
  {
    id: "claims:check",
    cmd: ["npm", "run", "claims:check"],
    denominator: /scanned (\d+) of \d+ file\(s\)/,
    unit: "files scanned for claims",
  },
  {
    id: "plan:check",
    cmd: ["npm", "run", "plan:check"],
    denominator: /against (\d+) corpus\/corpora/,
    unit: "corpora compared against the plan",
  },
  {
    id: "build",
    cmd: ["npm", "run", "build"],
    slow: true,
    /*
     * COUNTED, NOT MATCHED, and the first version got this wrong in a way worth
     * keeping. It used a plain regex for `Generating static pages (N/M)`, which
     * matched the FIRST occurrence, and the first thing Next prints is
     * `(0/9)`. So the verifier reported "0 pages built" and failed the build
     * gate on a build that had succeeded, which is a false positive produced by
     * reading a progress indicator as a result.
     *
     * The denominator that means anything is the TOTAL, so every match is read
     * and the largest total wins.
     */
    countPages: true,
    denominator: null,
    unit: "pages built",
  },
  {
    id: "selfcheck",
    cmd: ["npm", "run", "selfcheck"],
    slow: true,
    /*
     * The denominator that matters here is how many RULES ran, summed over every
     * rulebook and every page. A self-check that loaded no corpus would print a
     * clean report and mean nothing.
     *
     * The unit is declared HERE rather than written inside the reader, which is
     * where it started. The completeness test in `release-gates.test.mjs` found
     * it: a gate reporting a number whose unit lives in another function is two
     * spellings of one fact with nothing comparing them, and `denominatorNote`
     * was set as well, which would have claimed the gate has no denominator when
     * it has a good one.
     */
    countRules: true,
    denominator: null,
    unit: "rule evaluations across every page",
  },
];

const skipSlow = process.argv.includes("--skip-slow");
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice("--only=".length);

const run = (gate) => {
  const started = Date.now();
  try {
    const out = execFileSync(gate.cmd[0], gate.cmd.slice(1), {
      encoding: "utf8",
      stdio: "pipe",
      shell: isWindows,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, out, ms: Date.now() - started };
  } catch (err) {
    // Findings go to stderr in several of these gates. Reading stdout alone is
    // how a real failure looked like a pass earlier in this project (P-18).
    return {
      ok: false,
      out: `${err.stdout || ""}${err.stderr || ""}`,
      ms: Date.now() - started,
      status: err.status,
    };
  }
};

const denominatorFor = (gate, out) => {
  if (gate.countPages) {
    // The largest TOTAL across every progress line, because the first line Next
    // prints is (0/N) and a regex would read the progress as the result.
    let total = 0;
    for (const m of out.matchAll(/Generating static pages \((\d+)\/(\d+)\)/g)) {
      total = Math.max(total, Number(m[2]));
    }
    return { value: total, unit: gate.unit, missing: total === 0 };
  }
  if (gate.countRules) {
    // Sum "coverage N/M rules" across every rulebook and every page.
    let total = 0;
    for (const m of out.matchAll(/coverage (\d+)\/(\d+) rules/g)) total += Number(m[1]);
    return { value: total, unit: gate.unit, missing: total === 0 };
  }
  if (!gate.denominator) return { value: null, unit: null, note: gate.denominatorNote };
  const m = gate.denominator.exec(out);
  if (!m) return { value: null, unit: gate.unit, missing: true };
  const captured = m.slice(1).find((g) => g !== undefined);
  return { value: Number(captured), unit: gate.unit };
};

const results = [];
for (const gate of GATES) {
  if (only && gate.id !== only) {
    results.push({ gate, state: "skipped", why: `--only=${only}` });
    continue;
  }
  if (skipSlow && gate.slow) {
    results.push({ gate, state: "skipped", why: "--skip-slow" });
    continue;
  }
  const r = run(gate);
  const d = denominatorFor(gate, r.out);

  // The judgement lives in scripts/release-gates.mjs so it can be tested
  // without shelling out to eight real gates.
  const { state, why } = classify(r, d);
  results.push({ gate, state, why, denominator: d, ms: r.ms, out: r.out, status: r.status });
}

// --- the report ---------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
const widest = Math.max(...results.map((r) => r.gate.id.length));

console.log("");
console.log("release-verifier");
console.log(`  ${results.length} gate(s), run independently so one failure hides none of the others`);
console.log("");

for (const r of results) {
  const mark = r.state === "pass" ? "pass   " : r.state === "fail" ? "FAIL   " : "skipped";
  const secs = r.ms === undefined ? "" : `${(r.ms / 1000).toFixed(1)}s`;
  const d = r.denominator;
  const count =
    r.state === "skipped"
      ? r.why
      : d && d.value !== null
        ? `${d.value} ${d.unit}`
        : d && d.note
          ? `no denominator: ${d.note}`
          : "NO DENOMINATOR";
  console.log(`  ${mark} ${pad(r.gate.id, widest)}  ${pad(secs, 6)}  ${count}`);
  // Only a FAILURE needs the second line: a skipped gate already prints its
  // reason in the count column, and printing it twice reads like two findings.
  if (r.why && r.state === "fail") {
    console.log(`  ${" ".repeat(7)} ${pad("", widest)}  ${" ".repeat(6)}  ^ ${r.why}`);
  }
}

const failed = results.filter((r) => r.state === "fail");
const skipped = results.filter((r) => r.state === "skipped");
const verdict = summarise(results);

console.log("");
console.log(`  ${verdict.passed} passed, ${verdict.failed} failed, ${verdict.skipped} skipped`);

if (skipped.length) {
  console.log(
    `  SKIPPED IS NOT PASSED. ${skipped.map((r) => r.gate.id).join(", ")} did not run, so nothing ` +
    `here says anything about them.`,
  );
}
if (verdict.why) console.log(`  FAIL: ${verdict.why}`);

for (const r of failed) {
  console.log("");
  console.log(`--- ${r.gate.id} ---`);
  const lines = r.out.split(/\r?\n/).filter(Boolean);
  for (const l of lines.slice(-25)) console.log(`  ${l}`);
}

console.log("");
process.exit(verdict.ok ? 0 : 1);
