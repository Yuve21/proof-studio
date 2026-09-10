/**
 * The `seo-technical` corpus. The sixth rulebook, and the one whose findings are
 * the most expensive per character of markup.
 *
 * RULES ARE DATA. Everything that decides how much a finding matters is a field.
 * Only `detect` is a function. See `corpus/seo-onpage.mjs` for the shape and
 * `corpus/load.mjs` for the refusals that enforce it.
 *
 * WHAT SEPARATES THIS DEPARTMENT FROM `seo-onpage`, since the boundary is not
 * obvious and a rule on the wrong side of it is a rule reported twice. `onpage`
 * is about what a page SAYS: titles, headings, descriptions, alt text, and
 * whether a canonical exists at all. `technical` is about whether the page can be
 * COLLECTED and which version of it counts: indexability, conflicting canonical
 * signals, redirects, whether links can be followed, whether subresources load
 * over a secure transport. There is exactly one shared subject, the canonical
 * link, and the split is that `onpage.canonical-missing` owns its absence while
 * everything about a canonical that is PRESENT and wrong is here.
 *
 * THESE ARE THE HIGHEST-STAKES FINDINGS IN THE WHOLE PRODUCT, which is why this
 * rulebook was built early. A missing meta description costs some clicks. A
 * `noindex` left on a production template removes the page from search entirely,
 * and it is a nineteen-character mistake that looks like configuration. Nothing
 * on the page changes. Nobody notices for a month.
 *
 * WHAT THIS CORPUS CANNOT SEE, published rather than implied:
 *   - `robots.txt` and `X-Robots-Tag`. The first is a different file and the
 *     second is an HTTP header, and this probe reads a document. A page with no
 *     `noindex` in its markup can still be excluded by either, so a clean result
 *     from this rulebook is not a statement that the page is indexable. That
 *     limitation is stated in the rationale of the rule it affects, not only
 *     here.
 *   - whether a canonical target, an hreflang target, or a subresource actually
 *     resolves. All three need a network request, which the no-egress rule
 *     forbids. `broken-things` owns that and it can only run on our side.
 *   - duplicate titles and descriptions ACROSS pages, which needs a crawl. This
 *     rulebook reads one document.
 *   - whether a page is slow. `performance-engineer` owns that and it needs
 *     rendering, which a parser does not have.
 *
 * ONE RULE DELIBERATELY NOT WRITTEN. A set of hreflang links with no `x-default`
 * is a common finding and Google RECOMMENDS rather than requires it, so a
 * deterministic rule reporting it would be reporting a preference as a defect.
 * It belongs to the advisory side of the department.
 */

export const CORPUS_ID = "seo-technical";
export const CORPUS_VERSION = "technical-2026.09";

/**
 * NO REQUIRES_SUBJECT, and that is a decision rather than an omission.
 *
 * Every other rulebook that declares one has a subject that can genuinely be
 * absent: a page can have no form, no structured data, no prose. Every HTML
 * document has a head and a set of links, so there is no subject whose absence
 * would make this rulebook silent for an honest reason. The readability floor in
 * `report/run.mjs` still applies and still abstains on a shell, which is the
 * case that actually arises here.
 */

/**
 * BCP 47 as a SHAPE rather than as a vocabulary, and the reason is the same one
 * that shaped `seo-structured-data`.
 *
 * The tempting check is a list of valid language subtags. ISO 639-1 has about a
 * hundred and eighty codes and I would be vendoring them from memory, so a code I
 * happened to miss would be reported as invalid, which is the direction that
 * accuses honest work. A page correctly marked up in Kannada is not a defect
 * because our list was short.
 *
 * The shape, by contrast, is published and closed: two or three letters, an
 * optional four-letter script, an optional two-letter or three-digit region,
 * separated by hyphens. `en_US` violates it. `en-US` does not. That is checkable
 * without knowing which languages exist.
 */
