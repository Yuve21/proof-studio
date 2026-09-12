# The agent roster: 60 seats, and the mechanism that makes them worth hiring

Status: PLAN, 2026-09-09. Nothing here is built yet. Written before the code so the count is
argued rather than assumed.

This is the plan for the capability Proof sells: bundled into a finished site, and licensed monthly
to organisations that already have one. It is built on the deterministic foundation in
`Yuve21/slop-scorer` and it is a SEPARATE product from that detector.

---

## The thing to get right before counting seats

**An agent brief without a corpus behind it is a prompt.** Sixty prompts is a menu, not a team.

This matters more here than anywhere, because the sibling product exists to detect exactly this
failure: a thing that reports success without doing its job. Shipping sixty confident job titles
over no accumulated knowledge would be that defect, sold as a feature, by the company that sells
its detection.

What makes a senior hire worth the salary is three things, and only two of them can be shipped:

| What a senior hire has | Can we ship it on day one? |
|---|---|
| Domain knowledge (how SEO actually works) | **Yes.** Written down as cited, versioned rules. |
| Judgement about what NOT to do | **Partly.** Every rule carries the case where it is wrong. |
| Knowledge of YOUR business | **No.** It accumulates, per client, from real runs. |

So the honest sales sentence is about the first two plus the mechanism for the third. Claiming the
third on day one is the *In re Workado* shape: a capability claim with no substantiation behind it.

**Consequence for the roster: a seat ships when its corpus exists, not when its brief is written.**
The count below is the destination. The tiers are the order.

---

## The 60 seats

Eight departments. Every seat names WHY it exists as a separate seat, because a seat that cannot
justify its own existence against its neighbours is a seat that produces activity instead of work.

Each is marked:

- **[D] deterministic**, backed by rules-as-data and a checker. Its findings cite a locator a
  stranger can re-read, and it can abstain. These are the seats we can make claims about.
- **[A] advisory**, model judgement over a written playbook. Useful, and NOT something to attach a
  measurement to.

### A. Found (9), being discovered

1. **seo-technical** [D] crawlability, indexation, robots and sitemap agreement, canonicals, status codes, redirect chains.
2. **seo-onpage** [D] titles, meta descriptions, heading order, internal link graph, orphan pages.
3. **seo-local** [A] business profile completeness, name/address/phone consistency across citations, map pack position. Separate from seo-onpage because its inputs live OFF the site.
4. **seo-structured-data** [D] schema.org validity and rich-result eligibility. Separate because it is a published vocabulary owned by somebody else, and a vendored vocabulary compared in both directions is a different job from a regex.
5. **seo-content** [A] search intent coverage, cannibalisation, thin pages.
6. **seo-performance** [D] Core Web Vitals as a ranking input specifically, not as craft.
7. **seo-competitive** [A] who ranks for the client's terms and what they have that the client does not.
8. **seo-reporting** [D] what moved and what did not, with the denominator. Exists to stop the department grading its own homework.
9. **measurement** [D] whether the numbers exist at all: is analytics installed and firing, is the search console verified, does the consent state match what the privacy policy claims. Separate from seo-reporting because a report with no denominator is this house's named defect, and somebody has to own the denominator itself.

### B. Craft (10), the site itself

