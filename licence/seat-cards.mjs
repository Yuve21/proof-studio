/**
 * The seat card: the fields a roster entry must declare before it is a seat.
 *
 * WHY THIS FILE EXISTS. `loadRoster()` parses a seat's id, kind and one-line
 * blurb out of the plan. That is enough to REGISTER an agent and not nearly
 * enough to run one well. Four things were nowhere in the repository:
 *
 *   1. What a seat READS from another seat, so sixty seats stop re-deriving the
 *      same inputs on every run. Re-derivation is half of what looks like an
 *      agent looping.
 *   2. What autonomy it runs at, which is a DIFFERENT axis from deterministic
 *      vs advisory. A deterministic seat can still need approval before anything
 *      reaches a customer; an advisory seat can run unattended because its
 *      output is only ever a draft. The plan marks one axis and the roster
 *      inherited the conflation.
 *   3. What STOPS it. A seat with no declared stopping condition does not stop:
 *      findings become work, work becomes surface, surface produces findings.
 *      That is not misbehaviour, it is a missing field, and the sibling
 *      product's daily auditor is the proof — it is instructed that a run "never
 *      comes back empty", so an unbounded backlog is the CORRECT output of the
 *      brief it was given.
 *   4. What it replaces, in money. A seat that cannot write that sentence is a
 *      seat that produces activity.
 *
 * Shape borrowed, with attribution, from two published systems read frame by
 * frame rather than from their captions (see docs/AGENT-SEAT-SPEC.md):
 * SkillTree's node card (builds-on / breaks-into / the ladder / the human /
 * what it replaces / build notes) and Structure Networks' "what interrupts the
 * loop" panel. Neither is copied; both were doing the thing this roster was not.
 *
 * WHAT IS DELIBERATELY NOT A FIELD HERE:
 *
 *   `status` is NOT stored. A seat is ready when its corpus exists, and
 *   `AGENTS_WITH_CORPUS` in mcp/tools.mjs already derives that from the corpora
 *   that actually load. A stored status is a second hand-maintained list with
 *   nothing comparing it to the first, which is the defect class this house
 *   exists to detect.
 *
 *   Rule COUNTS are not here either. They are published elsewhere and go stale;
 *   `scripts/check-plan-claims.mjs` already owns that argument.
 *
 * A CARD IS EARNED BY A CORPUS, NOT BY A TIER. A card for a seat that cannot run
 * yet is a promise, so cards started as tier 1 only. `measurement` is tier 2 and
 * has one, because its rulebook exists and the MCP server loads it. The gate was
 * always the corpus.
 */

/**
 * Interrupt kinds, all four required on every card.
 *
 *   budget   — the hard cap on work in one run
 *   ceiling  — what it returns vs what it suppresses, and the fact that it says
 *              the suppressed count out loud. A seat that returns everything it
 *              found has delegated triage to the reader.
 *   handback — the named condition that ends the run and returns to a human
 *   expiry   — how long a finding stays true, because a live-state claim goes
 *              stale and a stale finding read as current is a wrong finding
 */
export const INTERRUPT_KINDS = ["budget", "ceiling", "handback", "expiry"];

export const LADDER_RUNGS = ["humanLed", "humanAssisted", "fullyAutonomous"];

export const REQUIRED_FIELDS = [
  "atAGlance", "buildsOn", "reuses", "ladder", "theHuman",
  "interrupts", "whatItReplaces", "needs", "buildNotes", "howToRun",
];

/**
 * Phrases that make a field decorative. Refused at test time rather than at
 * load, so a vague card fails a build instead of reaching a customer.
 *
 * This mirrors the corpus rule that a false-positive note reading "may
 * occasionally be wrong" is not a note.
 */
export const VAGUE = [
  /\bas (needed|appropriate|required)\b/i,
  /\bwhen (necessary|appropriate)\b/i,
  /\bmay occasionally\b/i,
  /\bvarious\b/i,
  /\bet cetera\b|\betc\.?$/i,
  /\bTBD\b|\bTODO\b/i,
  /\bbest practices\b/i,
];