const BCP47_SHAPE = /^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|[0-9]{3}))?$/i;

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
  const attr = (el, name) => el.getAttribute(name);

  /*
   * Elements whose URL is a SUBRESOURCE the page loads, as opposed to a link a
   * person clicks. The distinction is the whole of
   * `technical.insecure-subresource`: an anchor to an http:// page is an
   * ordinary external link and reporting it would fire on most of the web, while
   * a script or stylesheet loaded over http is mixed content that a browser
   * blocks outright.
   *
   * Declared INSIDE collect rather than at module scope, because collect is
   * serialised into the page and cannot close over anything. A module-level copy
   * would be dead code sitting next to the live one, which is two spellings of a
   * single fact and nothing comparing them.
   */
  const SUBRESOURCE_ATTRS = [
    ["script", "src"], ["link", "href"], ["img", "src"], ["iframe", "src"],
    ["video", "src"], ["audio", "src"], ["source", "src"], ["track", "src"],
    ["embed", "src"], ["object", "data"], ["form", "action"],
  ];

  /*
   * Robots directives, from BOTH the generic and the crawler-specific meta names.
   * A page can carry `robots: index` and `googlebot: noindex` at the same time,
   * and the more specific one wins, so reading only `name="robots"` would miss
   * the case that actually removes the page from search.
   */
  const robots = Array.from(document.querySelectorAll("meta[name]"))
    .filter((m) => /^(robots|googlebot|bingbot|google)$/i.test(attr(m, "name") || ""))
    .map((m) => ({
      name: (attr(m, "name") || "").toLowerCase(),
      content: norm(attr(m, "content")).toLowerCase(),
      directives: norm(attr(m, "content"))
        .toLowerCase()
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      selector: sel(m),
    }));

  const canonicals = Array.from(document.querySelectorAll('link[rel~="canonical"]')).map((l) => ({
    href: norm(attr(l, "href")),
    selector: sel(l),
  }));

  const refreshes = Array.from(document.querySelectorAll("meta[http-equiv]"))
    .filter((m) => (attr(m, "http-equiv") || "").toLowerCase() === "refresh")
    .map((m) => ({ content: norm(attr(m, "content")), selector: sel(m) }));

  const subresources = SUBRESOURCE_ATTRS.flatMap(([tag, name]) =>
    Array.from(document.querySelectorAll(`${tag}[${name}]`)).map((el) => ({
      tag,
      attr: name,
      url: norm(attr(el, name)),
      // A preconnect or dns-prefetch is a hint, not a load, so the rel is kept
      // for the rule to reason about rather than filtered out here.
      rel: (attr(el, "rel") || "").toLowerCase(),
      selector: sel(el),
    })),
  );

  const anchors = Array.from(document.querySelectorAll("a")).map((a) => ({
    href: attr(a, "href"),
    hasHrefAttr: a.hasAttribute("href"),
    rel: (attr(a, "rel") || "").toLowerCase(),
    text: norm(a.textContent).slice(0, 60),
    selector: sel(a),
  }));

  const hreflangs = Array.from(document.querySelectorAll('link[rel~="alternate"][hreflang]')).map((l) => ({
    hreflang: norm(attr(l, "hreflang")),
    href: norm(attr(l, "href")),
    selector: sel(l),
  }));

  /*
   * Where the charset declaration sits, measured in bytes of markup before it.
   * The specification requires it inside the first 1024 bytes of the document,
   * and a declaration after that point is read too late to have decoded the
   * bytes it was meant to explain.
   */
  const headChildren = document.head ? Array.from(document.head.children) : [];
  let charsetIndex = -1;
  let charsetBefore = 0;
  let running = 0;
  headChildren.forEach((el, i) => {
    const isCharset =
      (el.tagName === "META" && el.hasAttribute("charset")) ||
      (el.tagName === "META" && (attr(el, "http-equiv") || "").toLowerCase() === "content-type");
    if (isCharset && charsetIndex === -1) {
      charsetIndex = i;
      charsetBefore = running;
    }
    running += (el.outerHTML || "").length;
  });

  return {
    robots,
    canonicals,
    refreshes,
    subresources,
    anchors,
    hreflangs,
    charset: {
      present: charsetIndex !== -1,
      // The offset is approximate by construction: it counts head markup only
      // and ignores the doctype and the html tag, which are a fixed small
      // prefix. Named here so a finding quoting it is not read as exact.
      bytesBefore: charsetBefore,
      selector: charsetIndex === -1 ? "head" : sel(headChildren[charsetIndex]),
    },
    counts: {
      robotsMetas: robots.length,
      canonicals: canonicals.length,
      subresources: subresources.length,
      links: anchors.length,
      hreflangEntries: hreflangs.length,
      bodyTextLength: norm(document.body ? document.body.textContent : "").length,
    },
  };
};

