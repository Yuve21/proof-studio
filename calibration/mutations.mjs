/**
 * The per-seat eval, built as a MUTATION CORPUS rather than a pile of defect pages.
 *
 * WHY THIS SHAPE. The plan names per-seat evals as the gap between "we optimised
 * the agents" and a measurement, and says plainly that without a graded task set
 * the claim is an adjective. For a deterministic seat the graded task set is not
 * hypothetical: it is a labelled page and the rules that should fire on it.
 *
 * Every case below is `calibration/pages/clean-trade-site.html` with exactly ONE
 * thing broken. That buys three things a folder of separate defect pages does not:
 *
 *   1. The control is real. The clean page fires NOTHING across all ten
 *      rulebooks, measured, so anything a mutation produces was produced by the
 *      mutation.
 *   2. Every case is a mutation test by construction. A rule that stops catching
 *      its own defect fails here, which is the check that would otherwise have to
 *      be remembered.
 *   3. False positives are caught in the same run and for free. A mutation that
 *      breaks the phone number must not make the accessibility seat fire, and
 *      the harness fails if it does, because the expectation is exact rather
 *      than a floor.
 *
 * EXPECTATIONS ARE DECLARED, NOT INHERITED FROM A BASELINE. A baseline tells you
 * something changed. A declared expectation tells you the answer is wrong, on the
 * first run, before any history exists. The baseline shape would also have
 * happily frozen a rule that was already broken.
 *
 * WHAT THIS IS NOT. It is not an accuracy measurement and produces no rate. Every
 * page here is constructed by us, so a percentage derived from them would
 * describe this file rather than the world. It answers one question only: does
 * each rule still catch the thing it was written for, and does it still leave
 * everything else alone.
 */

export const CLEAN_PAGE = "calibration/pages/clean-trade-site.html";

/** Replace once, and throw if the anchor is gone, because a mutation that silently did nothing passes. */
const swap = (html, from, to) => {
  if (!html.includes(from)) {
    throw new Error(`mutation anchor missing from the clean page: ${from.slice(0, 60)}`);
  }
  return html.replace(from, to);
};