10. **web-craft** [A] visual and motion quality, hands on in a real browser.
11. **accessibility** [D] contrast, focus order, labels, landmarks, keyboard path.
12. **performance-engineer** [D] LCP, INP, CLS, bundle weight, image and font strategy.
13. **mobile-experience** [D] the phone version, because that is where the customer is standing.
14. **copy-reviewer** [A] voice, clarity, reading level, jargon.
15. **conversion-auditor** [A] the path to the one action, and the friction on it.
16. **forms-and-capture** [D] validation, error states, completion, and whether the submission actually arrives.
17. **broken-things** [D] the things that are already broken in the bytes that shipped: a page reading `Welcome, undefined`, an unrendered `{{ business.name }}`, a logo whose src is a path on somebody's Desktop, a checkout link pointing at `localhost:3000`, a link jumping to a section that is not on the page, an empty `mailto:`. Twelve rules, all offline, all certain rather than inferred. **The half that needs a network is NOT here and cannot be:** whether a link resolves, what status code it returns, whether an image exists at its URL. That half can only ever run on our side, and the seat is honest about owning half a job rather than claiming the whole one.
18. **domain-and-certificates** [D] domain expiry, DNS agreement with what the site expects, and certificate notAfter. Exists because the marketing page promises "we buy it, point it, secure it and renew it", a lapsed domain is the most catastrophic thing that happens to a small business site, it is a DATE somebody can read, and no other seat owns it. It is the failure the monthly fee is implicitly insuring against.
19. **template-tells** [D] the tells that say a site was made from a template and nobody finished it: a title still reading Create Next App, lorem ipsum, a footer icon row linking to the front page of Instagram, a copyright year four years old, a bare platform subdomain. Ten rules. Customer-facing name: Proof Check.

    **CORRECTED 2026-09-10, and the correction matters because the old number was published.** This seat was described as "the slop-scorer corpus itself, 104 rules". Counted: the sibling product's web corpus has 51 rules, not 104, and 30 of those need a real browser (computed styles, loaded font faces, animation timing) or a screenshot with OCR. The installed side has a parser, which is what makes the no-egress promise possible, so those 30 can never ship in it. A further group is deliberately not ported for a design reason rather than a technical one: slop-scorer produces a SCORE, so it can carry weak signals like uniform feature cards or an arrow in a call to action, none of which mean anything alone. Proof produces findings that each cite a line, and "three of your cards have the same shape" is not something anybody should change. If Proof ever grows an aggregate, that is the moment to revisit it.

### C. Money (7), commerce

20. **checkout-auditor** [D] every step from cart to receipt, including the failure paths.
21. **pricing-analyst** [A] price points, tiers, anchoring, what the market bears.
22. **product-catalog** [D] titles, descriptions, images, variants, missing fields.
23. **inventory-and-fulfilment** [A] stock, shipping, packaging, delivery promises.
24. **payments-and-fees** [D] processor fees, failed payment recovery, currency and tax setup.
25. **subscription-and-retention** [A] churn, dunning, win-back.
26. **refunds-and-disputes** [D] policy clarity, chargeback exposure, the wording that prevents both.

### D. Reach (14), marketing

27. **content-strategist** [A] what to make, in what order, for whom.
28. **content-writer** [A] the draft itself.
29. **social-media-manager** [A] platform strategy and calendar.
30. **social-publisher** [D] the mechanical act: format, aspect ratio, caption limits, link handling, scheduling. Separate from the manager because a strategy failure and a publish failure need different fixes.
31. **email-lifecycle** [A] welcome, nurture, win-back, seasonal.
32. **email-deliverability** [D] SPF, DKIM, DMARC alignment, warmup, list hygiene, spam-trigger scan. Separate and deterministic because deliverability is a set of records that either align or do not.
33. **paid-ads-auditor** [A] spend, targeting, creative, landing page match.
34. **review-and-reputation** [A] review volume and response, and the response wording.
35. **brand-voice-keeper** [D] consistency against a written voice spec, across every surface.
36. **photography-director** [A] the shot list and the brief, because a small business's biggest visual win is usually better photos of what it already has.
37. **video-and-reels** [A] short-form format and hook structure.
38. **newsletter** [A] the recurring send, which is a different discipline from lifecycle email.
39. **partnerships-and-local** [A] neighbouring businesses, markets, events.
40. **seasonal-calendar** [D] the dated obligations a business forgets: seasons, holidays, market schedules, renewal dates.

### E. Customers (5), service

41. **support-agent** [A] answers the questions the business answers by hand fifty times a week.
42. **inbox-triage** [A] what needs a human, what does not, what is on fire.
43. **booking-and-reservations** [D] the booking path and its failure modes.
44. **feedback-analyst** [A] what customers keep saying, ranked.
45. **loyalty-and-repeat** [A] the second purchase, which is cheaper than the first.

### F. Business (7), the operator's side

46. **bookkeeping-reviewer** [D] categorisation, reconciliation, missing receipts.
47. **margin-analyst** [D] unit economics per product, with the arithmetic shown.
48. **cashflow** [D] runway, timing, seasonality.
49. **supplier-and-cost** [A] input costs and alternatives.
50. **hiring-and-roles** [A] what to hire, when, and what to write in the posting.
51. **compliance-calendar** [D] licences, permits, filings, renewals, with dates.
52. **insurance-and-risk** [A] what is uninsured that should not be.

