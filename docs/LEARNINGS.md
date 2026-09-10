# Learnings (what outcomes taught us)

Same contract as the sibling product: an entry carries a date, a one-sentence falsifiable claim, the
EVIDENCE (a locator, a measured number, or a command that ran), a confidence, a status, and what to
do differently. No evidence means it is labelled `HYPOTHESIS`.

Read this before adding a check. Every entry below is a defect that a check written in THIS
repository already had, found by running it rather than by reading it. That is not a coincidence and
it is the reason the file exists: four checks were written here and four of them were wrong on the
first attempt, in four different ways.

---

### P-01 · 2026-09-09 · A parity check pointed at a long-running server passed over a mutation it could not see
- **Claim:** the first `verify-dom-parity.mjs` compared a page served by `next start` on a fixed
  port. During mutation testing the restart silently failed to bind, the previous process kept
  serving the PREVIOUS build, and the check reported OK over a mutation that had definitely landed
  on disk.
- **Evidence:** M4 removed one `data-prob=""` from `app/page.tsx` (3 occurrences to 2, confirmed on
  disk), `next build` succeeded, and the check printed
  `OK: DOM identical across 443 nodes`. Diagnosis by command: `/tmp/proof-next.log` carried
  `errno: -4091` (EADDRINUSE) and `netstat` showed PID 11708 still holding 3210, while
  `curl -s localhost:3210 | grep -c 'data-prob=""'` returned **3** against a source that now had
  **2**. So the gate was sound about what it examined and examined the wrong artifact.
- **Why it matters more than the bug:** this is the disqualifying class, in the verification of a
  port whose entire purpose was to prove nothing was lost. A green parity check is exactly the
  evidence somebody would cite to stop looking.
- **Confidence:** high (reproduced, diagnosed by three independent commands).
- **Status:** FIXED. The check no longer talks to a server at all. It compares
  `.next/server/app/index.html`, the artifact the build just emitted, against `index.html`, both
  loaded from disk with JavaScript disabled. No port, no second process, nothing to go stale
  between the build and the comparison. Re-run of M4 against the fixed check: RED, naming node
  #151 and the exact missing attribute.
- **Next time:** prefer comparing a BUILD ARTIFACT to querying a running service. A service is a
  second copy of the thing under test with its own lifecycle, and its lifecycle is where the
  staleness hides. And when a mutation survives, do not conclude the check is fine and do not
  conclude the check is broken: first establish that the gate could SEE the mutation. Here it could
  not, which made a survivor a finding about the harness rather than about the code.

### P-02 · 2026-09-09 · A build-id assertion passed three times by luck, because those ids happened to contain no hyphen
- **Claim:** the staleness guard compared `.next/BUILD_ID` against the id Next embeds in the
  prerendered HTML, by string equality. Next SANITISES that id on the way in, turning hyphens into
  underscores, so the assertion was wrong for any build id containing a hyphen and right for every
  other one.
- **Evidence:** measured on one build, two seconds apart. `.next/BUILD_ID` held
  `r-5aE-UOeJ51mJ-_494Oq`; the artifact's head held `<!--r_5aE_UOeJ51mJ__494Oq-->`. The three
  earlier runs had ids `moRczvLwGt1vbJF2IRank`, `fKgA0THCbhkVJk1yfhhEW` and
  `jBVe6VJGuODjr71Avtbih`, none containing a hyphen, so all three agreed.
- **Why it matters:** the failure mode was a false FAILURE this time, which is the harmless
  direction and the reason it got caught at all. The same defect in a check that fails OPEN would
  have passed silently forever, and nobody would have had a reason to look. The three green runs are
  the actual lesson: they were not evidence of correctness, they were evidence about the alphabet of
  the last three random strings.
- **Confidence:** high (both values read from disk in the same second, and the three prior ids are
  in the session record).
- **Status:** FIXED. Both sides are normalised with the same function before comparison, and the
  reason is written above the line so nobody simplifies it back.
- **Next time:** when comparing a value against a copy of itself that passed through somebody else's
  code, ask what that code does to it. An identifier that is legal in a filename and illegal in a
  JavaScript identifier gets rewritten somewhere, and the rewrite is invisible until an input
  contains the character that triggers it. This is the sibling product's rule about a regex being a
  hypothesis about its input, applied to an equality test.

### P-03 · 2026-09-09 · The only surviving mutation of five was aimed at a catch block no test reached
- **Claim:** the licence verifier had fifteen tests, five mutations were run against it, and the one
  that survived was the one that made a crypto exception ENTITLE the caller instead of refusing.
