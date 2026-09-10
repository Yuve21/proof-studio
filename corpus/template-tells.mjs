/**
 * The `template-tells` corpus. The eighth rulebook, and the one whose scope in
 * the plan was WRONG and is corrected here.
 *
 * RULES ARE DATA. Everything that decides how much a finding matters is a field.
 * Only `detect` is a function. See `corpus/seo-onpage.mjs` for the shape and
 * `corpus/load.mjs` for the refusals that enforce it.
 *
 * WHAT THE PLAN SAID, AND WHY IT COULD NOT BE DONE.
 *
 * The roster described this seat as "the slop-scorer corpus itself, 104 rules".
 * Two things are wrong with that and both were found by counting rather than by
 * reading. The sibling product's web corpus has 51 rules, not 104, and only a
 * minority of them can run in the software a customer installs:
 *
 *   visual      12 rules   computed styles and loaded font faces
 *   motion       9 rules   a motion probe over a running page
 *   counter      6 rules   computed styles, font faces, provenance metadata
 *   imagetext    3 rules   optical character recognition over screenshots
 *   craft       11 rules   mostly delivered HTML, some network
 *   builder      5 rules   HTTP response headers and well-known paths
 *   copy         3 rules   text only
 *   structure    2 rules   DOM
 *
 * Thirty of those fifty-one need a real browser, and the installed side has a
 * parser. That is not a gap to be closed later; it is the same constraint that
 * makes the no-egress promise possible. So this rulebook ports the part that
 * reads delivered HTML and says so, rather than shipping a seat whose published
 * rule count is four times what it does.
 *
 * A SECOND THING IS DELIBERATELY NOT PORTED, and this one is a design difference
 * rather than a missing capability.
 *
 * The sibling product produces a SCORE, so it can carry weak signals: uniform
 * feature cards, an arrow in a call to action, a stagger ladder of reveals. None
 * of those means anything alone, and all of them together mean a great deal. That
 * is what a score is for.
 *
 * Proof does not produce a score. It produces findings, each citing a line
 * somebody can go and read. A weak signal cannot be a finding: "three of your
 * cards have the same shape" is true of most well-built pages and it is not
 * something anybody should change. Weak-signal rules are therefore absent on
 * purpose, and the absence is published here so that nobody adds them later
 * thinking the omission was an oversight. If Proof ever grows an aggregate, that
 * is the moment to revisit it, and not before.
 *
 * WHAT IS LEFT IS THE TELLS THAT STAND ALONE. A title that still says Create Next
 * App. A generator tag naming the builder. Lorem ipsum. A social row linking to
 * the front page of Instagram rather than to an account. A copyright year from
 * four years ago. Every one of these is a single fact that means the same thing
 * on its own: this was made from a template and nobody finished it.
 *
 * WHAT THIS CORPUS CANNOT SEE, published rather than implied:
 *   - anything needing computed styles, loaded fonts, animation timing or a
 *     screenshot, which is thirty of the fifty-one rules named above.
 *   - HTTP response headers, robots.txt, a soft 404, or whether an asset host is
 *     a known vendor CDN. All need a request, which the no-egress rule forbids.
 *   - whether the site is GOOD. Nothing here is a judgement about design. Every
 *     rule reports a specific artifact of an unfinished template.
 */

export const CORPUS_ID = "template-tells";
export const CORPUS_VERSION = "tells-2026.09";

/**
 * Framework and builder default titles, VENDORED AS A POSITIVE-MATCH LIST.
 *
 * Same discipline as the ARIA and schema.org vocabularies: absence from this list
 * is evidence of nothing, so there is no rule reporting a title as "not a real
 * one". A title only fires when it MATCHES something here, which is why the list
 * being incomplete costs coverage rather than correctness.
 *
 * Compared case-insensitively and after collapsing whitespace, because a
 * scaffold title survives a change of case far more often than a change of words.
 */
const SCAFFOLD_TITLES = new Set(
  [
    // React and its build tools
    "react app", "create react app", "vite + react", "vite + react + ts", "vite app",
    "react + vite", "my react app",
    // Next
    "create next app", "next.js", "nextjs", "next app", "my next app",
    // other frameworks
    "nuxt app", "create nuxt app", "vue app", "vite + vue", "svelte app",
    "svelte + vite", "sveltekit", "astro", "astro basics", "welcome to astro",
    "angular app", "gatsby site", "gatsby starter", "remix app",
    "solid app", "vite + solid", "qwik app", "eleventy", "hugo", "jekyll site",
    // builders and hosts
    "webflow site", "untitled site", "my site", "my website", "new site",
    "site title", "your site name", "wix site", "squarespace",
    "framer site", "untitled project", "untitled",
    // bare HTML defaults
    "document", "untitled document", "html", "index", "home", "homepage",
    "page", "new page", "title", "hello world", "test", "test page",
    "coming soon", "under construction", "welcome",
  ].map((t) => t.toLowerCase()),
);

