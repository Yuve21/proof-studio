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