- **Evidence:** M4 replaced the catch block's `return invalid(...)` in `licence/verify.mjs` with
  `signatureOk = true`. Landed on disk, confirmed by grep. `node --test` stayed green: **14 pass,
  0 fail.** The other four mutations were red (M1 accept any signature: 5 failures; M2 drop the
  expiry check: 1; M3 verify a re-serialised payload: 1; M5 register every agent regardless of
  licence: 1).
  The reason was not subtle, and that is the point: every malformed token in the suite was refused by
  the STRUCTURAL checks above the try block (base64url alphabet, segment count, 64-byte signature
  length), so nothing in fifteen tests ever caused an exception inside it. The catch that turns a
  crypto failure into a refusal was completely uncovered.
- **Why it matters more than an ordinary coverage gap:** the uncovered line fails OPEN. And the
  realistic way to reach it is not an attacker, it is a corrupt or truncated issuer key in a deploy,
  which would have turned a misconfiguration into free licences for everybody.
- **Confidence:** high (five mutations run, each landing verified on disk, four red and one green).
- **Status:** FIXED. A sixteenth test drives a PEM-shaped key with garbage inside through
  `createPublicKey`, which throws, and asserts the result is a refusal naming the problem with zero
  agents entitled. M4 re-run against the new suite: RED, and ONLY that test fails, which is the
  evidence the test covers exactly that path and nothing else.
- **Next time:** after writing a try/catch, ask which test reaches the catch. If the answer is none,
  the catch is prose. The general form is cheap: for every guard, name the input that triggers it and
  check that input is in the suite. Structural validation placed BEFORE a cryptographic check will
  absorb every malformed input a test author naturally reaches for, which makes the crypto failure
  path feel covered when it is untouched.

### P-04 · 2026-09-09 · A backslash escape did not survive the shell layer and broke a generated test file
- **Claim:** writing an escaped newline inside a Python heredoc to emit a JavaScript escape produced
  a REAL newline in the output file instead, breaking a string literal across lines.
- **Evidence:** the generated line read `const CORRUPT = "-----BEGIN PUBLIC KEY-----` followed by a
  literal line break, confirmed with `cat -A`, and node reported
  `SyntaxError: Invalid or unexpected token`. Three successive attempts to fix it by adjusting the
  escaping failed. Resolved by removing escapes from the problem entirely, building the value with
  `.join(String.fromCharCode(10))`. The same class then recurred within the hour: a backtick inside a
  double-quoted `python3 -c` argument was eaten by bash command substitution, producing
  `command not found` for three words of prose.
- **Confidence:** high (reproduced three times, diagnosed with `cat -A`).
- **Status:** FIXED both times. Generated source now avoids backslash escapes, and multi-line
  generation uses a quoted heredoc so no shell layer interprets the content.
- **Next time:** do not send backslash escapes or backticks through a shell into a generated source
  file. Build the value structurally, or use a quoted heredoc so nothing expands. And note WHY this
  cost minutes rather than weeks: the failure was loud. The same layer silently eating an escape
  inside a REGEX would have produced a pattern matching slightly less than intended, and then
  reported a confident count over the gap, which is the shape that costs weeks.

### P-05 · 2026-09-09 · A valid licence entitled nothing and reported success, because a tier existed in billing terms and not in code
- **Claim:** `TIERS` in `licence/roster.mjs` defined only `tier-1`, so a correctly signed, unexpired
  `tier-2` licence returned `licence.valid: true` with ZERO agents registered, and nothing in the
  shape of that answer said anything was wrong.
- **Evidence:** measured by execution, not read. A `tier-2` token verified as
  `licence valid: true | agents registered: 0 | unknown: [ 'tier-2' ]`. `TIERS` held one key. A
  caller reading `licence.valid`, which is the obvious thing to read, would have rendered a healthy
  server with no tools on it, for a customer who had paid.
- **Why it is the disqualifying class and not a missing constant:** the licence layer is the thing
  that decides whether a customer got what they bought, and it answered "yes" while delivering
  nothing. The direction matters too: the customer sees an empty server and blames their own token,
  so the support thread starts in the wrong place.