/**
 * Generator values that name a page builder or a site generator rather than a
 * framework a person chose to write in.
 *
 * A `generator` tag is NOT itself a defect: WordPress, Hugo and Astro all emit
 * one and plenty of excellent sites are built with them. What this list is for is
 * the case where the tag is the only thing on the page that has been filled in,
 * so it is used ONLY alongside another tell, never alone. See the rule.
 */
const BUILDER_GENERATORS = [
  /\bwix\b/i, /\bsquarespace\b/i, /\bwebflow\b/i, /\bframer\b/i, /\bgodaddy\b/i,
  /\bweebly\b/i, /\bjimdo\b/i, /\bstrikingly\b/i, /\bcarrd\b/i, /\bdurable\b/i,
  /\bhostinger\b/i, /\bmobirise\b/i, /\bnicepage\b/i, /\bsite ?builder\b/i,
];

/**
 * Hosts that hand out a free subdomain.
 *
 * WHY THIS IS HERE WHEN `broken-things` DELIBERATELY EXCLUDES THE SAME STRINGS,
 * because a reader will otherwise read the two rulebooks as contradicting each
 * other. They ask different questions of the same text.
 *
 * `broken.development-host` asks CAN A VISITOR REACH THIS, and for a vercel.app
 * or netlify.app address the answer is yes, so it is not a defect and that rule
 * says so explicitly. This rule asks DID ANYBODY FINISH THIS, and a site still on
 * the platform's own subdomain has not had a domain bought for it. Same string,
 * two questions, two honest answers.
 *
 * IT FIRES ON OUR OWN SITE TODAY. Proof is served from a vercel.app subdomain
 * because no custom domain has been bought yet. That is a true finding about us,
 * it is in the self-check output, and it is left there rather than exempted.
 */
const PLATFORM_HOSTS = [
  "vercel.app", "netlify.app", "netlify.com", "pages.dev", "github.io",
  "gitlab.io", "webflow.io", "framer.website", "framer.ai", "wixsite.com",
  "squarespace.com", "myshopify.com", "godaddysites.com", "weebly.com",
  "carrd.co", "glitch.me", "onrender.com", "fly.dev", "herokuapp.com",
  "web.app", "firebaseapp.com", "surge.sh", "neocities.org", "durable.co",
];

/** Copy a template ships with, which nobody would write on purpose. */
const PLACEHOLDER_COPY = [
  /\blorem ipsum\b/i,
  /\bdolor sit amet\b/i,
  /\byour (headline|tagline|slogan|text|content|title|subtitle|description|logo|message) (here|goes here)\b/i,
  /\b(add|insert|enter|replace) your (own )?(text|content|headline|image|logo|copy)\b/i,
  /\bthis is (a|your) (sample|placeholder|example|demo) (text|paragraph|heading|page)\b/i,
  /\b(feature|service|benefit|step|card|column|item) (one|two|three|1|2|3)\b/i,
  /\bplaceholder (text|content|image)\b/i,
  /\bedit this (text|page|section|heading)\b/i,
  /\bclick here to (edit|add|change)\b/i,
  /\bsubheading\b/i,
  /\bshort description of (your|the) (service|product|business)\b/i,
];

/**
 * The em dash, written as an escape so the literal character does not appear in
 * this repository's source. The house rule against it is about copy we publish;
 * the rule below is about copy a CUSTOMER publishes, and it needs the character
 * to count it.
 */
const EM_DASH = /\u2014/g;

