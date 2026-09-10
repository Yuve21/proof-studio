/**
 * The `seo-onpage` corpus. The first real one, and the shape every other follows.
 *
 * RULES ARE DATA. Everything that decides how much a finding MATTERS is a field:
 * id, family, weight, severity, title, rationale, falsePositiveNote, prevention,
 * since. Only `detect` is a function, because a threshold has to be compared
 * somewhere. That is what makes the corpus publishable, auditable, disputable and
 * versionable without shipping a new engine.
 *
 * `falsePositiveNote` IS MANDATORY AND MUST BE SPECIFIC. It is the published
 * condition under which the rule is WRONG, it travels attached to the fix the
 * rule proposes, and it is the field that makes an agent read as senior rather
 * than confident. "May occasionally be wrong" is not a note. Name the legitimate
 * business that trips it. `corpus/load.mjs` refuses a rule without one.
 *
 * NO REGEX OVER HTML. Every check here runs against a real DOM, read from a real
 * browser, because a regex is a hypothesis about its input and HTML is the input
 * most likely to falsify one. The locator on every finding is a CSS selector plus
 * the element's own text, so a stranger can go and look at the exact thing.
 *
 * WHAT THIS CORPUS CANNOT SEE, published rather than implied:
 *   - anything that requires a network request (competitor pages, backlinks,
 *     whether a linked URL resolves). That belongs to `broken-things` and it
 *     cannot run under the no-egress rule without the explicit browse the user
 *     asked for.
 *   - anything about search RESULTS. Nothing here claims a ranking effect, and no
 *     rule may. Every rule states a property of the page.
 *   - copy quality. That is `copy-reviewer`, and it is advisory.
 */

export const CORPUS_ID = "seo-onpage";
export const CORPUS_VERSION = "onpage-2026.09";

/**
 * Serialised inside the browser and run against the live DOM. Returns the facts
 * the rules reason over, so the rules themselves never touch a DOM API and stay
 * testable against a plain object.
 */
export const collect = () => {
  const sel = (el) => {
    // A selector a human can paste into devtools. Prefers id, then a nth-of-type
    // path, because a generated class chain is unreadable and often unstable.
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
  const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();

  const titleEl = document.querySelector("title");
  const metaDesc = document.querySelector('meta[name="description"]');
  const canonical = document.querySelector('link[rel="canonical"]');
  const viewport = document.querySelector('meta[name="viewport"]');
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
    level: Number(h.tagName.slice(1)),
    text: text(h).slice(0, 120),
    selector: sel(h),
  }));
  const images = Array.from(document.querySelectorAll("img")).map((img) => ({
    alt: img.getAttribute("alt"),
    src: (img.getAttribute("src") || "").slice(0, 120),
    selector: sel(img),
  }));
  const links = Array.from(document.querySelectorAll("a")).map((a) => ({
    text: text(a).slice(0, 80),
    href: (a.getAttribute("href") || "").slice(0, 160),
    selector: sel(a),
    hasImage: !!a.querySelector("img"),
    ariaLabel: a.getAttribute("aria-label"),
  }));

  return {
    lang: document.documentElement.getAttribute("lang"),
    title: titleEl ? text(titleEl) : null,
    metaDescription: metaDesc ? (metaDesc.getAttribute("content") || "").trim() : null,
    canonical: canonical ? canonical.getAttribute("href") : null,
    viewport: viewport ? viewport.getAttribute("content") : null,
    headings,
    images,
    links,
    // Denominators, so a rule that finds nothing can say whether there was
    // anything to find. A probe that examined zero things is a FAILURE, never a
    // pass, and these are what make that distinguishable.
    counts: {
      headings: headings.length,
      images: images.length,
      links: links.length,
      bodyTextLength: text(document.body).length,
    },
  };
};

/** Convenience for a finding, so every one of them carries a locator by construction. */
const at = (selector, observed) => ({ selector, observed });