- **Confidence:** high (reproduced by execution before and after).
- **Status:** FIXED, and the fix has two halves because the bug did.
  (a) All five tiers are defined, and a test asserts they PARTITION the roster: 11 + 14 + 7 + 16 + 12
  = 60, every seat in exactly one tier, no duplicates, no untiered seat, no tier naming a seat the
  plan does not define. `TIERS` and the plan document are written in different files for different
  purposes and neither derives from the other, so the comparison is real rather than a mirror.
  (b) "Licensed, and entitles nothing" is now its own `status` value rather than a variety of
  working, because it is ALWAYS a mistake on our side, so the server can surface it as a fault and
  tell the customer to contact us instead of re-checking their token.
  Mutation M12 renamed `tier-2` away again: RED on the partition test. That is the check that would
  have caught the original defect.
- **Next time:** when a list defines what a customer is entitled to, the question is not whether the
  list is right today, it is what compares it to the thing that sells it. And any function that can
  succeed while producing an empty result needs a third state: success, failure, and succeeded-but-
  empty. Two states force the caller to read an empty collection as either an error it is not or a
  success it is not.

### P-06 · 2026-09-09 · Adding a grace period turned an existing test red, and the test was right to break
- **Claim:** the expiry test used a clock 31 days out, which was one day past a 30-day licence. Adding
  a 7-day grace window made that timestamp fall INSIDE grace, so the licence was still valid and the
  test failed.
- **Evidence:** `an expired licence is refused, and says expired rather than forged` went red with
  `actual: true, expected: false` immediately after `GRACE_DAYS` landed.
- **Why it is worth an entry:** this is the correct behaviour of a test and the tempting fix is the
  wrong one. Relaxing the assertion, or deleting the test because "grace is covered elsewhere now",
  would have removed the only check that expiry is enforced at all. The right fix is to move the
  clock past grace and keep asserting exactly what was asserted before, then cover grace separately
  in both directions (inside it works, past it does not).
- **Confidence:** high (observed directly).
- **Status:** FIXED. The test now uses `30 + GRACE_DAYS + 1` days and says in a comment why it moved,
  so the next reader does not "simplify" it back to a literal.
- **Next time:** when a product change turns a test red, the first question is whether the test was
  describing something that is still true. If it was, move the fixture and keep the assertion. A
  weakened assertion is invisible forever after, and the commit that weakened it will read as a
  feature.

### P-07 · 2026-09-09 · The signing-boundary gate caught a real change on its first day, not a mutation
- **Claim:** `check-licence-boundary.mjs` failed the build because a newly written test file imported
  `licence/issue.mjs` without being in the allowlist.
- **Evidence:** `FAIL: 1 file(s) import licence/issue.mjs without being allowed to:
  licence/operational.test.mjs`, during a routine `npm run verify`, hours after the gate was written.
- **Why it is worth recording:** every other gate in this repository has so far only ever gone red
  under a deliberate mutation. This one went red on ordinary work, which is the only real evidence
  that a gate is load-bearing rather than ceremonial. The fix was to add the file WITH a written
  reason, which is the flow the gate is designed to force, and the stale-exemption check means that
  reason cannot outlive its truth.
- **Confidence:** high (it happened).
- **Status:** working as designed. Allowlist now names two test files, both with the reason recorded.
- **Next time:** nothing to change. Recorded because a gate that has fired once on real work should be
  trusted more than one that has only been demonstrated, and the next person deciding whether to keep
  it should know it has already earned its place.

### P-08 · 2026-09-09 · A guard was dead twice over, for two unrelated reasons, and each time a mutation went green
- **Claim:** the corpus loader's hedge check, which refuses a false-positive note that waffles
  instead of naming a condition, could not fire on any input. Twice, for two different causes, and
  both were found by mutation rather than by reading.
- **Evidence, first cause, ORDERING.** The length gate (80-character minimum) ran BEFORE the hedge
  gate, and every hedge worth testing is shorter than 80 characters, so the length gate rejected all
  of them and the hedge gate was never reached. Mutation M14 disabled it: **41 pass, 0 fail.** This
  is exactly P-03's shape, structural validation absorbing every input a test author naturally
  reaches for, in a second subsystem within the same session.
- **Evidence, second cause, and it is worse.** After reordering and adding long padded hedges to the
  suite, M14 STILL went green. The patterns had been generated through a shell heredoc, which
  collapsed the escaped backslashes, and Python then read the two-character sequence for a word
  boundary as a BACKSPACE control character and consumed it, while leaving the whitespace class
  untouched because that one is not a Python escape. Measured: **32 backspace characters (0x08) in
  `corpus/load.mjs`, zero word-boundary sequences.** The damage was SELECTIVE and invisible: the file
  read correctly in an editor and in a diff.
  The consequence was not a looser match, it was a dead gate in the opposite direction. With
  boundaries gone the condition marker for "on a" matched inside "acting ON Anything", so nearly any
  prose counted as naming a condition and the hedge half could never fire.