### G. Trust (5), the legal surface

53. **claims-officer** [D] every claim the business publishes about itself, against what it can substantiate. The most important seat in this department and the reason the department exists. Ports directly from slop-scorer, where it exists because *In re Workado* was lost on what was published rather than on what was built.
54. **privacy-steward** [D] what the site collects, what the policy says, and whether those two agree.
55. **terms-and-policies** [A] the documents, read as documents.
56. **accessibility-legal** [D] ADA and WCAG exposure specifically, which is a different question from whether the site is usable.
57. **contracts-reviewer** [A] the agreements the business signs and sends.

### H. Governance (5), the seats that keep the other 55 honest

These are not overhead. They are the reason a customer should believe any of the above, and every
one of them exists because this house has already shipped the defect it catches.

58. **improvement-agent** [A] the generalist recommender. Point it at anything and it returns ranked "instead of X, do Y, because Z". Its cardinal rule is verify current state before recommending, because a recommendation to build a thing that already exists is worse than no recommendation.
59. **false-positive-hunter** [D] tries to make every corpus fire on legitimate work. **Mandatory second reviewer on every rule promotion**, because a rule's author is the worst judge of its false-positive surface.
60. **vacuous-check-hunter** [D] hunts guarantees that report success without doing their job: checks never called, verifications comparing a value to itself, tests certifying silence, denominators drawn from their own subject.
61. **corpus-steward** [D] owns every rule, its weight and its published false-positive note, line by line, to a customer who disagrees with it.
62. **release-verifier** [D] runs every gate and reports pass, fail or **skipped, with a denominator for each**. Exists because a gate that scanned zero things and printed PASS is the failure this whole product is against.

**Count: 9 + 10 + 7 + 14 + 5 + 7 + 5 + 5 = 62. 33 deterministic, 29 advisory.**
(Counted mechanically off the [D] and [A] markers above, not asserted. A count that only agrees
with the sentence that states it is not a count.)

---

## What the customer sees is EIGHT, not sixty

Settled 2026-09-09 on outside evidence rather than taste.

A carousel titled "I built an AI content team" (`ibraviz.ai`, 2026-08-13) took **8,400 likes and 301
shares** describing **seven** agents with one-word names, with Claude Code framed as "the office".
Seven. The improvement pass reached the same conclusion from a different direction, that "sixty
seats is a frightening menu for a food stand" and that the governance seats are Proof's rather than
the client's.

So the roster stays at 62 as the INTERNAL org chart, and the customer-facing unit is the
**department**. Eight departments, each named for what it gets them, is almost exactly the shape that
demonstrably performs, and it is the honest shape too: a client hires a capability, not a headcount.

Two consequences that are not cosmetic:

- **Four seats never appear on a customer surface at all.** `false-positive-hunter`,
  `vacuous-check-hunter`, `corpus-steward` and `release-verifier` audit OUR corpus and OUR gates.
  They are the reason a client should believe any finding, and they are not seats the client
  operates. `licence/roster.mjs` carries them in `INTERNAL_SEATS` and a test asserts every one is a
  real seat, so the list cannot rot into naming something that does not exist.
- **The count is never the pitch.** "Sixty AI agents" is the crowded position and it invites the one
  question we cannot answer well yet, which is what each of them knows. The differentiator is the
  published rule with its false-positive note and a receipt a stranger can re-derive. Nobody else
  selling an agent team can say that sentence, and it is true today.

## Deliberately NOT on the roster

Named so nobody re-proposes them without an argument:

- **A general "marketing agent".** Its job is split across department D with sharper briefs. A generalist would duplicate fourteen specialists and be worse than all of them.
- **A chief-of-staff or orchestrator.** With a customer who has one owner, a coordinator layer is overhead. `improvement-agent` covers "look at everything".
- **A "growth hacker" seat.** Not a discipline, a vibe. Whatever it would do is already owned by seo-competitive, conversion-auditor or paid-ads-auditor.
- **Anything with "AI" in its customer-facing name.** House rule, and it is the crowded position.
- **A seat per social platform.** Platform differences are DATA (aspect ratios, caption limits, link handling) and belong in social-publisher's corpus, not in ten near-identical briefs. Ten seats that differ by a constant is the same defect as a list written twice.