export const RULES = [
  {
    id: "onpage.title-missing",
    family: "title",
    weight: 5,
    severity: "high",
    title: "The page has no title",
    rationale:
      "The title is the clickable line in a search result and the label on a browser tab. Without " +
      "one, search engines invent something from the page content and the tab shows a URL.",
    falsePositiveNote:
      "Never wrong on a public page. It IS wrong on a fragment that was never a whole page: an " +
      "email template, an embedded widget, or an iframe body. If the artifact is not a page a " +
      "person can navigate to, this rule does not apply and the report should be scoped instead.",
    prevention: "Give every route a title before it ships. A title is not optional content.",
    since: "onpage-2026.09",
    detect: (f) => (f.title ? [] : [at("head > title", "no <title> element in the document")]),
  },
  {
    id: "onpage.title-truncates",
    family: "title",
    weight: 2,
    severity: "medium",
    title: "The title is long enough that a search result will cut it off",
    rationale:
      "Google renders titles to a pixel width that works out at roughly 60 characters for typical " +
      "prose. Past that the end is replaced with an ellipsis, so anything load-bearing at the end " +
      "of the title is not read.",
    falsePositiveNote:
      "This is a truncation fact, not a ranking claim, and it is measured in CHARACTERS while the " +
      "real limit is pixels: a title of narrow characters can run longer and a title in wide caps " +
      "gets cut sooner. It is also legitimately wrong when the tail is deliberately expendable, " +
      "for example a brand name after a pipe that the reader does not need. Judge whether the part " +
      "past 60 characters carries meaning before changing anything.",
    prevention: "Put the distinguishing words first and the brand last.",
    since: "onpage-2026.09",
    detect: (f) =>
      f.title && f.title.length > 60
        ? [at("head > title", `${f.title.length} characters: "${f.title}"`)]
        : [],
  },
  {
    id: "onpage.meta-description-missing",
    family: "description",
    weight: 3,
    severity: "medium",
    title: "The page has no meta description",
    rationale:
      "With no description, the snippet under a search result is assembled from whatever text the " +
      "engine finds, which for a business page is often a navigation menu or a cookie notice.",
    falsePositiveNote:
      "A meta description is not a ranking factor and this rule does not claim it is. It is also " +
      "genuinely optional: an engine will often write a better snippet from page content than a " +
      "generic hand-written description, and a description that repeats the title adds nothing. " +
      "The real defect is having neither a description nor snippet-worthy opening prose.",
    prevention: "One sentence per page saying what the page is for, written for a stranger.",
    since: "onpage-2026.09",
    detect: (f) =>
      f.metaDescription
        ? []
        : [at('head > meta[name="description"]', "no meta description element in the document")],
  },
  {
    id: "onpage.h1-missing",
    family: "structure",
    weight: 4,
    severity: "high",
    title: "The page has no first-level heading",
    rationale:
      "The h1 is the page's own statement of what it is, and it is the first thing a screen reader " +
      "user hears after the title. A page with h2s and no h1 has a table of contents with no name " +
      "at the top of it.",
    falsePositiveNote:
      "Wrong when the visible title is an image carrying the wording, which is a real design " +
      "choice on a brand page, though it then needs the wording in the image's alt text. Also " +
      "wrong on a page whose h1 is rendered by client-side script AFTER this probe read the DOM, " +
      "which is why `counts.headings` is reported alongside: if that is zero the page may simply " +
      "not have finished rendering, and the honest answer is abstention rather than a finding.",
    prevention: "Exactly one h1 per page, and make it the sentence the page is about.",
    since: "onpage-2026.09",
    detect: (f) =>
      f.headings.some((h) => h.level === 1)
        ? []
        : [at("body", `${f.counts.headings} heading(s) found, none of them h1`)],
  },
  {
    id: "onpage.h1-multiple",
    family: "structure",
    weight: 1,
    severity: "low",
    title: "The page has more than one first-level heading",
    rationale:
      "Several h1s means the page asserts several different things to be its main subject, so an " +
      "engine and a screen reader both have to guess which one is the page.",
    falsePositiveNote:
      "Weak on purpose, weight 1, because the HTML5 outline algorithm was specified to permit " +
      "exactly this and plenty of correct pages have a per-section h1 inside `section` elements. " +
      "It is a smell rather than a defect, and on a page whose sections really are independent " +
      "documents it is not even that.",
    prevention: "One h1, and h2 for the sections under it.",
    since: "onpage-2026.09",
    detect: (f) => {
      const h1s = f.headings.filter((h) => h.level === 1);
      return h1s.length > 1
        ? h1s.map((h) => at(h.selector, `h1: "${h.text}" (${h1s.length} h1 elements on the page)`))
        : [];
    },
  },
  {
    id: "onpage.heading-level-skipped",
    family: "structure",
    weight: 2,
    severity: "medium",
    title: "A heading level is skipped, so the outline has a gap",
    rationale:
      "Jumping from h2 to h4 tells assistive technology there is a missing level of structure. A " +
      "screen reader user navigating by heading level hears a subsection with no section.",
    falsePositiveNote:
      "This reads the DOM ORDER, which on a page using CSS grid or flex ordering is not the visual " +
      "order. A page can be visually correct and trip this, and the reverse. It is also wrong when " +
      "a level is skipped for styling reasons and the real fix is a class rather than a tag, in " +
      "which case the outline is the thing to fix and not the appearance.",
    prevention: "Choose heading levels by document structure and size them with CSS.",
    since: "onpage-2026.09",
    detect: (f) => {
      const out = [];
      let previous = 0;
      for (const h of f.headings) {
        if (previous && h.level > previous + 1) {
          out.push(at(h.selector, `h${h.level} "${h.text}" follows h${previous}, skipping h${previous + 1}`));
        }
        previous = h.level;
      }
      return out;
    },
  },
  {
    id: "onpage.image-alt-missing",
    family: "media",
    weight: 3,
    severity: "medium",
    title: "An image has no alt attribute at all",
    rationale:
      "A missing alt attribute is different from an empty one. Empty means decorative and is " +
      "correct. Missing means nobody decided, so a screen reader falls back to reading the file " +
      "name, and an image search has nothing to index.",
    falsePositiveNote:
      "The distinction this rule rests on is the whole point: `alt=\"\"` is CORRECT for a " +
      "decorative image and this rule deliberately does not fire on it. It fires only on a wholly " +
      "absent attribute. It is still wrong on an `img` injected by a third-party embed the site " +
      "does not control, such as a payment badge or a map tile, which cannot be fixed from this " +
      "codebase.",
    prevention:
      "Every img gets an alt attribute at the moment it is written: the wording if it carries " +
      "meaning, alt=\"\" if it is decoration.",
    since: "onpage-2026.09",
    detect: (f) =>
      f.images
        .filter((img) => img.alt === null)
        .map((img) => at(img.selector, `img with no alt attribute, src="${img.src}"`)),
  },
  {
    id: "onpage.link-text-generic",
    family: "links",
    weight: 2,
    severity: "medium",
    title: "A link's text does not say where it goes",
    rationale:
      "Screen readers can list every link on a page out of context, and a list of eight entries " +
      "reading 'learn more' is unusable. Link text is also one of the strongest signals about the " +
      "page being linked to.",
    falsePositiveNote:
      "Wrong when the link carries an aria-label that does say where it goes, which this rule " +
      "checks and skips. Also wrong for a link wrapping an image, where the image's alt text is " +
      "the accessible name, and that case is skipped too. What remains is genuinely a link whose " +
      "only name is a generic phrase.",
    prevention: "Write the destination into the link text: 'see this weekend's market schedule'.",
    since: "onpage-2026.09",
    detect: (f) => {
      const generic = /^(click here|read more|learn more|more|here|this|link|see more|details|find out more)$/i;
      return f.links
        .filter((a) => !a.hasImage && !a.ariaLabel && generic.test(a.text))
        .map((a) => at(a.selector, `link text "${a.text}" pointing at ${a.href || "(no href)"}`));
    },
  },
  {
    id: "onpage.lang-missing",
    family: "structure",
    weight: 2,
    severity: "medium",
    title: "The document does not declare its language",
    rationale:
      "Without a lang attribute a screen reader reads the page in whatever voice it defaults to, " +
      "which mispronounces everything, and translation tools have to guess.",
    falsePositiveNote:
      "Effectively never a false positive on a real page. The one legitimate case is a document " +
      "genuinely mixing languages with per-element lang attributes and no dominant language, which " +
      "is rare and which this rule cannot distinguish, so check before acting on it.",
    prevention: "Set lang on the html element in the layout, once.",
    since: "onpage-2026.09",
    detect: (f) =>
      f.lang && f.lang.trim() ? [] : [at("html", "the html element has no lang attribute")],
  },
  {
    id: "onpage.canonical-missing",
    family: "duplication",
    weight: 1,
    severity: "low",
    title: "The page declares no canonical URL",
    rationale:
      "The same page is usually reachable at several URLs: with and without www, with tracking " +
      "parameters, with and without a trailing slash. A canonical says which one is the real one.",
    falsePositiveNote:
      "Weight 1 because a single-page site with one URL genuinely does not need this, and a " +
      "self-referential canonical adds nothing an engine cannot work out. It matters when a page " +
      "is reachable by several URLs, and this rule CANNOT see whether that is true, because " +
      "determining it requires requesting other URLs and nothing here makes a network request. So " +
      "treat it as a question rather than a defect.",
    prevention: "Set canonical from one place in the layout, derived from the route.",
    since: "onpage-2026.09",
    detect: (f) =>
      f.canonical ? [] : [at('head > link[rel="canonical"]', "no canonical link element")],
  },
];