- **The pattern question, which is what found the extent of it:** not "is this regex right" but
  "which other file did I generate through a shell?" Nine globs across the repository, and the answer
  was one file with 32 occurrences and every other file clean. Fixed by replacing every backspace
  character with the sequence it should have been, which restored all 32 boundaries at once.
- **Confidence:** high (both causes reproduced, the byte count measured, and M14 red afterwards).
- **Status:** FIXED. The hedge gate runs before the length gate, so a short hedge is told it is a
  hedge rather than told it is short. The patterns are anchored properly. And the check is two-part
  on purpose: a note may CONTAIN a hedge as long as it also names the condition, because a guard that
  fires on honest prose gets edited around rather than obeyed. Both halves are pinned by mutations in
  opposite directions: M14 disables the gate (red), M19 removes the condition half so honest notes
  are rejected too (red).
- **Next time:** two rules, and the second is the general one.
  First: **never generate regex source through a shell.** Edit the file directly. Some escapes
  survive the trip and others silently change meaning, so the corruption is partial and the file
  looks fine.
  Second: when a check has a cheap structural precondition and an expensive semantic one, the
  semantic one goes FIRST or it will never see an interesting input. Ask of every guard: name the
  input that triggers it, and confirm that input is in the suite and reaches this line.

### P-09 · 2026-09-09 · The first report we ran found two real defects on our own page, which is the only honest way to ship it
- **Claim:** `seo-onpage` run against Proof's own built page reported two heading-level skips, both
  genuine, before it was ever pointed at a client.
- **Evidence:** `h3 "Instagram is not a website" follows h1, skipping h2` and
  `h4 "Design and build" follows h2, skipping h3`, each with a CSS selector. Fixed in BOTH
  `index.html` and `app/page.tsx` identically, three h3 to h2 and six h4 to h3, with the stylesheet
  selectors moved in the same commit. DOM parity held at 443 nodes afterwards, which is the evidence
  the two copies did not drift. Re-run: `Nothing fired. Every one of the 10 rules ran and none
  matched.`
- **A measurement of mine that was invalid, and worth recording because it looked fine.** I first
  checked the computed styles against the BUILT artifact over `file://`, and every value came back as
  a browser default. The built page links its stylesheet at an absolute `/_next/...` path which does
  not resolve over `file://`, so I had measured an unstyled page and would have concluded the CSS was
  broken. Re-measured against `index.html`, which carries its styles inline: 21.6px at 112% stretch
  and 17.28px at 110% in grid column 2, exactly as intended.
- **Confidence:** high (the findings, the fix, the parity re-check and the computed styles were all
  run).
- **Status:** FIXED, and the page is clean against its own rulebook.
- **Next time:** point a new check at your own artifact first. A studio named Proof whose own page
  fails its own rulebook is the defect it sells the detection of, and finding two real ones on the
  first run is the strongest available evidence that the corpus is not decorative. And when a
  computed-style measurement returns suspiciously round defaults, check that the stylesheet actually
  loaded before believing the numbers.

### P-10 · 2026-09-09 · The parity gate is retired on purpose, and this is the record it produced
- **Claim:** `scripts/verify-dom-parity.mjs` asserted that the Next build renders the same DOM as the
  original static `index.html`. It did that successfully, and it is now removed from the verify
  chain, because the migration it was guarding is complete and the gate had become a lock on the
  page.
- **The proof, recorded here so removing the gate does not remove the evidence:** 443 nodes
  identical, compared by depth, tag, sorted attribute set and own text, with JavaScript disabled on
  both sides, at commit `328a7b1`. It survived a heading-level change applied to both copies, which
  is the strongest single demonstration: the DOM moved and the two copies moved together.
- **Why removing it is not the thing this house warns about.** The rule is never widen a baseline to
  make a run go green, and never fix a gate by loosening what it accepts. This gate is not being
  loosened, and the property it asserted has not become inconvenient: it has become FALSE ON PURPOSE.
  It asserted a MIGRATION invariant, that two artifacts are identical. The moment the marketing page
  is deliberately changed, `index.html` is either updated in lockstep, which is two copies of the
  truth with nothing but this gate comparing them, or it is stale, which the gate reports as a defect
  when it is actually a decision. Neither is a correctness property worth holding.