---

## Shipping order, because 60 empty seats is worse than 11 full ones

**Tier 1, ships with the first paying site (12 seats).** Every one deterministic: template-tells,
seo-technical, seo-onpage, seo-structured-data, accessibility, performance-engineer,
mobile-experience, broken-things, forms-and-capture, domain-and-certificates, claims-officer,
release-verifier.

**ELEVEN OF THOSE TWELVE SEATS ARE CUSTOMER-FACING.** The twelfth,
`release-verifier`, is one of the four INTERNAL seats in `licence/roster.mjs` and never ships to a
customer at all. It is not a rulebook and was nearly built as one: it is a program,
`scripts/release-verify.mjs`, that runs every gate in this repository and reports pass, fail or
skipped with a denominator for each. Counting it among the seats that need a corpus overstated the
work remaining by one for several days.

**FIRST TIER-2 SEAT SHIPPED, 2026-09-11: `measurement`, 7 rules.** It went before the six that
sound more commercial for a reason worth recording. Every reporting seat in this plan produces a
number, `seo-reporting` exists "to stop the department grading its own homework", and nothing had
checked that the homework was being recorded. This seat owns the denominator itself. It is also
fully offline-decidable, which most of the Money department is not: a checkout audit needs a live
checkout, and the installed side makes no requests.

**EIGHT OF THE ELEVEN CUSTOMER-FACING TIER-1 SEATS HAVE A RULEBOOK TODAY** (2026-09-10):
`accessibility` with 13 rules, `broken-things` with 12, `seo-technical` with 11, `seo-onpage` with
10, `template-tells` with 10, `seo-structured-data` with 9, `claims-officer` with 8, and
`forms-and-capture` with 6. The other three are registered as prompts and reported to the customer
as **brief-only**, which the MCP server states in `list_agents`, in `get_brief` and in the prompt
body: it can advise, and it cannot produce a citation. That is the honest state and it is published
rather than implied, because a department that appears in a list and cannot do the thing the list
implies is the defect this product exists to detect.

**ALL THREE of the remaining seats are blocked rather than merely unbuilt**, which means tier 1 is
COMPLETE for everything that can run offline, and the reason each is blocked matters:
`domain-and-certificates` needs a network request, which the installed software must never make, so
it can only ever run on OUR side; and `performance-engineer` and `mobile-experience` need rendering
and computed styles, which a parser does not have. None of the three is waiting on effort. Each is
waiting on a capability the installed side does not have by design.

That tier alone is a defensible product. It is "your finished site, checked against a published
rulebook, every finding citing a line you can go and read, and it abstains when it cannot tell".
Nobody selling to small business says that today.

**Tier 2, by the first monthly renewals (15).** seo-local, seo-content, seo-performance,
seo-reporting, measurement, web-craft, copy-reviewer, conversion-auditor, brand-voice-keeper,
email-deliverability, seasonal-calendar, privacy-steward, improvement-agent, false-positive-hunter,
corpus-steward.

Note the last three are governance. They ship in tier 2, not tier 5, because the moment a corpus
starts growing it needs a steward and an adversary.

**Tier 3, commerce clients (7).** All of department C, when the first client buys the ecommerce tier.

**Tier 4, the monthly licence for larger organisations (16).** Reach and Customers, where a business
with staff has somebody to hand the output to.

**Tier 5, the rest (12).** All of Business (7), the remainder of Trust (terms-and-policies,
accessibility-legal, contracts-reviewer), plus the two strays that belong nowhere earlier:
seo-competitive and vacuous-check-hunter. Business and Trust land last because they need real
financial and legal data, and therefore real consent and real care.

Tiers sum to 12 + 15 + 7 + 16 + 12 = 62, checked against the roster above rather than against this
sentence.

---

## How every seat gets made senior, and where the honesty line is

Six mechanisms. Five are proven in the sibling products. The sixth does not exist in either of them
yet, and it is the one that turns "we optimised the agents" from a feeling into a claim.

### 1. A brief contract, enforced by a ratchet and not by hope

Every brief opens by reading the house knowledge and the accumulated learnings, and closes by
requiring an append when a run teaches something. A script fails the build when a brief loses
either half. Both sibling products already do this: slop-scorer with `check-agent-roster.mjs` over
14 briefs and 20 entries, Lark with `npm run agents:check` over 37 briefs and 142 entries.