/** Every card reads the client's knowledge folder by the same convention. */
export const KNOWLEDGE_CONVENTION = {
  files: ["knowledge/company.md", "knowledge/offer.md", "knowledge/voice.md"],
  /*
   * THE NEVER-BLOCK RULE. If the folder is absent the seat asks two or three
   * questions and proceeds. It never stops on a missing file.
   *
   * Plus one rule the sources do not have, because this house sells abstention:
   * a seat names which of its findings DEPEND on that folder, and withholds
   * exactly those when it is missing rather than guessing at them.
   */
  onMissing: "ask two or three questions, proceed, and withhold only the findings that depend on it",
};

/** @type {Record<string, object>} */
export const SEAT_CARDS = {
  "template-tells": {
    atAGlance: "Finds the marks that say a site was made from a template and nobody finished it.",
    buildsOn: [],
    breaksInto: [],
    reuses: "report/run.mjs parse of the built HTML, shared with every offline seat in the same run",
    ladder: {
      humanLed: "Somebody opens the site and notices the footer still links to instagram.com.",
      humanAssisted: "The rulebook lists every tell with the line it sits on; a person decides which are intentional.",
      fullyAutonomous: "Runs on every build and fails the publish gate on a tell that no client has waived.",
    },
    theHuman: "A person waives a tell per client and owns that waiver; nothing is auto-waived.",
    interrupts: {
      budget: "One pass over the built HTML of each page. No second pass.",
      ceiling: "At most 40 tells, ranked by severity, with the suppressed count stated. The rulebook is small enough that a page reaching that ceiling is a page in trouble rather than a page being triaged; it also reports the page count it could not parse.",
      handback: "Stops and hands back when the parser cannot read a chunk, rather than reporting the page clean.",
      expiry: "Findings are true for the bytes that were scanned. Any rebuild invalidates them.",
    },
    whatItReplaces: "The senior review pass an agency bills at $150/hr and skips when the deadline moves.",
    needs: [{ name: "built HTML on disk", required: true }],
    buildNotes: "A tell must be CERTAIN, not suggestive. 'Three cards share a shape' is a score signal and belongs in the sibling detector, not in a finding that cites a line and asks somebody to change it.",
    howToRun: 'run_check with { agent: "template-tells", file: "<path to a built .html file>" }',
  },

  "broken-things": {
    atAGlance: "Finds what is already broken in the bytes that shipped.",
    buildsOn: [],
    breaksInto: [],
    reuses: "the same parsed DOM as template-tells; it does not re-read the file",
    ladder: {
      humanLed: "A customer emails to say the page says 'Welcome, undefined'.",
      humanAssisted: "Every offline breakage cited to a line, with the network half named as not checked.",
      fullyAutonomous: "Blocks a publish on any certain breakage; the network half still cannot run here.",
    },
    theHuman: "A person owns the half this seat cannot see, because that half requires a request the installed software must never make.",
    interrupts: {
      budget: "One pass per page over the offline rules only.",
      ceiling: "At most 40 breakages, ranked by severity, with the suppressed count stated, and always the plain statement that link resolution, status codes and image existence were NOT checked.",
      handback: "Hands back the moment a rule would need a network request to decide.",
      expiry: "Valid for the scanned bytes only.",
    },
    whatItReplaces: "The QA pass nobody does on a small-business site, and the support ticket it turns into three weeks later.",
    needs: [{ name: "built HTML on disk", required: true }],
    buildNotes: "This seat owns HALF a job on purpose. Claiming the whole one is the exact defect the product detects, so the abstention has to be in the OUTPUT, not just in the docs.",
    howToRun: 'run_check with { agent: "broken-things", file: "<path to a built .html file>" }',
  },

  accessibility: {
    atAGlance: "Checks contrast, focus order, labels, landmarks and the keyboard path.",
    buildsOn: [],
    breaksInto: [],
    reuses: "the vendored WCAG criteria list, compared against our rules in both directions",
    ladder: {
      humanLed: "Nobody tabs through the site before it ships.",
      humanAssisted: "Every violation cited to an element, with the criterion it fails.",
      fullyAutonomous: "Fails the publish gate on anything a parser can decide; the rest is flagged for a person in a browser.",
    },
    theHuman: "A person walks the keyboard path once per site. No parser can tell whether the focus order makes sense to somebody using it.",
    interrupts: {
      budget: "One pass per page.",
      ceiling: "At most 40 violations, ranked by severity, with the suppressed count stated, grouped by criterion, and naming the criteria it cannot evaluate offline.",
      handback: "Withholds rather than reports clean when coverage of the page is too low to tell.",
      expiry: "Valid for the scanned bytes.",
    },
    whatItReplaces: "A $2-5k accessibility audit that arrives as a PDF once and is never re-run.",
    needs: [{ name: "built HTML on disk", required: true }, { name: "computed styles", required: false, degradesTo: "contrast rules that need rendering abstain and say so" }],
    buildNotes: "Vendor the criteria as DATA and compare both directions: the criteria we cannot express, and the rules we express that WCAG never defined. A hand-written enumeration covered 5 of 20 published concepts in the sibling product and nobody knew until the lists were counted against each other.",
    howToRun: 'run_check with { agent: "accessibility", file: "<path to a built .html file>" }',
  },

  "seo-technical": {
    atAGlance: "Crawlability, indexation, robots and sitemap agreement, canonicals, redirect chains.",
    buildsOn: [],
    breaksInto: [],
    reuses: "the parsed head and link graph, shared with seo-onpage rather than re-derived",
    ladder: {
      humanLed: "Somebody pastes the URL into a free checker once at launch.",
      humanAssisted: "Every technical defect cited, with the one it should fix first named.",
      fullyAutonomous: "Runs each build and blocks on a noindex or a broken canonical reaching production.",
    },
    theHuman: "A person owns the decision to deindex anything. The seat never proposes removing a page from search on its own.",
    interrupts: {
      budget: "One pass over the built output. It does not crawl.",
      ceiling: "At most 25 findings, ranked by severity, with the suppressed count stated.",
      handback: "Hands back when robots.txt and the sitemap disagree in a way that has more than one legitimate reading.",
      expiry: "Live-state claims about indexation are not made here at all, because this seat cannot see a search engine.",
    },
    whatItReplaces: "The technical half of a $1-2k/month SEO retainer, which is the half that is actually checkable.",
    needs: [{ name: "built HTML and the sitemap on disk", required: true }],
    buildNotes: "Anything that requires asking Google is not this seat's job and must not be implied. The installed side makes no requests.",
    howToRun: 'run_check with { agent: "seo-technical", file: "<path to a built .html file>" }',
  },

  "seo-onpage": {
    atAGlance: "Titles, meta descriptions, heading order, the internal link graph, orphan pages.",
    buildsOn: ["seo-technical"],
    breaksInto: [],
    reuses: "seo-technical's parsed link graph; it does not rebuild it",
    ladder: {
      humanLed: "Titles are whatever the CMS defaulted to.",
      humanAssisted: "Every page's title and description assessed, with rewrites proposed and a person approving.",
      fullyAutonomous: "Proposes rewrites automatically; a person still approves before anything is written back.",
    },
    theHuman: "A person approves every piece of copy that ships. This seat never writes to the site.",
    interrupts: {
      budget: "One pass over the page set.",
      ceiling: "At most 25 findings, ranked by severity, with the suppressed count stated, and the one it would fix first named.",
      handback: "Hands back when a heading order is unusual in a way that may be a deliberate design choice.",
      expiry: "Valid for the scanned bytes.",
    },
    whatItReplaces: "The on-page half of the same retainer, done once at onboarding and then never again.",
    needs: [{ name: "built HTML on disk", required: true }, { name: "knowledge/company.md", required: false, degradesTo: "proposes structure, not wording, and says which findings it withheld" }],
    buildNotes: "Voice is the whole game for the rewrite half. With no knowledge folder this seat produces competent generic, so it withholds wording proposals rather than shipping them.",
    howToRun: 'run_check with { agent: "seo-onpage", file: "<path to a built .html file>" }',
  },

  "seo-structured-data": {
    atAGlance: "schema.org validity and rich-result eligibility.",
    buildsOn: ["seo-technical"],
    breaksInto: [],
    reuses: "the vendored schema.org vocabulary file, compared against our rules in both directions",
    ladder: {
      humanLed: "No structured data at all, or one block copied from a blog post.",
      humanAssisted: "Invalid and missing types named, with the properties that would make them eligible.",
      fullyAutonomous: "Blocks a publish on invalid markup, because invalid markup is worse than none.",
    },
    theHuman: "A person owns any claim the markup makes about the business. Structured data is a published claim and claims-officer's rules apply to it.",
    interrupts: {
      budget: "One pass per page.",
      ceiling: "At most 25 findings, ranked so validity errors come above eligibility suggestions, with the suppressed count stated.",
      handback: "Hands back on a type the vendored vocabulary does not define, rather than guessing.",
      expiry: "The vocabulary is versioned; findings name the version they were made against.",
    },
    whatItReplaces: "The specialist hour an agency bills for markup nobody on the team can read.",
    needs: [{ name: "built HTML on disk", required: true }, { name: "vendored schema.org vocabulary", required: true }],
    buildNotes: "Compare in BOTH directions or the check is a mirror: the types they publish that we cannot express, AND the types we express that they never defined.",
    howToRun: 'run_check with { agent: "seo-structured-data", file: "<path to a built .html file>" }',
  },

  "forms-and-capture": {
    atAGlance: "Validation, error states, completion, and whether the submission actually arrives.",
    buildsOn: ["accessibility"],
    breaksInto: [],
    reuses: "accessibility's label and focus findings for the same form elements",
    ladder: {
      humanLed: "Somebody submits the contact form once and assumes it still works a year later.",
      humanAssisted: "Every form's structure and error handling assessed offline, with the delivery half named as unchecked.",
      fullyAutonomous: "Blocks a publish on a form with no action, no labels or a swallowed error.",
    },
    theHuman: "A person sends one real submission per site and confirms it arrived. Nothing installed can prove delivery.",
    interrupts: {
      budget: "One pass per page.",
      ceiling: "At most 40 structural defects, ranked by severity, with the suppressed count stated, plus the standing note that delivery was not tested.",
      handback: "Hands back when a form posts to an endpoint it cannot see.",
      expiry: "Valid for the scanned bytes. Delivery is never claimed at all.",
    },
    whatItReplaces: "The lost enquiries nobody counts, because a form that silently fails produces no evidence of itself.",
    needs: [{ name: "built HTML on disk", required: true }],
    buildNotes: "A form reporting success is the canonical silent failure. The rules must treat an unverifiable submission path as unknown, never as working.",
    howToRun: 'run_check with { agent: "forms-and-capture", file: "<path to a built .html file>" }',
  },

  "claims-officer": {
    atAGlance: "Checks what the site CLAIMS against what can be substantiated.",
    buildsOn: [],
    breaksInto: [],
    reuses: "knowledge/offer.md for what the business can actually substantiate",
    ladder: {
      humanLed: "The homepage says 'the best in the city' and nobody asks who decided.",
      humanAssisted: "Every unsubstantiated claim cited, with the substantiation that would fix it.",
      fullyAutonomous: "Blocks a publish on a claim class that has burned somebody before.",
    },
    theHuman: "The business owner owns every claim on their site. This seat never rewrites one, it names it.",
    interrupts: {
      budget: "One pass per page.",
      ceiling: "At most 25 claims, ranked by exposure, with the suppressed count stated.",
      handback: "Hands back on anything that reads as a legal question rather than a copy question.",
      expiry: "A substantiated claim expires when its substantiation does; findings name the date.",
    },
    whatItReplaces: "The lawyer's read nobody buys for a small site, and the regulator letter that arrives instead.",
    needs: [{ name: "built HTML on disk", required: true }, { name: "knowledge/offer.md", required: false, degradesTo: "flags the claim and withholds the verdict on whether it is substantiable" }],
    buildNotes: "Point this at OUR marketing before any client's. A claims seat on a site making unsubstantiated claims is the In re Workado shape with our name on it.",
    howToRun: 'run_check with { agent: "claims-officer", file: "<path to a built .html file>" }',
  },

  "performance-engineer": {
    atAGlance: "LCP, INP, CLS, bundle weight, image and font strategy.",
    buildsOn: [],
    breaksInto: [],
    reuses: "nothing yet; it cannot run on the installed side",
    ladder: {
      humanLed: "Somebody runs PageSpeed once and screenshots the number.",
      humanAssisted: "Measured on our side, with the one change that moves the metric named.",
      fullyAutonomous: "Not available, and will not be until rendering runs somewhere we control.",
    },
    theHuman: "A person owns the tradeoff between a heavy hero image and a fast page. This seat states the cost, not the decision.",
    interrupts: {
      budget: "Blocked before a budget applies.",
      ceiling: "Advisory only; produces no citation and says so.",
      handback: "Hands back immediately on the installed side, because a parser has no rendering.",
      expiry: "Any measured number is live-state and expires on the next deploy.",
    },
    whatItReplaces: "A performance consultant's first afternoon, which is mostly measurement.",
    needs: [{ name: "a real browser with rendering and computed styles", required: true, degradesTo: "reported as brief-only; it advises and cannot measure" }],
    buildNotes: "BLOCKED BY CAPABILITY, NOT BY EFFORT. It needs rendering the installed parser does not have by design. Do not ship rules that pretend otherwise.",
    howToRun: "Brief-only on the installed side. Runs on ours when rendering is available.",
  },

  "mobile-experience": {
    atAGlance: "The phone version, because that is where the customer is standing.",
    buildsOn: ["accessibility", "performance-engineer"],
    breaksInto: [],
    reuses: "nothing yet; it cannot run on the installed side",
    ladder: {
      humanLed: "Somebody opens it on their own phone once.",
      humanAssisted: "Measured at real viewports on our side, with tap targets and overflow cited.",
      fullyAutonomous: "Not available until rendering runs somewhere we control.",
    },
    theHuman: "A person looks at the phone version before it ships. No parser settles whether it feels right.",
    interrupts: {
      budget: "Blocked before a budget applies.",
      ceiling: "Advisory only; produces no citation and says so.",
      handback: "Hands back immediately on the installed side.",
      expiry: "Viewport findings expire on any layout change.",
    },
    whatItReplaces: "The phone check that gets skipped, on the device most of the traffic uses.",
    needs: [{ name: "a real browser at real viewports", required: true, degradesTo: "reported as brief-only" }],
    buildNotes: "BLOCKED BY CAPABILITY. Two instruments once reported a moving element as frozen in the sibling product, so a single measurement of a rendered page is not evidence on its own.",
    howToRun: "Brief-only on the installed side.",
  },

  "domain-and-certificates": {
    atAGlance: "Domain expiry, DNS agreement with what the site expects, certificate notAfter.",
    buildsOn: [],
    breaksInto: [],
    reuses: "nothing on the installed side; every input is a network answer",
    ladder: {
      humanLed: "The renewal email goes to an address nobody reads and the domain lapses.",
      humanAssisted: "Dates read on our side and surfaced with the days remaining.",
      fullyAutonomous: "Not available on the installed side, ever, by design.",
    },
    theHuman: "A person owns the renewal. This seat is the alarm, not the payment.",
    interrupts: {
      budget: "One lookup per domain per run, on our side only.",
      ceiling: "Three dates: domain, DNS agreement, certificate. Nothing else.",
      handback: "Hands back immediately on the installed side, because it must make no request.",
      expiry: "These are DATES. The finding carries the date it was read, and it is stale the next day.",
    },
    whatItReplaces: "The catastrophic failure the monthly fee is implicitly insuring against, which is a lapsed domain.",
    needs: [{ name: "network access, on our side only", required: true, degradesTo: "absent from the installed server entirely rather than present and refusing" }],
    buildNotes: "BLOCKED BY DESIGN on the installed side. The no-egress promise is the product, so this seat can only ever run on ours. It must not appear as a tool that fails.",
    howToRun: "Runs on our side. Not registered on an installed server.",
  },

  /*
   * TIER 2, AND THE FIRST CARD OUTSIDE TIER 1. The rule in this file's header is
   * that a card for a seat that cannot run yet is a promise. `measurement` can
   * run: its rulebook exists and is loaded by the MCP server. The gate for a card
   * was never the tier, it was the corpus, so this one earns its place the same
   * way the twelve above did.
   */
  measurement: {
    atAGlance: "Checks whether the numbers a report would cite are being recorded at all.",
    buildsOn: [],
    breaksInto: [],
    reuses: "the same parsed DOM as every other offline seat in the run; it adds no pass of its own",
    ladder: {
      humanLed: "Nobody checks, and six months into a retainer the first report is built on numbers that were never collected.",
      humanAssisted: "Every wiring defect cited to the tag or the meta that causes it, with the reason a report would be empty.",
      fullyAutonomous: "Runs on every build and blocks a publish on a tag installed with a placeholder id.",
    },
    theHuman: "A person owns what the site is allowed to collect. This seat reports that collection is wired, never that it is permitted.",
    interrupts: {
      budget: "One pass per page over the scripts, the meta tags and the policy text. It does not crawl to find the policy.",
      ceiling: "At most 40 wiring defects, ranked by severity, with the suppressed count stated. The rulebook is seven rules, so reaching that ceiling means many pages rather than a noisy page; it also states the pages it did not see.",
      handback: "Hands back the moment a question needs a network request, which is every question about whether a tag actually fires.",
      expiry: "Valid for the scanned bytes. A tag injected by a platform after build voids the finding entirely.",
    },
    whatItReplaces: "The analytics audit nobody buys, and the six months of a retainer spent reporting numbers that were never being collected.",
    needs: [
      { name: "built HTML on disk", required: true },
      { name: "the privacy policy page, to compare both directions", required: false, degradesTo: "the policy comparison is skipped and the report says the policy was not seen" },
    ],
    buildNotes: "Every rule here fires on an ABSENCE, and an absence-detector that is slightly wrong flags every correctly built site at once. The clean-page test is the one that decides whether this ships, not the catching tests.",
    howToRun: 'run_check with { agent: "measurement", file: "<path to a built .html file>" }',
  },

  "release-verifier": {
    atAGlance: "Runs every gate in this repository and reports pass, fail or skipped with a denominator.",
    buildsOn: [],
    breaksInto: [],
    reuses: "scripts/release-gates.mjs, which is the single list of gates",
    ladder: {
      humanLed: "Somebody runs the tests they remember and calls it green.",
      humanAssisted: "Every gate run, with skipped counted separately from passed.",
      fullyAutonomous: "Runs on every release and blocks on a fail or an unexplained skip.",
    },
    theHuman: "A person decides whether a skip is acceptable. The seat refuses to fold a skip into a pass.",
    interrupts: {
      budget: "One full run of the gate list.",
      ceiling: "Reports all three states with a denominator for each. It never reports a bare pass count.",
      handback: "Hands back on a gate that cannot run at all, which is a different state from failing.",
      expiry: "Valid for the commit it ran against, and nothing else.",
    },
    whatItReplaces: "The release checklist that exists as a habit, and the confident green that hides the step after the one that failed.",
    needs: [{ name: "the repository", required: true }],
    buildNotes: "INTERNAL. Never appears on a customer surface. It is a program, not a rulebook, and it was nearly built as one: counting it among the seats needing a corpus overstated the remaining work by one for several days.",
    howToRun: "npm run verify",
  },
};