- **What replaces it, because a gate should not be removed without one.** `npm run selfcheck`, which
  runs the real rulebook against the real built page on every verify and fails on abstention. That is
  a stronger ongoing gate than parity ever was: parity could only tell us the page had not changed,
  and the self-check tells us whether the page is any good.
- **Confidence:** high (the parity result was reproduced many times, including under five mutations).
- **Status:** RETIRED, and the whole migration scaffold is deleted: `index.html`,
  `scripts/verify-dom-parity.mjs` and `scripts/html-to-jsx.mjs` all went in the same commit that
  put Vercel live. An earlier draft of this entry said the script would stay in the tree "runnable
  by hand against a frozen index.html", and that was incoherent: deleting the input makes the script
  unrunnable, and keeping a script that cannot run is the decoration this project is against. The
  proof is the number, recorded above, and the number does not need the script that produced it.
- **Next time:** distinguish a gate that asserts CORRECTNESS from one that asserts a MIGRATION. The
  second kind has a natural end, and keeping it past that end turns a proof into an obstacle. Write
  the expiry condition into the gate when you write the gate, and record its result somewhere
  permanent before switching it off, because the number is the valuable part and the script is not.

### P-11 · 2026-09-10 · The claims guard failed the build on the exact sentence a legal page needs, and the granularity of the check did not match its input
- **Claim:** `check-claims.mjs` fired `guaranteed-ranking` on the terms page's line
  "Nobody can promise a ranking, a position, an amount of traffic or a number of customers", which is
  the OPPOSITE of a ranking promise and is the sentence that page exists to contain.
- **Why it is not a nuisance:** a guard that fails the build on the sentence you want gets edited
  around rather than obeyed, and then it is not a guard. This repository's corpus loader carries the
  same rule for the same reason, in a comment written hours earlier: a guard's false-positive
  behaviour is a correctness property of the guard.
- **The first fix was wrong, and the reason is the useful part.** I added a negation check that looked
  at the current LINE before the match. It still failed. The sentence WRAPS: "Nobody can" ends line
  130 and "promise a ranking" begins line 131, so a line-based scanner over wrapped prose cannot see
  a negation that fell onto the previous line. **The granularity of the check did not match the
  granularity of its input.** Prose wraps; sentences do not respect line boundaries.
- **Evidence:** `sed -n '128,133p'` shows the wrap directly. With one line of context the guard still
  failed; with two lines of lookback plus sentence-boundary detection it passes, and four
  discriminating cases were run by command:
  | case | expected | result |
  |---|---|---|
  | wrapped disclaimer, "Nobody can / promise a ranking" | pass | pass |
  | unnegated promise on one line | FIRE | fired |
  | unnegated promise wrapped across two lines | FIRE | fired |
  | negation in the PREVIOUS sentence, promise in this one | FIRE | fired |
  That last one matters most: a negation one sentence earlier must not excuse a real claim, or any
  promise can hide behind an unrelated disclaimer.
- **Confidence:** high (all four cases run, each reverted).
- **Status:** FIXED. Two lines of lookback, sentence-bounded, with the limit written into the code:
  a negation more than two lines before its claim is still invisible, and if that ever bites the
  answer is to widen the lookback rather than exempt the file.
- **Next time:** when a text check fires on prose you believe is correct, the first question is not
  "how do I exempt this" but **"does my check operate on the same unit as the thing it is checking"**.
  A line-based scanner reading wrapped sentences is a unit mismatch, and a unit mismatch produces
  false positives that look like a taste disagreement and get resolved by weakening the check. And a
  negation check must be sentence-scoped in both directions: too narrow and it misses the disclaimer,
  too wide and it excuses the claim.

### P-12 · 2026-09-10 · The signing-boundary gate walked three files out of eight and reported the graph clean, because a multi-line import was invisible to it
- **Claim:** `scripts/check-licence-boundary.mjs` finally got a real entry point to walk, and on its
  first honest run it printed `walked 3 file(s) from 1 shipping entry point(s);
  licence/issue.mjs is unreachable`. The real graph is EIGHT files. It had examined a fraction of it
  and reported success.
