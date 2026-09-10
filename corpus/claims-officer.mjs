/**
 * The `claims-officer` corpus: what a business says about itself, against what it
 * can actually back up.
 *
 * WHY THIS IS THE MOST VALUABLE DEPARTMENT AND THE MOST DANGEROUS ONE.
 *
 * Valuable because nobody selling websites to small businesses checks it. A
 * plumber's site saying "guaranteed same-day service" and a juice bar's saying
 * "boosts your immune system" are both ordinary marketing and both are
 * substantiation claims: the FTC's position is that an objective claim needs
 * competent evidence at the time it is made, and the trader is the one who has to
 * produce it. A studio that quietly ships those is handing a client a liability
 * with their new website.
 *
 * Dangerous because a claims checker that fires on ordinary honest copy gets
 * turned off. This project's own claims guard failed a build on the sentence
 * "Nobody can promise a ranking", which is the OPPOSITE of a promise, and a guard
 * that rejects the sentence a legal page needs is a guard somebody edits around
 * rather than obeys. So every rule here is negation-aware and sentence-scoped,
 * and that behaviour is tested in both directions.
 *
 * WHAT IT CANNOT DO, said plainly because the temptation to overstate is the
 * whole risk of this department:
 *   - It cannot tell you whether a claim is TRUE. "We have served 10,000
 *     customers" may be exactly right. It can only tell you that the claim is the
 *     kind somebody may ask you to substantiate.
 *   - It is not legal advice and no finding says otherwise. Every remedy is
 *     "either substantiate it or soften it", which is a business decision.
 *   - It reads the visible text of one page. A claim in an image, a video, a PDF
 *     or an email is invisible here.
 */

export const CORPUS_ID = "claims-officer";
export const CORPUS_VERSION = "claims-2026.09";

/** A page with no prose is not a page whose claims can be assessed. */
export const REQUIRES_SUBJECT = { key: "sentences", label: "sentence of visible text" };