/** Above this many per thousand words, the density is worth reporting. */
const EM_DASH_PER_1000 = 6;

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
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const meta = (name) => {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? norm(el.getAttribute("content")) : null;
  };
  const prop = (property) => {
    const el = document.querySelector(`meta[property="${property}"]`);
    return el ? norm(el.getAttribute("content")) : null;
  };

  const titleEl = document.querySelector("title");
  const canonicalEl = document.querySelector('link[rel~="canonical"]');

  /*
   * Elements carrying their OWN text, so a placeholder in a paragraph is reported
   * on the paragraph rather than on every ancestor of it. Same reason as
   * `broken-things`, and the same mistake is available here.
   */
  const textBlocks = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "template" || tag === "noscript") continue;
    let own = "";
    for (const node of Array.from(el.childNodes || [])) {
      if (node.nodeType === 3) own += node.textContent || "";
    }
    const text = norm(own);
    if (text) textBlocks.push({ selector: sel(el), text });
  }

  const links = Array.from(document.querySelectorAll("a[href]")).map((a) => ({
    href: norm(a.getAttribute("href")),
    text: norm(a.textContent).slice(0, 60),
    ariaLabel: norm(a.getAttribute("aria-label")),
    selector: sel(a),
  }));

  const icons = Array.from(document.querySelectorAll("link[rel]"))
    .filter((l) => /\b(icon|shortcut icon|apple-touch-icon|mask-icon)\b/i.test(l.getAttribute("rel") || ""))
    .map((l) => ({ rel: norm(l.getAttribute("rel")), href: norm(l.getAttribute("href")), selector: sel(l) }));

  const bodyText = norm(document.body ? document.body.textContent : "");

  return {
    title: titleEl ? norm(titleEl.textContent) : null,
    generator: meta("generator"),
    canonical: canonicalEl ? norm(canonicalEl.getAttribute("href")) : null,
    ogUrl: prop("og:url"),
    ogImage: prop("og:image"),
    icons,
    textBlocks,
    links,
    bodyText,
    counts: {
      textBlocks: textBlocks.length,
      links: links.length,
      icons: icons.length,
      // The denominator for the density rule. A rate without one is a number
      // pretending to be a measurement.
      words: bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0,
      bodyTextLength: bodyText.length,
    },
  };
};

const at = (selector, observed) => ({ selector, observed });
const quote = (s, n = 110) => JSON.stringify(s.length > n ? `${s.slice(0, n)}...` : s);