const at = (selector, observed) => ({ selector, observed });

/** Does this directive list exclude the page from an index? */
const excludesFromIndex = (directives) => directives.some((d) => d === "noindex" || d === "none");

export const RULES = [
  {
    id: "technical.noindex-on-page",
    family: "indexability",
    weight: 10,
    severity: "high",
    title: "The page tells search engines not to index it",
    rationale:
      "A noindex directive removes the page from search results completely. Nothing on the page " +
      "looks different, no error is raised, and traffic goes to zero over the following weeks, " +
      "which is slow enough that it gets attributed to something else. It is the highest-weighted " +
      "rule in this product because it is a nineteen-character mistake with a total effect, and it " +
      "usually arrives from a staging template that was copied rather than configured.",
    falsePositiveNote:
      "Wrong whenever the exclusion is intended, and there are several honest reasons for it: a " +
      "thank-you or order-confirmation page, a checkout step, a print view, a staging deployment, " +
      "or a paginated duplicate. This rule reports the directive rather than a mistake, so on a page " +
      "that should not be in search it is telling you the configuration is doing what you asked. " +
      "It also CANNOT see robots.txt or an X-Robots-Tag header, so a clean result here is not a " +
      "statement that the page is indexable.",
    prevention:
      "Set the directive from an explicit per-route value rather than a template default, and make " +
      "the production build fail if a route that should be public carries noindex.",
    since: "technical-2026.09",
    detect: (f) =>
      f.robots
        .filter((r) => excludesFromIndex(r.directives))
        .map((r) => at(r.selector, `meta name="${r.name}" content="${r.content}"`)),
  },
  {
    id: "technical.robots-directives-conflict",
    family: "indexability",
    weight: 7,
    severity: "high",
    title: "Two robots directives contradict each other",
    rationale:
      "When one tag says index and another says noindex, the outcome is decided by rules nobody on " +
      "the team is thinking about: the most restrictive directive usually wins, and a " +
      "crawler-specific name overrides the generic one. The page's indexability becomes an accident " +
      "rather than a decision, and it can change when a crawler changes.",
    falsePositiveNote:
      "Wrong when the contradiction is deliberate targeting, for example allowing one crawler and " +
      "excluding another, which is a real if unusual choice. It is also wrong to read this as a " +
      "prediction of which directive wins: this rule reports that two signals disagree, and " +
      "deliberately does not claim to know the outcome.",
    prevention:
      "Emit exactly one robots meta tag from one place. Two tags almost always mean two layouts " +
      "each adding their own, which is invisible until somebody views source.",
    since: "technical-2026.09",
    detect: (f) => {
      const out = [];
      // Contradiction inside a single tag, which is the case a per-tag check misses.
      for (const r of f.robots) {
        if (r.directives.includes("index") && excludesFromIndex(r.directives)) {
          out.push(at(r.selector, `one tag says both: content="${r.content}"`));
        }
      }
      // Contradiction between tags.
      const excluding = f.robots.filter((r) => excludesFromIndex(r.directives));
      const including = f.robots.filter((r) => r.directives.includes("index"));
      if (excluding.length > 0 && including.length > 0) {
        out.push(
          at(
            excluding[0].selector,
            `${including[0].name} says "${including[0].content}" and ${excluding[0].name} says ` +
              `"${excluding[0].content}"`,
          ),
        );
      }
      return out;
    },
  },
  {
    id: "technical.canonical-multiple",
    family: "canonical",
    weight: 8,
    severity: "high",
    title: "The page declares more than one canonical URL",
    rationale:
      "A canonical link says which URL is the real one. Two of them say nothing, and the documented " +
      "behaviour is that all of them are ignored, so the page falls back to whatever a crawler " +
      "decides. The effort that went into setting a canonical is spent and the signal is gone.",
    falsePositiveNote:
      "Wrong when both tags carry the SAME href, which is harmless duplication from two layouts and " +
      "worth tidying rather than fixing. This rule reports that case with both values quoted so the " +
      "difference is visible, and a reader can see immediately which of the two situations they are " +
      "in without opening the page.",
    prevention:
      "Render the canonical from one component that owns the whole head, and assert in a test that " +
      "a built page contains exactly one canonical link.",
    since: "technical-2026.09",
    detect: (f) =>
      f.canonicals.length > 1
        ? [
            at(
              f.canonicals[0].selector,
              `${f.canonicals.length} canonical links: ${f.canonicals
                .map((c) => JSON.stringify(c.href))
                .join(", ")}`,
            ),
          ]
        : [],
  },
  {
    id: "technical.canonical-relative",
    family: "canonical",
    weight: 6,
    severity: "medium",
    title: "The canonical URL is relative",
    rationale:
      "A canonical is resolved against the page it was found on, so a relative one cannot " +
      "disambiguate the two things it exists to disambiguate: the same page reached over http and " +
      "https, and the same page reached with and without a www prefix. A relative canonical " +
      "resolves to whichever version was crawled, which is the situation it was added to fix.",
    falsePositiveNote:
      "A relative canonical does resolve and is not invalid markup, so on a site served from a " +
      "single origin with redirects already forcing one scheme and one host, this is tidiness " +
      "rather than a defect. It is a real problem where those redirects are absent, and there is " +
      "nothing in the page that tells us which case this is.",
    prevention:
      "Build the canonical from a configured absolute origin rather than from the request, so it " +
      "cannot vary with how the page was reached.",
    since: "technical-2026.09",
    detect: (f) =>
      f.canonicals
        .filter((c) => c.href && !/^https?:\/\//i.test(c.href) && !c.href.startsWith("//"))
        .map((c) => at(c.selector, `canonical href=${JSON.stringify(c.href)}`)),
  },
  {
    id: "technical.meta-refresh-redirect",
    family: "crawlability",
    weight: 7,
    severity: "high",
    title: "The page redirects with a meta refresh",
    rationale:
      "A meta refresh is a redirect performed by the document rather than by the server. It is " +
      "slower, it is a documented accessibility failure because it moves people who are still " +
      "reading, and it passes its signals to the destination less reliably than an HTTP redirect. " +
      "It usually exists because whoever needed the redirect did not have access to the server " +
      "configuration.",
    falsePositiveNote:
      "Wrong when the refresh is a deliberate timed reload rather than a redirect, for example a " +
      "dashboard or a live scoreboard that refreshes itself with no url in the content attribute. " +
      "This rule fires only when the content names a destination, so a self-refresh is not reported.",
    prevention:
      "Move the redirect to the server or the edge as a 301 or 308. If that is not available, treat " +
      "it as a blocker rather than a workaround.",
    since: "technical-2026.09",
    detect: (f) =>
      f.refreshes
        .filter((r) => /url\s*=/i.test(r.content))
        .map((r) => at(r.selector, `meta http-equiv="refresh" content=${JSON.stringify(r.content)}`)),
  },
  {
    id: "technical.insecure-subresource",
    family: "transport",
    weight: 8,
    severity: "high",
    title: "The page loads a subresource over http",
    rationale:
      "A browser on an https page blocks an http script or stylesheet outright and warns about an " +
      "http image. The consequence is not a warning in a console, it is a feature that silently " +
      "does not work for every visitor while working perfectly for whoever tests the page over " +
      "http locally.",
    falsePositiveNote:
      "Wrong on a page that is genuinely served over http, where the subresource matches the page " +
      "and nothing is blocked. It is also wrong on a preconnect or dns-prefetch hint, which loads " +
      "nothing, and those are excluded. On any site with a certificate this rule is reporting a " +
      "resource that does not load for anybody.",
    prevention:
      "Reference subresources with a scheme-less path or an https URL, and add a content security " +
      "policy that blocks the rest, so a new one fails in development rather than in production.",
    since: "technical-2026.09",
    detect: (f) =>
      f.subresources
        .filter((s) => /^http:\/\//i.test(s.url))
        .filter((s) => !/(preconnect|dns-prefetch)/.test(s.rel))
        .map((s) => at(s.selector, `<${s.tag} ${s.attr}=${JSON.stringify(s.url.slice(0, 120))}>`)),
  },
  {
    id: "technical.link-not-crawlable",
    family: "crawlability",
    weight: 5,
    severity: "medium",
    title: "Something that looks like a link cannot be followed",
    rationale:
      "An anchor with no href, an href of #, or a javascript: href is not a link. It is not " +
      "followed by a crawler, it is not offered to a keyboard as a link, and it does not appear in " +
      "the site's structure. Whole sections of a site can be unreachable this way while looking " +
      "perfectly navigable to somebody with a mouse.",
    falsePositiveNote:
      "Wrong on an anchor that is genuinely a control rather than a link: a tab, a disclosure " +
      "toggle, a dropdown trigger. Those are not defects here, they are defects of element choice, " +
      "and `accessibility` reports the part that affects people. If a reported anchor is a button, " +
      "the fix is to make it a button, and this rule is still pointing at something real.",
    prevention:
      "Use a real href for anything that navigates and a button element for anything that does not. " +
      "An href of # is almost always a placeholder that survived.",
    since: "technical-2026.09",
    detect: (f) =>
      f.anchors
        .filter((a) => !a.hasHrefAttr || a.href === "#" || /^javascript:/i.test(a.href || ""))
        .map((a) =>
          at(
            a.selector,
            `${a.hasHrefAttr ? `href=${JSON.stringify(a.href)}` : "no href attribute"} on ` +
              `${a.text ? JSON.stringify(a.text) : "an anchor with no text"}`,
          ),
        ),
  },
  {
    id: "technical.internal-link-nofollow",
    family: "crawlability",
    weight: 4,
    severity: "low",
    title: "An internal link is marked nofollow",
    rationale:
      "nofollow on a link to your own site asks crawlers not to follow it, which is almost never " +
      "what somebody meant. It is usually copied from advice about outbound links, or applied " +
      "globally by a plugin, and its effect is to make part of the site harder to discover for no " +
      "benefit.",
    falsePositiveNote:
      "Wrong when the exclusion is deliberate, which does happen on a login link, a faceted filter " +
      "that generates near-infinite URLs, or a paid placement that has to be marked. This rule only " +
      "looks at RELATIVE hrefs, so it cannot mistake an external link for an internal one, but it " +
      "cannot tell a deliberate exclusion from an accidental one either.",
    prevention:
      "Apply nofollow per link where there is a reason for it, never as a site-wide default, and " +
      "prefer marking paid links with rel=sponsored so the intent is recorded.",
    since: "technical-2026.09",
    detect: (f) =>
      f.anchors
        .filter((a) => /\bnofollow\b/.test(a.rel))
        .filter((a) => a.href && !/^(https?:)?\/\//i.test(a.href) && !/^(mailto|tel|javascript):/i.test(a.href))
        .map((a) => at(a.selector, `rel="${a.rel}" on internal href=${JSON.stringify(a.href)}`)),
  },
  {
    id: "technical.hreflang-malformed",
    family: "internationalisation",
    weight: 6,
    severity: "medium",
    title: "An hreflang value is not a well-formed language tag",
    rationale:
      "A malformed hreflang value is ignored in full, so the page it points at is not associated " +
      "with the language it was meant to serve. The most common form is an underscore instead of a " +
      "hyphen, which is what a locale looks like in most programming languages and is not what a " +
      "language tag looks like.",
    falsePositiveNote:
      "This rule checks the SHAPE of the tag, not whether the language exists, and that is " +
      "deliberate: vendoring a list of valid subtags from memory would report a correctly marked-up " +
      "page in a language we happened to omit. So it is wrong in one direction only, by staying " +
      "quiet on a well-shaped tag that names no real language, such as zz-ZZ.",
    prevention:
      "Generate hreflang values from the same locale identifiers the application already uses, " +
      "converting underscores to hyphens in one place, and keep x-default spelled exactly.",
    since: "technical-2026.09",
    detect: (f) =>
      f.hreflangs
        .filter((h) => h.hreflang.toLowerCase() !== "x-default" && !BCP47_SHAPE.test(h.hreflang))
        .map((h) =>
          at(
            h.selector,
            `hreflang=${JSON.stringify(h.hreflang)}${
              h.hreflang.includes("_") ? " (an underscore where a hyphen belongs)" : ""
            }`,
          ),
        ),
  },
  {
    id: "technical.hreflang-duplicate",
    family: "internationalisation",
    weight: 6,
    severity: "medium",
    title: "The same hreflang value points at two different URLs",
    rationale:
      "One language tag can only name one page. Declared twice with different targets, the set is " +
      "contradictory and the usual outcome is that the whole cluster is discarded, which loses the " +
      "association for every language on the page rather than only the duplicated one.",
    falsePositiveNote:
      "Wrong when the two URLs are the same page reached differently, for example one with a " +
      "trailing slash and one without, which is a redirect problem wearing this rule's clothes. " +
      "Both values are quoted in the finding so that case is visible immediately rather than " +
      "requiring somebody to open the page.",
    prevention:
      "Build the hreflang set from one map of locale to URL, so a duplicate key is impossible " +
      "rather than merely unlikely.",
    since: "technical-2026.09",
    detect: (f) => {
      const byTag = new Map();
      for (const h of f.hreflangs) {
        const key = h.hreflang.toLowerCase();
        if (!byTag.has(key)) byTag.set(key, []);
        byTag.get(key).push(h);
      }
      return [...byTag.entries()]
        .filter(([, entries]) => new Set(entries.map((e) => e.href)).size > 1)
        .map(([tag, entries]) =>
          at(entries[0].selector, `hreflang="${tag}" points at ${entries.map((e) => JSON.stringify(e.href)).join(" and ")}`),
        );
    },
  },
  {
    id: "technical.charset-missing-or-late",
    family: "encoding",
    weight: 5,
    severity: "medium",
    title: "The character encoding is undeclared or declared too late",
    rationale:
      "A browser has to decide how to decode the bytes before it can read them, so the declaration " +
      "has to arrive in the first 1024 bytes. Without it the browser guesses, and the guess is " +
      "usually right for English and usually wrong for a name with an accent in it, which is how a " +
      "page ends up displaying a business owner's own name incorrectly.",
    falsePositiveNote:
      "Wrong when the encoding is declared in a Content-Type response header, which this probe " +
      "cannot see because it reads a document rather than a response. A page with a correct header " +
      "and no meta tag is fine, and this rule will still report it. The byte offset it quotes is " +
      "also approximate: it counts head markup only.",
    prevention:
      "Put the charset meta tag first inside head, before the title and before any other tag. It is " +
      "the one element whose position is load-bearing.",
    since: "technical-2026.09",
    detect: (f) => {
      if (!f.charset.present) return [at("head", "no charset meta tag and no content-type equivalent in head")];
      if (f.charset.bytesBefore > 1024) {
        return [
          at(
            f.charset.selector,
            `the charset declaration sits about ${f.charset.bytesBefore} bytes into head, past the ` +
              `1024-byte limit`,
          ),
        ];
      }
      return [];
    },
  },
];