export const collect = () => {
  const sel = (el) => {
    if (el.id) return `#${el.id}`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 4) {
      const tag = node.tagName.toLowerCase();
      if (tag === "body" || tag === "html") break;
      const siblings = node.parentElement
        ? Array.from(node.parentElement.children).filter((c) => c.tagName === node.tagName)
        : [];
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag);
      node = node.parentElement;
    }
    return parts.join(" > ") || el.tagName.toLowerCase();
  };

  /*
   * TEXT IS COLLECTED PER BLOCK, THEN SPLIT INTO SENTENCES, and that shape is the
   * whole reason this corpus can be trusted.
   *
   * This project's file-based claims guard read one LINE at a time, and a sentence
   * wrapped across two lines hid its own negation: "Nobody can" ended one line
   * and "promise a ranking" began the next, so the guard fired on a disclaimer.
   * The granularity of the check did not match the granularity of its input.
   *
   * A DOM does not wrap, so a block element is a natural unit and a sentence
   * inside it is the right one. Nothing here has to guess where a thought begins.
   */
  const BLOCKS = "p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,dd,dt,summary,button,a,span.claim";
  const seen = new Set();
  const sentences = [];

  for (const el of Array.from(document.querySelectorAll(BLOCKS))) {
    // Skip a block that only contains other blocks, or its text would be counted
    // twice and one finding would be reported against two selectors.
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!ownText) continue;

    const selector = sel(el);
    for (const raw of ownText.split(/(?<=[.!?])\s+/)) {
      const sentence = raw.trim();
      if (sentence.length < 4) continue;
      const key = `${selector}|${sentence}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sentences.push({ selector, text: sentence.slice(0, 400) });
    }
  }

  return {
    sentences,
    counts: {
      sentences: sentences.length,
      blocks: new Set(sentences.map((s) => s.selector)).size,
      bodyTextLength: (document.body.textContent || "").replace(/\s+/g, " ").trim().length,
    },
  };
};

/**
 * Negations that turn a claim into a DISCLAIMER.
 *
 * These run in node against plain facts, so unlike `collect` they may use module
 * scope. Sentence-scoped by construction: the collector already split on sentence
 * boundaries, so a negation two sentences earlier cannot excuse a claim here,
 * which is the failure the file-based version had to work around.
 */
const NEGATORS =
  /\b(?:no|nobody|no one|none|nothing|never|cannot|can't|do not|does not|don't|doesn't|will not|won't|is not|are not|isn't|aren't|refuse[sd]?|without|unable|neither|nor)\b/i;

/**
 * Is the claim at `index` negated by something BEFORE it in this sentence?
 *
 * POSITIONAL, AND THE FIRST VERSION WAS NOT, which produced the opposite defect
 * from the one the negation check exists to prevent.
 *
 * Testing the whole sentence for a negator suppressed
 * "This offer ends March 1, 2020, so do not wait", because "do not" appears
 * AFTER the claim as part of an urgency phrase. So a claim sentence containing
 * any negation anywhere was silently skipped, and
 * "We guarantee page one, don't miss out" would have vanished entirely.
 *
 * That is worse than the false positive it was guarding against. A claim wrongly
 * reported gets argued with and corrected; a claim silently skipped is invisible
 * and the customer believes the page was checked.
 *
 * A negation only disclaims what follows it, so only the text before the match
 * counts. This is the same rule the file-based guard arrived at, and rebuilding
 * the sentence splitting here lost it once.
 */
const negatedBefore = (sentence, index) => NEGATORS.test(sentence.slice(0, index));

/**
 * Build a detector for a set of patterns, with the negation check applied once.
 *
 * Written as a helper rather than repeated in eight rules, because the negation
 * check is the thing most likely to be forgotten in the ninth, and a rule that
 * forgets it fires on a disclaimer.
 */
const claimDetector = (patterns) => (f) =>
  f.sentences.flatMap((s) => {
    for (const re of patterns) {
      const m = s.text.match(re);
      if (m && typeof m.index === "number" && !negatedBefore(s.text, m.index)) {
        return [{ selector: s.selector, observed: `"${s.text.slice(0, 180)}"` }];
      }
    }
    return [];
  });

export const RULES = [
  {
    id: "claims.performance-figure",
    family: "substantiation",
    weight: 8,
    severity: "high",
    title: "A numeric performance claim, which somebody may ask you to prove",
    rationale:
      "A stated percentage or multiple is the most substantiable kind of claim there is, which cuts " +
      "both ways: it is persuasive precisely because it sounds measured, and if it was not measured " +
      "there is nothing to produce when asked. The FTC's consent order against an AI detection " +
      "company in 2025 turned on a single accuracy figure the company could not substantiate.",
    falsePositiveNote:
      "Wrong whenever the figure IS measured and you can show the working, which is often. A bakery " +
      "saying \"we sell 400 loaves a week\" has a till roll. What this rule cannot see is whether the " +
      "evidence exists, so read it as a question about where the number came from rather than as an " +
      "accusation. It also skips any sentence containing a negation, so a disclaimer saying you do " +
      "not claim a figure is not reported.",
    prevention:
      "Keep the number and be able to show where it came from, or replace it with something you can " +
      "demonstrate. A number with its source beside it is stronger copy anyway.",
    since: "claims-2026.09",
    detect: claimDetector([
      /\b\d{1,3}(?:\.\d+)?\s*%\s*(?:accura|effectiv|success|satisf|faster|cheaper|more|increase|improv|reduc)/i,
      /\b(?:accuracy|success rate|satisfaction rate|conversion rate)\b[^.]{0,30}\b\d{1,3}\s*%/i,
      /\b\d+(?:\.\d+)?x\s+(?:more|faster|better|higher|cheaper)\b/i,
    ]),
  },
  {
    id: "claims.guaranteed-ranking",
    family: "substantiation",
    weight: 9,
    severity: "high",
    title: "A promise about search rankings, which nobody is able to keep",
    rationale:
      "No agency controls a search engine's results, so a promise about position is a claim with no " +
      "mechanism behind it. It is also one of the most commonly complained-about promises in the " +
      "sector, which makes it a bad thing to have in writing on your own site.",
    falsePositiveNote:
      "Skips any sentence containing a negation, so \"we do not promise rankings\" and \"nobody can " +
      "promise a ranking\" are correctly ignored, which matters because those are the sentences a " +
      "careful site WANTS. It is genuinely wrong where the promise is about something you do " +
      "control, such as guaranteeing you will submit a sitemap, so read the sentence rather than the " +
      "rule id.",
    prevention:
      "Promise the work rather than the outcome. \"We fix what stops Google reading your site\" is " +
      "both honest and more concrete than a position nobody can hold.",
    since: "claims-2026.09",
    detect: claimDetector([
      /\b(?:guarantee[sd]?|promise[sd]?|assured?)\b[^.]{0,60}\b(?:rank|ranking|page one|first page|top (?:spot|of|three|ten)|#\s?1|number one)\b/i,
      /\b(?:get|put|move) you (?:to|on) (?:the )?(?:top|page one|first page|#\s?1)\b/i,
    ]),
  },
  {
    id: "claims.guaranteed-outcome",
    family: "substantiation",
    weight: 7,
    severity: "high",
    title: "A guaranteed business result, which depends on things outside your control",
    rationale:
      "Guaranteed customers, revenue, leads or traffic all depend on a market, a season and a " +
      "competitor's behaviour. A guarantee is a contractual promise, so it is the one form of " +
      "marketing copy a customer can hold you to directly.",
    falsePositiveNote:
      "A guarantee you actually honour is not a false claim, it is a policy, and plenty of good " +
      "businesses guarantee a refund or a redo. So this fires on guaranteed RESULTS rather than " +
      "guaranteed service or a money-back promise, and a sentence with a negation is skipped. If you " +
      "genuinely refund when the result does not come, say that instead: it is the same promise " +
      "without the exposure.",
    prevention:
      "Guarantee what you do, not what the market does. A refund promise is concrete, keepable and " +
      "more persuasive than a projection.",
    since: "claims-2026.09",
    detect: claimDetector([
      /\b(?:guarantee[sd]?|guaranteed)\b[^.]{0,50}\b(?:results?|sales|revenue|customers?|clients?|leads?|traffic|growth|bookings?)\b/i,
      /\b(?:double|triple|10x)\s+your\s+(?:sales|revenue|customers|traffic|bookings)\b/i,
    ]),
  },
  {
    id: "claims.health-benefit",
    family: "regulated",
    weight: 9,
    severity: "high",
    title: "A health or medical benefit, which is the most heavily regulated thing a business can say",
    rationale:
      "A claim that a product prevents, treats or improves a condition is a health claim, and for " +
      "food and drink it is regulated well beyond ordinary advertising law. It is easy to make by " +
      "accident: a juice bar writing that a drink boosts immunity has made one, and so has a candle " +
      "shop writing that a scent relieves anxiety.",
    falsePositiveNote:
      "Wrong where the claim is authorised, substantiated or purely descriptive of an ingredient " +
      "rather than an effect, so \"contains vitamin C\" is fine while \"boosts your immune system\" " +
      "is the claim. It cannot tell an authorised claim from an invented one, and it does not know " +
      "your jurisdiction. Treat every finding as a prompt to check with somebody who does, not as a " +
      "verdict, and note that the safest wording is usually the most specific one.",
    prevention:
      "Describe what it is and what is in it. Leave what it does to a body's health alone unless you " +
      "have an authorised claim to quote.",
    since: "claims-2026.09",
    detect: claimDetector([
      /\b(?:cures?|heals?|treats?|prevents?|reverses?)\b[^.]{0,40}\b(?:cancer|diabetes|anxiety|depression|arthritis|disease|illness|infection|inflammation)\b/i,
      /\b(?:boosts?|strengthens?|supports?|improves?)\b[^.]{0,25}\b(?:immune system|immunity|metabolism|brain function|gut health)\b/i,
      /\b(?:clinically|scientifically|medically)\s+(?:proven|proved|shown)\b/i,
      /\b(?:detox(?:ifies|ify|ifying)?|anti-?inflammatory|weight ?loss)\b[^.]{0,30}\b(?:guaranteed|proven|results)\b/i,
    ]),
  },
  {
    id: "claims.natural-or-organic-unqualified",
    family: "regulated",
    weight: 5,
    severity: "medium",
    title: "Organic or all-natural, used as a bare label",
    rationale:
      "Organic is a certification with a legal meaning in most markets and using it uncertified is a " +
      "specific offence rather than mere puffery. All-natural has no legal definition, which is the " +
      "opposite problem: it is a term regulators watch precisely because it means nothing and sounds " +
      "like it means something.",
    falsePositiveNote:
      "Wrong whenever you ARE certified, in which case the fix is to name the certifier rather than to " +
      "drop the word, and that is stronger copy. Also wrong where natural describes a process " +
      "everybody can verify, such as naturally leavened bread. This rule cannot see your paperwork.",
    prevention:
      "Name the certifier and the number, or describe the actual practice. \"Certified organic by X\" " +
      "and \"no cane sugar, ever\" both beat a bare adjective.",
    since: "claims-2026.09",
    detect: claimDetector([
      /\b(?:100%\s+)?(?:all[- ])?natural\b/i,
      /\b(?:certified\s+)?organic\b/i,
      /\bchemical[- ]free\b/i,
      /\bnon[- ]?toxic\b/i,
    ]),
  },
  {
    id: "claims.free-with-strings",
    family: "pricing",
    weight: 6,
    severity: "medium",
    title: "Something described as free in the same breath as a cost",
    rationale:
      "Free next to a price or a condition is the oldest complaint category in advertising " +
      "regulation. If the thing is only free when you buy something else, the condition has to be as " +
      "prominent as the word free, not in a footnote.",
    falsePositiveNote:
      "This project's own site says the draft is free and states a price for the finished site in the " +
      "same region, and that is honest because the two are different things and the page says so. So " +
      "a finding here is often correct copy about two separate offers, and the question to ask is " +
      "whether a reader could think the priced thing is the free thing. If they could not, ignore it.",
    prevention:
      "Put the condition in the same sentence as the word free, in the same size. \"Free draft, and " +
      "you only pay if you keep it\" is unambiguous.",
    since: "claims-2026.09",
    detect: claimDetector([
      /\bfree\b[^.]{0,40}(?:\$\s?\d|\bwhen you (?:buy|spend|subscribe|sign)\b|\bwith (?:any|every) purchase\b)/i,
      /\b(?:100%\s+)?free\b[^.]{0,25}\bonly\s+\$\s?\d/i,
    ]),
  },
  {
    id: "claims.unqualified-superlative",
    family: "substantiation",
    weight: 2,
    severity: "low",
    title: "A bare superlative, which is only a problem if somebody reads it literally",
    rationale:
      "Best, number one and leading are objective claims when a reader could take them as fact, and " +
      "puffery when nobody would. The line is genuinely blurry, and where it lands depends on how " +
      "specific the claim is: best coffee in town invites a comparison, best day of your life does " +
      "not.",
    falsePositiveNote:
      "Weight 2 on purpose, and it will fire on copy that is completely fine. Obvious enthusiasm is " +
      "protected as puffery almost everywhere, and this rule cannot tell enthusiasm from a comparative " +
      "assertion. It exists so somebody looks once at the strongest sentence on the page, not so " +
      "anybody edits it. If reading it aloud sounds like a boast rather than a measurement, ignore " +
      "this finding.",
    prevention:
      "Where the superlative is doing real work, make it specific and checkable. Where it is just " +
      "warmth, leave it alone.",
    since: "claims-2026.09",
    detect: claimDetector([
      /\b(?:the\s+)?(?:best|finest|greatest)\b[^.]{0,30}\b(?:in (?:the )?(?:city|town|state|country|world)|anywhere)\b/i,
      /\b(?:#\s?1|number one|the leading|the top)\b[^.]{0,30}\b(?:in|for)\b/i,
      /\bvoted\b[^.]{0,20}\b(?:best|#\s?1|number one)\b/i,
    ]),
  },
  {
    id: "claims.deadline-already-passed",
    family: "pricing",
    weight: 6,
    severity: "medium",
    title: "An offer with a deadline that has already gone by",
    rationale:
      "A sale that ended last year is still on the page, which tells a visitor the site is not looked " +
      "after and tells a regulator the urgency was never real. Perpetual urgency is a recognised " +
      "deceptive pattern, and the accidental version looks identical to the deliberate one.",
    falsePositiveNote:
      "Only fires where a FULL date including a year is present and that date is in the past, so " +
      "\"ends Sunday\" and \"this weekend only\" are never reported: they are almost always true and " +
      "there is no way to tell from parsed text. It is wrong on a page describing a past event " +
      "historically, such as a report on last year's market, where the date is the subject rather " +
      "than a deadline.",
    prevention:
      "Put dated offers behind a date you can update in one place, or take the deadline out and let " +
      "the offer stand on its own.",
    since: "claims-2026.09",
    detect: (f) => {
      const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
      const urgency = /\b(?:ends?|expires?|offer|sale|deadline|last (?:chance|day)|until|through)\b/i;
      const now = new Date();
      return f.sentences.flatMap((s) => {
        const u = s.text.match(urgency);
        if (!u || typeof u.index !== "number") return [];
        // Negation is judged against the URGENCY phrase, not the date, because it
        // is the urgency that is being claimed or disclaimed.
        if (negatedBefore(s.text, u.index)) return [];
        const m = s.text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "i"));
        if (!m) return [];
        const when = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
        if (Number.isNaN(when.getTime()) || when >= now) return [];
        return [
          {
            selector: s.selector,
            observed: `deadline ${m[1]} ${m[2]}, ${m[3]} has passed: "${s.text.slice(0, 140)}"`,
          },
        ];
      });
    },
  },
];
