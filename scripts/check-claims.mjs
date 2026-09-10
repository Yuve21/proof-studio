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
  "app/terms/page.tsx",
  "app/privacy/page.tsx",
  "docs/AGENT-ROSTER-PLAN.md",
  "docs/MCP-DELIVERY.md",
];

/*
 * `corpus/seo-onpage.mjs` USED TO BE IN THAT LIST and it was removed, which is
 * worth explaining rather than doing quietly.
 *
 * It was there to prove the corpora were covered. Rulebooks are now excluded by
 * ROLE, because a file whose subject is other people's claims necessarily
 * contains the phrases this guard bans. Requiring a file to be scanned AND
 * excluding it by role is a contradiction, and the honest resolution is to pick
 * one rather than to special-case it.
 *
 * THE GAP THAT CREATES, stated because publishing a gap is worth more than a
 * number nobody can check: rule prose DOES reach customers, through /rulebook
 * and through the MCP's describe_rulebook tool. So a marketing claim about Proof
 * smuggled into a rule's rationale would be published and would not be scanned
 * here.
 *
 * Why that is accepted today: every rule's prose is a third-person statement
 * about the CUSTOMER's page ("the page has no title"), not a claim about Proof,
 * and a first-person boast in a rule rationale would be conspicuous in review.
 * What would change this: the moment a rule's prose starts describing what Proof
 * does rather than what a page contains, this needs a narrow first-person check
 * over the corpora instead of an exclusion.
 */

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
/**
 * A phrase inside a CODE SPAN is being quoted, not claimed.
 *
 * FIFTH OCCURRENCE OF THE SAME PATTERN IN ONE SESSION, and this time it was
 * docs/LEARNINGS.md, the file that records the pattern, tripping it by quoting
 * the banned phrases as EVIDENCE of what the corpus detects.
 *
 * Backticks are the line, and the choice is deliberate rather than convenient.
 * They are a documentation convention: no marketing page renders a backtick, so
 * nothing a customer reads as a promise can hide behind one. A double-quoted
 * testimonial saying "we guarantee page one" is STILL caught, which is correct,
 * because a claim in a customer mouth on our page is still a claim we publish.
 *
 * Derived from the text own markup rather than from a path list, for the same
 * reason the rulebook exclusion is derived from CORPUS_ID: an exemption keyed to
 * a location rots, and an exemption keyed to what the text IS does not.
 */
const insideCodeSpan = (line, index) => {
  const before = line.slice(0, index);
  // An odd number of backticks before the match means a span opened and has not
  // closed yet, so the match is inside it.
  return (before.match(/`/g) || []).length % 2 === 1;
};

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

/**
 * A file whose SUBJECT is other people's claims is not making one.
 *
 * THIS EXCLUSION IS DERIVED, NOT LISTED, and the difference is the whole point.
 *
 * The `claims-officer` corpus exists to detect unsubstantiated claims, so its
 * rule patterns, rationales and fixtures necessarily contain the exact phrases
 * this guard bans. On the run that added it, this guard reported 14 findings,
 * every one of them a pattern doing its job. A guard that fails the build on the
 * code written to enforce it is a guard somebody switches off.
 *
 * The tempting fix is to add `corpus` to a skip list. That is how a scope
 * correction becomes a hole: the next directory gets added for a worse reason and
 * nobody remembers which exemptions were principled.
 *
 * So the test is what the file IS. A corpus declares `CORPUS_ID`, which is its
 * own statement that it is a rulebook about somebody else's page. A test file
 * declares itself by name. Both are self-describing, so the exclusion cannot rot
 * into naming a file that has changed purpose, and neither can be claimed by a
 * marketing page.
 *
 * THE LIMIT BELOW IS NOT DECORATION, and it was WRONG in a way worth recording.
 *
 * It used to be a hardcoded 12 sitting under a comment claiming the count was
 * "checked against the number of files that could legitimately qualify". It was
 * not checked against anything. It was a constant, and the comment above it
 * described a check that did not exist, which is this house's most-named defect
 * arriving in the guard whose whole job is to catch published statements that are
 * not true. It was also about to fail the build for an entirely benign reason:
 * every new rulebook adds two legitimate exclusions, and the count reached 11.
 *
 * Replaced by the two checks the constant was standing in for.
 *
 *  1. A PROPORTIONAL ceiling. Exclusions must stay a minority of the tree. This
 *     grows correctly as rulebooks are added and still fails if the exclusion
 *     ever starts swallowing the codebase.
 *  2. The check that actually catches the abuse the constant was aimed at. The
 *     worry was never the count, it was a MARKETING file declaring CORPUS_ID to
 *     get past this guard. So no file under a customer-facing directory may be
 *     excluded unless it is a test fixture. That fires on one file, which is
 *     exactly how the abuse would arrive, and no ceiling of any size would have
 *     caught it.
 */
const isAboutClaimsRatherThanMakingThem = (file, source) =>
  /^\s*export const CORPUS_ID\s*=/m.test(source) || /\.test\.mjs$/.test(file);

const allFiles = SCAN_DIRS.flatMap((d) => walk(d));
const excluded = [];
const files = allFiles.filter((f) => {
  if (isAboutClaimsRatherThanMakingThem(f, readFileSync(f, "utf8"))) {
    excluded.push(f);
    return false;
  }
  return true;
});

/** Directories a customer reads. A file here is marketing until proven otherwise. */
const CUSTOMER_FACING = ["app", "components"];

const MAX_EXCLUDED = Math.floor(allFiles.length / 2);
if (excluded.length > MAX_EXCLUDED) {
  console.error(
    `FAIL: ${excluded.length} of ${allFiles.length} files were excluded as rulebooks or fixtures, ` +
    `over the proportional ceiling of ${MAX_EXCLUDED} (half the tree): ${excluded.join(", ")}.\n` +
    `      The exclusion is meant to be a minority of the codebase. At this share the guard is ` +
    `checking less than it skips, which is not a passing guard.`,
  );
  process.exit(1);
}

const smuggled = excluded.filter(
  (f) => CUSTOMER_FACING.some((d) => f.split(/[\\/]/)[0] === d) && !/\.test\.mjs$/.test(f),
);
if (smuggled.length) {
  console.error(
    `FAIL: ${smuggled.length} customer-facing file(s) were excluded from the claims guard by ` +
    `declaring CORPUS_ID: ${smuggled.join(", ")}.\n` +
    `      A rulebook does not live under ${CUSTOMER_FACING.join(" or ")}. Either the file is in ` +
    `the wrong place or the exclusion is being used to publish a claim past this guard.`,
  );
  process.exit(1);
}

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
      // A phrase inside a code span is quoted evidence, not a claim. See
      // insideCodeSpan for why backticks specifically.
      if (typeof m.index === "number" && insideCodeSpan(line, m.index)) continue;
      hits.push({ file, line: i + 1, id: rule.id, text: m[0].trim(), why: rule.why });
    }
  });
}

console.log(
  `scanned ${files.length} of ${allFiles.length} file(s) across ${SCAN_DIRS.join(", ")} against ` +
  `${BANNED.length} banned pattern(s); ${REQUIRED_FILES.length} required file(s) all present; ` +
  `${excluded.length} excluded as rulebooks or fixtures (ceiling ${MAX_EXCLUDED}, half the tree), ` +
  // Computed, not written. It is only ever 0 here because the check above exits
  // first, and a literal that is true by control flow is a literal that stops
  // being true when the control flow moves. See LEARNINGS P-19.
  `${smuggled.length} of them customer-facing`,
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
