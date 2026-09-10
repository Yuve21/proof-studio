/**
 * Making the lightweight parser agree with a browser about the DOM it produces.
 *
 * WHY THIS FILE EXISTS, and every item in it is a live divergence found by a test
 * rather than a precaution.
 *
 * The corpus runs under two DOM implementations: a real browser on our side, and
 * linkedom on the customer's, because the privacy page promises the installed
 * software "makes no network requests of any kind" and shipping a browser to
 * check a heading level is not reasonable. Two implementations of one behaviour
 * is the defect this house names most often, so `mcp/parity.test.mjs` diffs them.
 * This file is what the diff turned up.
 *
 * 1. ATTRIBUTE NAME CASE. The HTML parsing specification lowercases attribute
 *    names in the HTML namespace, so a browser reading `<meta charSet="utf-8">`
 *    exposes `charset`. linkedom preserves the case it was written in.
 *
 *    React serialises several DOM properties in camelCase, which makes this the
 *    default output of the framework this product's own site is built with.
 *    Measured across our own built pages: `charSet`, `autoComplete`,
 *    `fetchPriority`, `noModule` and `viewBox`.
 *
 *    WHAT IT COST, because the cost is the argument. Two rules were silently
 *    wrong in the direction that accuses honest work:
 *      - `technical.charset-missing-or-late` reported that our own home page has
 *        no charset declaration. It is the FIRST element in the head.
 *      - `forms.autocomplete-missing` reported a React field carrying
 *        `autoComplete` as missing it. That is the apply form on our own site.
 *    Both would have reached a customer as a citation about correct markup.
 *
 * 2. THE IMPLIED TBODY. The parsing specification requires a `tr` that is a
 *    direct child of `table` to be wrapped in a generated `tbody`, so a browser
 *    reports one more element than linkedom does for the same markup. Omitting
 *    tbody is ordinary hand-written HTML, so this is not exotic either. The
 *    consequence is a DENOMINATOR that differs between the receipt we send and
 *    the run on the customer's machine, which is worse than either being wrong
 *    alone.
 *
 * 3. FOREIGN ELEMENT TAG NAME CASE, which is why the carve-out below compares
 *    case-insensitively. For an svg element a browser's `tagName` is `svg` while
 *    linkedom's is `SVG`, and the two disagree.
 *
 *    A CORRECTION TO WHAT THIS COMMENT FIRST SAID, kept because the mistake is
 *    the useful part. It claimed the original uppercase comparison "would have
 *    silently lowercased viewBox in a browser". That is false. This normaliser
 *    only ever runs on the linkedom path, because a browser is already conformant
 *    and needs no correction, so the browser spelling is never reached here. The
 *    uppercase comparison was therefore correct against today's linkedom, and a
 *    mutation making it case-sensitive again SURVIVED the parity suite, which is
 *    what exposed the false explanation.
 *
 *    The case-insensitive comparison stays, for a real but smaller reason: it is
 *    defence against the parser's spelling changing under us, and it costs one
 *    `toUpperCase`. Because parity cannot see it, `isForeignRoot` is exported and
 *    tested directly against both spellings. A guarantee no test can observe is
 *    not a guarantee.
 *
 * WHY THESE ARE FIXED HERE AND NOT IN THE RULES. Rules across five rulebooks read
 * attributes and count elements. A per-rule fix is one chance to forget per rule,
 * plus another every time a rule is added. One normalisation at the boundary is
 * the same fix for all of them and for every rule not yet written, and it puts
 * the correction where the divergence is, which is the parser.
 *
 * WHAT IS NOT FIXED HERE, published rather than left to be discovered. This makes
 * linkedom agree with a browser on the three things above and nothing else. It is
 * not a conformance layer. `mcp/parity.test.mjs` is the only thing that knows
 * whether the two agree, and any future divergence it finds belongs in this file
 * with the same treatment rather than in a widened tolerance.
 */

/** Elements whose subtree is foreign content, where attribute case is meaningful. */
const FOREIGN_ROOTS = new Set(["SVG", "MATH"]);

/**
 * Case-insensitive, because a browser and linkedom disagree about tagName here.
 * Exported ONLY so this can be tested directly: the parity suite cannot observe
 * it, for the reason given at the top of this file.
 */
export const isForeignRoot = (el) => FOREIGN_ROOTS.has((el.tagName || "").toUpperCase());

/**
 * Lowercase every HTML-namespace attribute name in place, the way a browser
 * would, and report what changed so a caller can assert the function did
 * something rather than trusting that it ran.
 *
 * @param {object} document a parsed document
 * @returns {{renamed: number, dropped: number, names: string[]}} names is the
 *   distinct original spellings that were changed, which is what a test asserts
 *   against so a silent no-op is visible.
 */
export function lowercaseHtmlAttributes(document) {
  const renamedNames = new Set();
  let renamed = 0;
  let dropped = 0;

  for (const el of document.querySelectorAll("*")) {
    if (isForeignRoot(el)) continue;
    let inForeign = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (isForeignRoot(p)) {
        inForeign = true;
        break;
      }
    }
    if (inForeign) continue;

    // A copy, because renaming mutates the list this iterates.
    const names = el.getAttributeNames ? [...el.getAttributeNames()] : [];
    for (const name of names) {
      const lower = name.toLowerCase();
      if (lower === name) continue;
      const value = el.getAttribute(name);
      el.removeAttribute(name);
      if (el.hasAttribute(lower)) {
        /*
         * Both spellings present. A browser keeps the FIRST occurrence and drops
         * the duplicate, so the already-lowercase one wins and this value is
         * discarded. Counted rather than silent, because a page reaching this
         * branch has genuinely duplicated an attribute and that is worth seeing.
         */
        dropped += 1;
        continue;
      }
      el.setAttribute(lower, value);
      renamed += 1;
      renamedNames.add(name);
    }
  }

  return { renamed, dropped, names: [...renamedNames].sort() };
}

/**
 * Wrap runs of `tr` that are direct children of a `table` in a generated
 * `tbody`, which is what the parsing specification requires and what a browser
 * therefore produces.
 *
 * CONSECUTIVE rows share one tbody, and a `thead` or `tfoot` between two runs
 * starts a new one, because that is the behaviour being matched. Rows already
 * inside a tbody, thead or tfoot are not direct children of the table and are
 * left alone.
 *
 * @returns {{wrapped: number, groups: number}} rows moved, and tbody elements
 *   created, so a caller can assert this did something.
 */
export function insertImpliedTbody(document) {
  let wrapped = 0;
  let groups = 0;

  for (const table of document.querySelectorAll("table")) {
    // A snapshot: this loop reparents nodes, and iterating a live list while
    // moving its members is how a wrapper silently skips every other row.
    const children = [...table.children];
    let run = [];
    const flush = () => {
      if (run.length === 0) return;
      const tbody = document.createElement("tbody");
      table.insertBefore(tbody, run[0]);
      for (const tr of run) tbody.appendChild(tr);
      wrapped += run.length;
      groups += 1;
      run = [];
    };
    for (const child of children) {
      if ((child.tagName || "").toUpperCase() === "TR") run.push(child);
      else flush();
    }
    flush();
  }

  return { wrapped, groups };
}

/**
 * Everything above, in the order a browser would have done it. This is what the
 * DOM boundary calls; the individual functions are exported so the parity test
 * can assert each one changed something.
 */
export function conformToHtmlParsing(document) {
  const attributes = lowercaseHtmlAttributes(document);
  const tbody = insertImpliedTbody(document);
  return { attributes, tbody };
}