- **Evidence, measured:** `mcp/bin.mjs` has two local imports. The gate's pattern used `[^
;]*?`
  between `import` and `from`, so it could only match a SINGLE-LINE import, and this was invisible:
  ```
  import {
    listAgents,
    getBrief,
  } from "./tools.mjs";
  ```
  Run directly against the gate's own regex, it reported seeing `["../licence/roster.mjs"]` and
  nothing else. `./tools.mjs` is the file that imports the corpus, the report engine and the DOM
  adapter, so missing that one edge hid five files. After the fix: eight files walked.
- **Why it is the worst kind of pass:** multi-line imports are the ORDINARY style for several named
  imports, so the blind spot sat exactly where real code lives. Anybody adding
  `import { issue } from "../licence/issue.mjs"` as part of a multi-line clause in a shipped file
  would have been told the signing path was unreachable. This is the gate that protects the key that
  mints licences.
- **The fix that matters more than the regex.** `[^;]*?` allows newlines and still cannot cross a
  statement boundary, and it errs toward finding MORE edges, which is the safe direction for a
  reachability check. But the regex will be wrong again some day, so the gate now carries a
  COMPLETENESS CHECK: a second, cruder, independent count of local specifiers, every occurrence of
  `from "."`, which cannot be fooled by statement shape because it does not parse statements. If the
  parser finds fewer than the crude count, the gate FAILS and says the reachability claim is
  untrustworthy rather than reporting a smaller graph. Two measures of one quantity, neither derived
  from the other.
- **Mutations, each run:** a multi-line import of the signing path in a shipped file (RED, the exact
  hole), a single-line one (RED), and reverting the pattern to the single-line version (RED via the
  completeness check, naming `mcp/bin.mjs` and the 1-versus-2 discrepancy).
- **A false positive the completeness check produced first, worth its own line.** It fired on the
  gate's own source, because the comment explaining the bug contains an EXAMPLE multi-line import.
  Both measures are about code, so both now strip comments first. **A check that cannot tell an
  example from the thing it exemplifies will always fire first on the file that documents it**, and
  this happened three times in one session: here, on the apply form's placeholder address, and on
  the welcome page's install line.
- **Confidence:** high (the 3-versus-8 count, the regex output, and three mutations all measured).
- **Status:** FIXED.
- **Next time:** when a gate reports a denominator, ask whether that denominator is PLAUSIBLE before
  believing the verdict attached to it. Three files from an entry point that imports two modules
  which import five more is not plausible, and noticing that took one look at the number. The
  general rule this house already has, stated one level up: **give every gate a second, cruder,
  independent measure of the thing it counts.** A sophisticated parser and a dumb string count
  disagreeing is the cheapest possible blind-spot detector.

### P-13 · 2026-09-10 · Ten prompts through a real MCP client found two defects that reading the code had not
- **Claim:** the server was built, unit tested and committed. Driving it as a customer would, over
  stdio through a real MCP client, found two things immediately that no test had.
- **Evidence, and the second one is the interesting defect:**
  1. **Raw markdown reaching a paying customer.** The roster is parsed out of a markdown document
     and a blurb goes straight out through `list_agents` and through every department prompt. Three
     of sixty-two carried emphasis, so a real client displayed
     `pass, fail or **skipped, with a denominator for each**`. Fixed at the boundary rather than by
     editing the three lines, because the plan is markdown by design and the next person to write a
     seat will use emphasis again. Mutation: remove the sanitiser, RED, naming the test.
  2. **My own verify_fix test was invalid, and it looked like a pass.** I copied the bad fixture,
     tried to edit the copy with Python using a `/c/Users/...` path, and Windows Python cannot
     resolve that form. The copy was byte-identical, so `verify_fix` correctly reported
     "0 resolved, 9 still firing". Real behaviour, wrong test, and the output looked like a
     considered result rather than a mistake. Redone with node writing the file: the edit landed,
     and the tool then reported `regression: true`.
- **What the corrected run demonstrated, which is the part worth keeping.** I fixed four findings and
  broke ONE thing on purpose (a second h1). `verify_fix` reported three appearances, not one: the
  deliberate `h1-multiple`, and `title-truncates`, because the title I wrote as a FIX is over sixty
  characters. **The tool caught a real mistake in my own fix that I had not noticed**, and it stated
  the regression before the six things that were resolved.
- **Confidence:** high (ten prompts run against a live stdio server, every result read).
- **Status:** FIXED both. 81 tests green afterwards.
- **Next time:** two rules.
  First, **drive a finished component as its user before believing it is finished.** Unit tests
  answered every question I thought to ask; the markdown leak was invisible to all of them because
  no test rendered a blurb the way a client does.
  Second, and this is the one that generalises: **when a test harness reports a clean result, check
  that the harness actually changed what it claimed to change.** A silent no-op in a fixture setup
  produces output indistinguishable from a real pass. The cheap habit is to assert the edit landed,
  in the same breath as making it, which is the same rule this house already has for mutations.

