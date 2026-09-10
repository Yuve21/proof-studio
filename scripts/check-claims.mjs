/**
 * Fails the build on a claim this studio cannot substantiate.
 *
 * WHY THIS EXISTS, and it is not hypothetical. The sibling product
 * (Yuve21/slop-scorer) carries the same guard, and its LEARNINGS entry L-10
 * records that the guard's SHIPPED_DIRS was `["packages"]`, so the marketing
 * website was entirely unscanned. In re Workado (FTC, final order 2025-08-28,
 * 20-year duration) was pleaded over MARKETING CLAIMS, not over source code. A
 * guard that exists because of a regulator and does not cover the surface the
 * regulator reads is a guarantee that reports success without doing its job.
 *
 * So this one is pointed at the marketing surface first, deliberately, and it
 * runs before the site can take a payment.
 *
 * THE DENOMINATOR RULE. L-10's second half: the old guard's coverage assertion
 * counted whatever it happened to find, which meant it could not notice an
 * omission. This one names REQUIRED_FILES absolutely. If a file that must be
 * scanned is missing from the scan, that is a failure, not a smaller number.
 *
 * MUTATIONS, each with its gate named (LEARNINGS L-19):
 *   M1 add "94% accurate" to app/page.tsx        -> BANNED: accuracy figure
 *   M2 add "trained team" to app/page.tsx        -> BANNED: trained
 *   M3 add "guaranteed page one" to app/page.tsx -> BANNED: guaranteed ranking
 *   M4 delete app/page.tsx from REQUIRED_FILES   -> denominator: required file unscanned
 *   M5 point SCAN_DIRS at an empty directory     -> denominator: zero files scanned
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const SCAN_DIRS = ["app", "components", "docs", "corpus", "report", "licence"];
const SCAN_EXT = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs", ".md", ".mdx", ".html", ".json"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "public"]);

/**
 * Files that MUST be in the scan. Absolute members, not a count, so removing one
 * from the scan is a failure rather than a quieter pass. Every customer-facing
 * surface belongs here as it is created.
 */
const REQUIRED_FILES = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/rulebook/page.tsx",
  "corpus/seo-onpage.mjs",
  "docs/AGENT-ROSTER-PLAN.md",
];

/**
 * Every pattern carries the reason it is banned, because a guard whose message is
 * "not allowed" gets edited around, and a guard that fires on honest prose does
 * not get obeyed. Where a term is legitimate in some contexts, the pattern is
 * narrowed rather than the term being banned outright.
 */
