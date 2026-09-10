# Learnings (what outcomes taught us)

Same contract as the sibling product: an entry carries a date, a one-sentence falsifiable claim, the
EVIDENCE (a locator, a measured number, or a command that ran), a confidence, a status, and what to
do differently. No evidence means it is labelled `HYPOTHESIS`.

Read this before adding a check. Both entries below are defects that the checks written in this
repository ALREADY HAD, found by running them rather than by reading them.

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