export const MUTATIONS = [
  {
    id: "phone-printed-not-linked",
    seat: "conversion-auditor",
    why: "The commonest revenue leak on a trade site: a number that works on the desktop it was built on and cannot be tapped on the phone every customer is holding.",
    apply: (h) => swap(h, '<a href="tel:+441132960112">Call us on 0113 296 0112</a>', "Call us on 0113 296 0112"),
    expects: ["conversion.phone-number-is-not-tappable"],
  },
  {
    id: "email-printed-not-linked",
    seat: "conversion-auditor",
    why: "Same failure, smaller, and deliberately medium severity because unlinking to deter scrapers is a real trade.",
    apply: (h) => swap(h, '<a href="mailto:jobs@ellisandson.example">email jobs@ellisandson.example</a>', "email jobs@ellisandson.example"),
    expects: ["conversion.email-is-not-a-mailto"],
  },
  {
    id: "enquiry-button-ships-disabled",
    seat: "conversion-auditor",
    why: "A control nobody can press until script says so. Invisible in review, because whoever reviews it has JavaScript working.",
    apply: (h) => swap(h, '<button type="submit">Send enquiry</button>', '<button type="submit" disabled>Send enquiry</button>'),
    expects: ["conversion.primary-action-shipped-disabled"],
  },
  {
    id: "form-asks-for-everything",
    seat: "conversion-auditor",
    why: "Six required fields before a first contact. Every one is a place to stop.",
    apply: (h) =>
      swap(
        h,
        '<button type="submit">Send enquiry</button>',
        /*
         * The extra fields are LABELLED and carry autocomplete, deliberately.
         * The first version of this mutation used bare inputs, and the run fired
         * five accessibility findings and two forms findings alongside the one it
         * was testing. That is a fault in the MUTATION, not in those rules: a case
         * that breaks four things cannot tell you which rule caught which, and the
         * "nothing else fired" half of the expectation stops meaning anything.
         */
        '<label for="m-phone">Phone</label><input id="m-phone" name="phone" type="tel" autocomplete="tel" required>' +
          '<label for="m-postcode">Postcode</label><input id="m-postcode" name="postcode" autocomplete="postal-code" required>' +
          '<label for="m-budget">Budget</label><input id="m-budget" name="budget" required>' +
          '<label for="m-timeframe">Timeframe</label><input id="m-timeframe" name="timeframe" required>' +
          '<label for="m-property">Property type</label><input id="m-property" name="property" required>' +
          '<button type="submit">Send enquiry</button>',
      ),
    expects: ["conversion.form-asks-for-too-much"],
  },
  {
    id: "analytics-removed",
    seat: "measurement",
    why: "The client pays monthly for a report whose numbers were never being collected.",
    apply: (h) => swap(h, '<script src="https://www.googletagmanager.com/gtag/js?id=G-4RTQ9PZ1XK"></script>', ""),
    expects: ["measurement.nothing-is-counting"],
  },
  {
    id: "analytics-placeholder-id",
    seat: "measurement",
    why: "Looks installed in every screenshot and reports into nothing.",
    apply: (h) => swap(h, "G-4RTQ9PZ1XK", "G-XXXXXXX"),
    expects: ["measurement.placeholder-id"],
  },
  {
    id: "search-console-unverified",
    seat: "measurement",
    why: "Low weight on purpose: DNS and file verification are invisible here, so this is a prompt rather than a verdict.",
    apply: (h) => swap(h, '<meta name="google-site-verification" content="hV3k9Qm2pLxZ7bR1">', ""),
    expects: ["measurement.no-search-console-verification"],
  },
  {
    id: "csp-blocks-the-tag-it-loads",
    seat: "measurement",
    why: "The tag is in the HTML, the site looks instrumented, and the browser refuses it silently.",
    apply: (h) =>
      swap(h, '<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="script-src \'self\'">'),
    expects: ["measurement.csp-blocks-its-own-tag"],
  },

  /*
   * The five below cover the seats that shipped before today. Their expectations
   * were filled in from `--record` after reading what fired, never guessed: an
   * expectation written by guessing a rule id asserts whatever the code happens
   * to do, which is a test that can never fail for the right reason.
   */
  {
    id: "lorem-ipsum-left-in",
    seat: "template-tells",
    why: "Placeholder copy that shipped. The clearest possible sign nobody finished the page.",
    apply: (h) => swap(h, "We fix leaks, repair boilers and fit bathrooms across Leeds.", "Lorem ipsum dolor sit amet, consectetur adipiscing elit."),
    expects: ["tells.placeholder-copy"],
  },
  {
    id: "undefined-rendered-into-copy",
    seat: "broken-things",
    why: "A template that rendered a missing value and shipped it to a customer.",
    apply: (h) => swap(h, "<h1>Plumbers in Leeds, family run since 1998</h1>", "<h1>Plumbers in undefined, family run since 1998</h1>"),
    expects: ["broken.interpolation-failed"],
  },
  {
    id: "link-points-at-localhost",
    seat: "broken-things",
    why: "A link that works on the machine it was built on and nowhere else.",
    apply: (h) => swap(h, '<a href="/services">Services</a>', '<a href="http://localhost:3000/services">Services</a>'),
    expects: ["broken.local-address"],
  },
  {
    id: "title-removed",
    seat: "seo-onpage",
    why: "The one piece of copy a search result is built from.",
    apply: (h) => swap(h, "<title>Ellis & Son Plumbing, Leeds</title>", ""),
    expects: ["onpage.title-missing"],
  },
  {
    id: "unsubstantiated-claim-added",
    seat: "claims-officer",
    why: "Ordinary marketing that is also a substantiation claim somebody may ask the trader to produce evidence for.",
    apply: (h) => swap(h, "<h2>What we do</h2>", "<h2>What we do</h2>\n    <p>We are 98% faster than any other plumber in Leeds.</p>"),
    expects: ["claims.performance-figure"],
  },
];