const BANNED = [
  {
    id: "accuracy-figure",
    re: /\b\d{1,3}(?:\.\d+)?\s*%\s*(?:accura|precis|recall|effectiv|success)/i,
    why:
      "a stated accuracy, precision or recall percentage. In re Workado is a consent order over " +
      "exactly this. Any such number must be computed by a harness at test time, from a named " +
      "corpus, on the version being shipped.",
  },
  {
    id: "accuracy-word-with-number",
    re: /\b(?:accuracy|precision|recall|false[- ]positive rate)\b[^.\n]{0,40}?\b\d{1,3}(?:\.\d+)?\s*%/i,
    why: "a performance metric stated with a figure. Same substantiation problem as above.",
  },
  {
    id: "trained",
    re: /\b(?:trained|training)\b(?![^\n]{0,30}\bdata\b)/i,
    why:
      "the word 'trained' applied to this product. The agent loop here is RETRIEVAL over a " +
      "versioned corpus: nothing updates any model's weights and there is no fine-tune. " +
      "Describing it as trained is a capability claim with no substantiation behind it. Say what " +
      "is true and stronger: every recommendation cites the rule it came from and the case where " +
      "that rule is wrong.",
  },
  {
    id: "guaranteed-ranking",
    re: /\b(?:guarantee[ds]?|promise[ds]?)\b[^.\n]{0,60}\b(?:rank|ranking|page one|first page|top (?:of|spot)|#1)\b/i,
    why: "a guaranteed search ranking. Nobody can guarantee this and claiming it is unsubstantiated.",
  },
  {
    id: "guaranteed-result",
    re: /\b(?:guaranteed|guarantee)\b[^.\n]{0,40}\b(?:results?|sales|revenue|customers|leads|traffic)\b/i,
    why: "a guaranteed business outcome. Unsubstantiated performance claim.",
  },
  {
    id: "detects-ai",
    re: /\b(?:detects?|identif(?:y|ies)|tells you)\b[^.\n]{0,30}\b(?:if|whether|when)\b[^.\n]{0,30}\bAI\b/i,
    why:
      "a claim to detect whether something was made by AI. The sibling detector's output contract " +
      "forbids it: a score is a statement about an ARTIFACT and the verdict says what WE did, " +
      "never what anyone or anything IS.",
  },
  {
    id: "person-verdict",
    re: /\b(?:you|they|the author|the writer|the designer)\b[^.\n]{0,25}\b(?:used AI|faked|cheated|plagiaris|lied)\b/i,
    why: "a verdict about a PERSON. Defamation surface, and the output contract bans it in the type.",
  },
  {
    id: "cross-client-data",
    re: /\b(?:learn|learns|learning|train|trained)\b[^.\n]{0,40}\b(?:from|on|across)\b[^.\n]{0,25}\b(?:other|all|every|many)\b[^.\n]{0,20}\b(?:client|business|customer|organi[sz]ation)/i,
    why:
      "a claim that one client's data improves another's results. There is no aggregation service " +
      "and no cross-client pipeline. Saying it before building it is the Workado shape, and " +
      "building it is a consent decision made in the open with the privacy policy changed in the " +
      "same commit.",
  },
];

/**
 * Lines exempt because they are the guard talking about the thing, not claiming
 * it. Narrow on purpose: a file-level exemption would let a real claim hide in an
 * exempted file.
 */
const isMetaLine = (line) =>
  /\bBANNED\b|\bwhy:\s|check-claims|CLAIMS\.md|must not|may not|never (?:say|write|claim)|forbidden|do not (?:say|write|claim|describe)|is banned|unsubstantiated|not safe|cannot (?:say|claim)/i.test(
    line,
  );

/**
 * Negations that turn a banned phrase into a DISCLAIMER.
 *
 * FOUND BY THIS GUARD FIRING ON HONEST PROSE. The terms page says "Nobody can
 * promise a ranking, a position, an amount of traffic or a number of customers",
 * which is the opposite of a ranking promise, and the pattern matched
 * "promise a ranking" inside it and failed the build.
 *
 * That is not a small nuisance. A guard that fires on the exact sentence you
 * WANT on a legal page gets edited around rather than obeyed, and then it is not
 * a guard. This project's corpus loader carries the same rule for the same
 * reason: a guard's false-positive behaviour is a correctness property of the
 * guard.
 *
 * The check is deliberately narrow. It looks for a negation in the SAME sentence
 * and BEFORE the match, so "we do not promise rankings" passes while "we promise
 * rankings, and we do not miss" does not. Anything cleverer than that would be
 * guessing at meaning, and a guard that guesses is worse than one that is
 * occasionally strict.
 */
const NEGATORS =
  /\b(?:nobody|no one|nothing|never|cannot|can't|do not|does not|don't|doesn't|will not|won't|is not|are not|isn't|aren't|refuse[sd]?|without)\b/i;

/**
 * How many preceding lines are joined when looking for a negation.
 *
 * NOT ONE, AND THIS COST A DEBUGGING PASS. The first version of this check
 * looked only at the current line, and it still failed on the terms page,
 * because the sentence WRAPS: "Nobody can" ended one line and
 * "promise a ranking" began the next. A line-based scanner over wrapped prose
 * cannot see a negation that fell onto the previous line, so the granularity of
 * the check did not match the granularity of its input.
 *
 * Two lines of lookback covers a sentence wrapped once or twice at this file's
 * ~100 character width. **A negation more than two lines before its claim is
 * still invisible**, and that is stated rather than left as a surprise: if it
 * ever bites, widen this rather than exempting the file.
 */
const NEGATION_LOOKBACK = 2;

/**
 * True when the banned phrase sits inside a negated clause.
 *
 * @param {string[]} lines every line in the file
 * @param {number} lineNo zero-based index of the matching line
 * @param {number} index where the banned match starts within that line
 */
const isNegated = (lines, lineNo, index) => {
  const prior = lines.slice(Math.max(0, lineNo - NEGATION_LOOKBACK), lineNo).join(" ");
  const before = `${prior} ${lines[lineNo].slice(0, index)}`;

  // Only the current SENTENCE counts. A negation in the previous sentence says
  // nothing about this claim, and treating it as though it did would let a real
  // promise hide behind an unrelated disclaimer one sentence earlier.
  const sentenceStart = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("? "),
    before.lastIndexOf("! "),
  );
  const clause = before.slice(sentenceStart + 1);
  return NEGATORS.test(clause);
};

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.has(path.extname(entry))) out.push(full.split(path.sep).join("/"));
  }
  return out;
};

const files = SCAN_DIRS.flatMap((d) => walk(d));

// --- denominator, asserted two ways -----------------------------------------
if (files.length === 0) {
  console.error(
    `FAIL: scanned ZERO files across ${SCAN_DIRS.join(", ")}. A claims guard that examined ` +
    `nothing is not a passing guard, it is an absent one.`,
  );
  process.exit(1);
}

const missing = REQUIRED_FILES.filter((r) => !files.includes(r));
if (missing.length) {
  console.error(
    `FAIL: ${missing.length} required file(s) were not in the scan: ${missing.join(", ")}.\n` +
    `      These are named absolutely rather than counted, because a coverage assertion drawn ` +
    `from the same list as the subject cannot notice an omission (LEARNINGS L-10).`,
  );
  process.exit(1);
}

// --- the scan ----------------------------------------------------------------
const hits = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (isMetaLine(line)) return;
    for (const rule of BANNED) {
      const m = line.match(rule.re);
      if (!m) continue;
      // A negated banned phrase is a disclaimer, which is the sentence we WANT
      // on a legal page. See isNegated for why this is narrow rather than clever.
      if (typeof m.index === "number" && isNegated(lines, i, m.index)) continue;
      hits.push({ file, line: i + 1, id: rule.id, text: m[0].trim(), why: rule.why });
    }
  });
}

console.log(
  `scanned ${files.length} file(s) across ${SCAN_DIRS.join(", ")} against ${BANNED.length} ` +
  `banned pattern(s); ${REQUIRED_FILES.length} required file(s) all present`,
);

if (hits.length) {
  console.error(`\nFAIL: ${hits.length} unsubstantiated claim(s).`);
  for (const h of hits) {
    console.error(`\n  ${h.file}:${h.line}  [${h.id}]`);
    console.error(`    found: ${h.text}`);
    console.error(`    why:   ${h.why}`);
  }
  process.exit(1);
}

console.log("OK: no unsubstantiated claim found on the marketing surface.");