/** The registrable host of a URL, or null if it has none. Never throws. */
const hostOf = (url) => {
  if (!url) return null;
  const m = /^(?:https?:)?\/\/([^/?#]+)/i.exec(url.trim());
  if (!m) return null;
  return m[1].toLowerCase().replace(/:\d+$/, "");
};

const platformHostFor = (url) => {
  const host = hostOf(url);
  if (!host) return null;
  // Suffix match on a label boundary, so `notvercel.app` does not match
  // `vercel.app` and `acme.vercel.app` does.
  return PLATFORM_HOSTS.find((p) => host === p || host.endsWith(`.${p}`)) || null;
};

export const RULES = [
  {
    id: "tells.scaffold-title",
    family: "scaffold",
    weight: 9,
    severity: "high",
    title: "The page title is still a framework or builder default",
    rationale:
      "The title is the clickable line in a search result and the label on the browser tab. When it " +
      "still says Create Next App or Untitled, that is what a search engine shows, what a bookmark " +
      "is named, and what appears when somebody shares the page. It is the single most visible " +
      "unfinished thing on a site and it costs one line to fix.",
    falsePositiveNote:
      "Wrong when the default IS the intended title, which happens on a page genuinely called Home " +
      "or Welcome. Those two are the most likely honest matches in the list and a one-word title is " +
      "worth reconsidering anyway. This rule only fires on a POSITIVE match against a vendored list " +
      "of known defaults, so a title absent from that list is never reported: the list being " +
      "incomplete costs coverage, never correctness.",
    prevention:
      "Set the title per route as the first thing after scaffolding, before any styling. A default " +
      "title survives because it looks like content rather than like configuration.",
    since: "tells-2026.09",
    detect: (f) => {
      if (!f.title) return []; // onpage.title-missing owns absence.
      const normalised = f.title.toLowerCase().replace(/\s+/g, " ").trim();
      return SCAFFOLD_TITLES.has(normalised)
        ? [at("title", `<title> is ${quote(f.title)}, a known framework or builder default`)]
        : [];
    },
  },
  {
    id: "tells.placeholder-copy",
    family: "scaffold",
    weight: 9,
    severity: "high",
    title: "Template placeholder copy is still on the page",
    rationale:
      "Lorem ipsum, Your headline here, or Feature One is copy the template shipped with. A visitor " +
      "reads it as the business not being open yet, or not being real. Unlike a styling choice this " +
      "is unambiguous: nobody writes Feature One on purpose.",
    falsePositiveNote:
      "Wrong on a page that is deliberately showing a template, which is what a theme demo, a " +
      "component gallery and a design system page all are, and those will trip this rule. The " +
      "finding quotes the surrounding sentence so a reader can see immediately which case they are " +
      "in. It is also wrong on a business genuinely offering a product called something like " +
      "Step Two, which is rare but real.",
    prevention:
      "Delete placeholder copy when you delete the placeholder image, in the same pass. It survives " +
      "because it is grammatical and sits in a section that looks finished.",
    since: "tells-2026.09",
    detect: (f) =>
      f.textBlocks.flatMap((b) => {
        for (const re of PLACEHOLDER_COPY) {
          const m = b.text.match(re);
          if (m) return [at(b.selector, `${quote(m[0], 60)} in: ${quote(b.text)}`)];
        }
        return [];
      }),
  },
  {
    id: "tells.social-link-has-no-account",
    family: "scaffold",
    weight: 7,
    severity: "high",
    title: "A social link points at the platform rather than at an account",
    rationale:
      "A footer icon row linking to instagram.com rather than to instagram.com/thebusiness is the " +
      "template's own placeholder. It looks finished, it is clickable, and it sends a visitor who " +
      "wanted to see the business to a login page instead. Nobody who built the site ever clicks " +
      "these, which is why they survive.",
    falsePositiveNote:
      "Wrong when the link is genuinely to the platform, for example a page explaining where to find " +
      "the business or a link to a platform's help documentation. Both are rare in a footer icon " +
      "row, which is where this almost always appears. A share button pointing at a platform's " +
      "intent URL carries a query string and is excluded.",
    prevention:
      "Build the social row from a configured map of platform to profile URL, and render nothing for " +
      "a platform with no profile, rather than rendering the icon with the platform's front page.",
    since: "tells-2026.09",
    detect: (f) => {
      const PLATFORMS = [
        "instagram.com", "facebook.com", "twitter.com", "x.com", "linkedin.com",
        "tiktok.com", "youtube.com", "pinterest.com", "threads.net", "yelp.com",
      ];
      return f.links.flatMap((l) => {
        const host = hostOf(l.href);
        if (!host) return [];
        const platform = PLATFORMS.find((p) => host === p || host === `www.${p}`);
        if (!platform) return [];
        /*
         * BARENESS IS DECIDED BY THE PATH ONLY, with the query and fragment
         * stripped, and getting there took a correction worth recording.
         *
         * The first version skipped any URL containing a `?`, on the reasoning
         * that a share or intent link carries a query string. A mutation deleting
         * that line SURVIVED, which exposed two things at once. The line was not
         * doing the job it claimed, because a share link is already excluded by
         * having a PATH: `twitter.com/intent/tweet` is not a bare host. And it was
         * actively harmful, because it also exempted
         * `instagram.com/?utm_source=footer`, which is still a link to the front
         * page of Instagram and still the template's placeholder.
         *
         * So the query is stripped rather than treated as a signal. A share link
         * is excluded by its path, and a front page with tracking parameters is
         * correctly reported.
         */
        const path = l.href
          .replace(/^(?:https?:)?\/\/[^/]+/i, "")
          .replace(/[?#].*$/, "");
        const bare = path === "" || path === "/";
        return bare
          ? [at(l.selector, `href=${quote(l.href)} is the front page of ${platform}, not an account`)]
          : [];
      });
    },
  },
  {
    id: "tells.no-favicon",
    family: "finish",
    weight: 6,
    severity: "medium",
    title: "The site declares no icon",
    rationale:
      "With no icon a browser tab shows a blank sheet of paper, and a bookmark or a phone home " +
      "screen shortcut shows the same. It is the detail that makes a site look like a document " +
      "somebody uploaded rather than a business, and it is visible every time anybody has the tab " +
      "open.",
    falsePositiveNote:
      "Wrong when a favicon.ico sits at the site root, which browsers request WITHOUT any link tag " +
      "and this probe cannot see because it reads a document rather than making requests. So a site " +
      "with a root favicon and no link tag is fine and this rule will still report it. Check for the " +
      "file before changing anything.",
    prevention:
      "Declare the icon explicitly with a link tag rather than relying on the root request, so it is " +
      "visible in the page and survives a move to a subdirectory or a CDN.",
    since: "tells-2026.09",
    detect: (f) =>
      f.icons.length === 0 || f.icons.every((i) => !i.href)
        ? [at("head", "no link tag with rel icon, shortcut icon, apple-touch-icon or mask-icon")]
        : [],
  },
  {
    id: "tells.no-share-image",
    family: "finish",
    weight: 6,
    severity: "medium",
    title: "The page has no image for when it is shared",
    rationale:
      "Without og:image, a link posted to a message, a group chat or a social platform renders as a " +
      "bare line of text while every link around it has a picture. That is the whole difference " +
      "between a link somebody taps and one they scroll past, and it is decided by one tag.",
    falsePositiveNote:
      "Wrong when a share image is supplied another way, for example a twitter:image tag alone or a " +
      "platform-specific card this rule does not read. It is also of no consequence on a page nobody " +
      "shares, such as a checkout step or an account settings screen, where the correct response is " +
      "to ignore it rather than to add an image.",
    prevention:
      "Set a site-wide default share image in the layout and override it per page where it matters, " +
      "so a new route is never shipped without one.",
    since: "tells-2026.09",
    detect: (f) => (f.ogImage ? [] : [at("head", "no og:image meta tag")]),
  },
  {
    id: "tells.bare-platform-domain",
    family: "finish",
    weight: 5,
    severity: "medium",
    title: "The site is published on the hosting platform's own subdomain",
    rationale:
      "A canonical URL ending in vercel.app or wixsite.com tells every visitor and every search " +
      "engine that no domain has been bought. It is not broken and it costs nothing technically, but " +
      "it is the single clearest signal that a site is a project rather than a business, and it is " +
      "in the address bar of every page.",
    falsePositiveNote:
      "A platform subdomain is a perfectly working public address and plenty of real businesses " +
      "operate on one, so this is a finish finding rather than a defect and is weighted accordingly. " +
      "Note the deliberate difference from `broken.development-host`, which asks whether a visitor " +
      "can reach the address and correctly says these are fine. This rule asks whether anybody " +
      "bought a domain. IT ALSO FIRES ON PROOF'S OWN SITE TODAY, and that is left in rather than " +
      "exempted.",
    prevention:
      "Buy the domain before the site is shown to anybody, and set the canonical to it, so the " +
      "address does not change once links to it exist.",
    since: "tells-2026.09",
    detect: (f) => {
      const out = [];
      for (const [label, url] of [["canonical", f.canonical], ["og:url", f.ogUrl]]) {
        const platform = platformHostFor(url);
        if (platform) out.push(at("head", `${label} is ${quote(url)}, a bare ${platform} subdomain`));
      }
      return out;
    },
  },
  {
    id: "tells.builder-generator-with-another-tell",
    family: "scaffold",
    weight: 5,
    severity: "medium",
    title: "A site builder's generator tag sits alongside another unfinished tell",
    rationale:
      "A generator tag naming a page builder is not a defect on its own: plenty of good sites are " +
      "built with one and are proud of it. It matters when it is the ONLY thing on the page that has " +
      "been filled in, because then it says the template was published rather than used.",
    falsePositiveNote:
      "This rule is deliberately CONDITIONAL and will not fire on a builder tag alone, because doing " +
      "so would report every Squarespace and Webflow site on the web as defective, which is both " +
      "wrong and insulting to the people running them. It requires a second, independent tell on the " +
      "same page. It is still wrong where that second tell is itself a false positive, so read both " +
      "findings together rather than either alone.",
    prevention:
      "Nothing needs doing about the generator tag. Fix the other finding this one is paired with; " +
      "this rule exists only to say the two together mean something the first does not.",
    since: "tells-2026.09",
    detect: (f) => {
      if (!f.generator) return [];
      if (!BUILDER_GENERATORS.some((re) => re.test(f.generator))) return [];
      /*
       * The second tell, computed here rather than taken from the report, because
       * a rule must not depend on whether another rule happened to run. The three
       * checked are the unambiguous ones: a scaffold title, placeholder copy, or
       * no icon at all.
       */
      const scaffoldTitle =
        f.title && SCAFFOLD_TITLES.has(f.title.toLowerCase().replace(/\s+/g, " ").trim());
      const placeholder = f.textBlocks.some((b) => PLACEHOLDER_COPY.some((re) => re.test(b.text)));
      const noIcon = f.icons.length === 0;
      const second = scaffoldTitle
        ? "the title is a framework default"
        : placeholder
          ? "placeholder copy is still on the page"
          : noIcon
            ? "the site declares no icon"
            : null;
      return second
        ? [at("head", `generator is ${quote(f.generator)} and ${second}`)]
        : [];
    },
  },
  {
    id: "tells.example-domain-link",
    family: "scaffold",
    weight: 8,
    severity: "high",
    title: "A link points at a documentation example domain",
    rationale:
      "example.com and its siblings are reserved by standard for use in documentation. A link to one " +
      "is a template's placeholder that was never replaced, and it takes a visitor to a page that " +
      "explains it is reserved for documentation, which is worse than a dead link because it looks " +
      "deliberate.",
    falsePositiveNote:
      "Wrong on a page that is itself documentation and is correctly using a reserved domain as an " +
      "example, which is exactly what those domains are for. Anywhere else, a link to one cannot be " +
      "intentional: the domains are reserved precisely so that they are never a real destination.",
    prevention:
      "Use a value from configuration for every outbound link, so an unset one renders nothing " +
      "rather than a documentation placeholder.",
    since: "tells-2026.09",
    detect: (f) => {
      const RESERVED = ["example.com", "example.org", "example.net", "example.edu"];
      return f.links.flatMap((l) => {
        const host = hostOf(l.href);
        if (!host) return [];
        const hit = RESERVED.find((r) => host === r || host.endsWith(`.${r}`));
        return hit ? [at(l.selector, `href=${quote(l.href)} on ${quote(l.text || "a link with no text", 40)}`)] : [];
      });
    },
  },
  {
    id: "tells.copyright-year-stale",
    family: "finish",
    weight: 6,
    severity: "medium",
    title: "The copyright year is years out of date",
    rationale:
      "A footer reading 2021 tells a visitor the site has not been touched in years, which for a " +
      "business raises the only question that matters: are they still open. It appears on every page " +
      "and it is the last thing on each of them.",
    falsePositiveNote:
      "Wrong on a page whose copyright genuinely dates a fixed work rather than the site, such as an " +
      "archived article or a document with its own date of publication. It is also wrong for a year " +
      "range like 2019 to 2026, and ranges are excluded. The threshold is two full years behind, not " +
      "one, so a site updated last year is never reported.",
    prevention:
      "Render the current year rather than writing it, and check that the value is computed at " +
      "request or build time rather than baked into a static export made years ago.",
    since: "tells-2026.09",
    detect: (f) => {
      const thisYear = new Date().getFullYear();
      return f.textBlocks.flatMap((b) => {
        // A copyright marker followed by a year, and NOT a range.
        const m = b.text.match(/(?:©|\(c\)|copyright)\s*([12][0-9]{3})(?!\s*(?:-|to|\u2013|\u2014)\s*[12][0-9]{3})/i);
        if (!m) return [];
        const year = Number(m[1]);
        if (!Number.isFinite(year) || year > thisYear) return [];
        return thisYear - year >= 2
          ? [at(b.selector, `copyright ${year}, which is ${thisYear - year} years behind: ${quote(b.text, 80)}`)]
          : [];
      });
    },
  },
  {
    id: "tells.em-dash-density",
    family: "copy",
    weight: 3,
    severity: "low",
    title: "Em dashes appear far more often than in ordinary business writing",
    rationale:
      "A high em dash rate is one of the more reliable textual signals that copy was generated " +
      "rather than written, because the character is common in generated prose and rare in what a " +
      "small business writes about itself. It is reported with the rate and the denominator so it " +
      "can be judged rather than believed.",
    falsePositiveNote:
      "Wrong on any writer who genuinely uses the em dash, which includes most publishers with a " +
      "style guide and a good many careful writers, and on any page reproducing edited prose such as " +
      "a press quote or an excerpt. This is a signal about STYLE, never about honesty, and it is " +
      "weighted at the bottom of the rulebook for that reason. It says nothing about whether the " +
      "copy is true or good.",
    prevention:
      "Nothing here needs fixing if the punctuation is deliberate. If the copy was generated, the " +
      "thing to change is the copy rather than the dashes.",
    since: "tells-2026.09",
    detect: (f) => {
      const words = f.counts.words;
      // A rate needs a denominator big enough to be a rate. Under this, one
      // quoted sentence with two dashes in it would clear any threshold.
      if (words < 300) return [];
      const dashes = (f.bodyText.match(EM_DASH) || []).length;
      const per1000 = (dashes / words) * 1000;
      return per1000 >= EM_DASH_PER_1000
        ? [
            at(
              "body",
              `${dashes} em dashes across ${words} words, a rate of ${per1000.toFixed(1)} per thousand ` +
                `against a threshold of ${EM_DASH_PER_1000}`,
            ),
          ]
        : [];
    },
  },
];