Without the ratchet the write half quietly disappears, and the roster stops learning while
continuing to look identical.

### 2. Rules as data, with a mandatory published false-positive note

Nothing that decides how much a finding MATTERS may be code. Weight, severity, family, rationale,
the false-positive note and the version it entered are fields. That makes every corpus publishable,
auditable, disputable and versionable without shipping a new engine.

**The false-positive note is the field that makes an agent read as senior.** It is the published
condition under which the rule is WRONG, it is refused at load time if it is empty or vague, and it
travels attached to every fix the rule proposes. "May occasionally be wrong" is not a note. Naming
the legitimate business that trips the rule is.

A junior tells you what is wrong. A senior tells you what is wrong, and when they would be wrong
about it, before you ask.

### 3. Vendored domain knowledge, compared in both directions

When the input's vocabulary is published by somebody else (schema.org types, WCAG criteria, DMARC
policy values, Core Web Vitals thresholds), vendor their list as DATA in its own file and compare it
against ours in BOTH directions: the terms we cannot express, and the terms we express that they
never defined. Deriving one list from the other makes the check a mirror.

This is the mechanism that turns "the SEO agent knows SEO" into something checkable. It has already
paid for itself once in the sibling product, where a hand-written enumeration could express 5 of 20
published concepts and nobody knew until the two lists were counted against each other.

### 4. A per-client learnings file with an evidence bar

Each client gets their own accumulating record, and an entry without evidence is not a learning.
Required: the date, a one-sentence falsifiable claim, the EVIDENCE (a locator, a measured number, a
command that ran), a confidence, a status, and what to do differently next time. No evidence means
it is labelled a hypothesis.

**This is the only mechanism that produces "knows YOUR business", and it takes real time.** It is
also the honest answer to "years of experience": the years are the file.

### 5. Abstention as a first-class status, and an adversarial second reviewer

An agent that says "I could not read enough of this to tell you" is worth more than one that
guesses, because the guess is unfalsifiable and the abstention is actionable. Low coverage withholds
the finding rather than reporting a weak one, and what the roster CANNOT see gets published rather
than hidden.

And no rule enters any corpus on its author's review alone. `false-positive-hunter` runs against it
adversarially and its report is part of the record.

### 6. Per-seat evals, which do not exist yet and are the gap

Mechanisms 1 to 5 make an agent *disciplined*. None of them prove it got *better*.

For the 31 deterministic seats there is a real answer, and it is the sibling product's backtest: a
labelled corpus, run on every change, that fails when legitimate work moves up a band or a known
positive falls one.

For the 29 advisory seats there is no answer yet, and this needs saying plainly rather than being
absorbed into a roadmap: **without a graded task set per seat, "we optimised the agents" is
unmeasured.** Building those sets is a real project, roughly a week per department done properly,
and it is the difference between a claim and an adjective.

Two warnings inherited from the sibling product, both learned expensively:

- A regression gate is not a measurement instrument. The detector's own backtest cannot produce a
  per-rule false-positive rate, because every calibration member is constructed. Do not publish an
  accuracy number the harness cannot re-derive on demand.
- Every new check gets mutation-tested in the same commit, and the mutation must NAME the gate that
  is supposed to catch it. A check nobody has watched fail is a decoration.

---

## Open questions for the founder

1. **Whose knowledge?** Domain corpora for 31 deterministic seats is the single largest cost in this
   plan. Written by hand it is months. The vendored-vocabulary route (schema.org, WCAG, DMARC, Core
   Web Vitals) covers maybe a third of it cheaply and honestly.
2. **Per-client learnings live where?** They are the client's business knowledge. Their machine, our
   database, or their repo changes the privacy posture, the sales pitch and the exit story.
3. **What does a client see?** Sixty seats is a frightening menu for a food stand. The likely answer
   is that the customer sees outcomes, and the roster is our implementation detail surfaced only to
   the organisations buying the monthly licence.
4. **Advisory seats and the claims surface.** 29 of 60 are model judgement. The sales page must not
   describe those the way it describes the deterministic ones, and `claims-officer` should be pointed
   at our own marketing before any client's.
