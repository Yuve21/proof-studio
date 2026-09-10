/**
 * The `broken-things` corpus. The seventh rulebook, and the one whose findings a
 * customer can verify without knowing anything about the web.
 *
 * RULES ARE DATA. Everything that decides how much a finding matters is a field.
 * Only `detect` is a function. See `corpus/seo-onpage.mjs` for the shape and
 * `corpus/load.mjs` for the refusals that enforce it.
 *
 * THE DEPARTMENT WAS PLANNED AS A LINK CHECKER AND THIS IS NOT THAT. Deciding
 * whether a URL resolves needs a request, and the installed software makes none,
 * so that half can only ever run on our side and is documented as blocked rather
 * than quietly dropped. What is left turned out to be the more valuable half.
 *
 * WHAT IS LEFT IS THE THINGS THAT ARE ALREADY BROKEN IN THE BYTES THAT SHIPPED.
 * A page that says `Welcome, undefined`, a logo whose src is
 * `file:///C:/Users/someone/Desktop/logo.png`, a checkout link pointing at
 * `http://localhost:3000`, an unrendered `{{ business.name }}`. Every one of
 * these is visible in the delivered HTML, every one is certain rather than
 * inferred, and every one is the kind of defect that makes a visitor leave
 * without reading anything else. They also have a property no SEO finding has:
 * the person paying for the report can look at the quoted evidence and know
 * immediately that it is wrong, with no expertise at all.
 *
 * THEY ARE ALSO THE FINDINGS MOST LIKELY TO BE PRESENT ON A SITE SOMEBODY BUILT
 * QUICKLY, which is the whole customer base. A missing meta description means
 * somebody did not finish. `Welcome, undefined` means something failed and
 * nobody looked.
 *
 * WHAT THIS CORPUS CANNOT SEE, published rather than implied:
 *   - whether any URL resolves, whether an image exists at it, or what status
 *     code it returns. That needs a network request, which the no-egress rule
 *     forbids, and it is the reason this department is only half built here.
 *   - anything that appears only after JavaScript runs. This reads delivered
 *     HTML. A fragment target injected at runtime, or text rendered on the
 *     client, is invisible here, and the rules that could be wrong because of it
 *     say so in their own note rather than leaving it to this list.
 *   - whether a page LOOKS broken. Layout needs rendering, which a parser does
 *     not have, and `performance-engineer` and `mobile-experience` own it.
 */

export const CORPUS_ID = "broken-things";
export const CORPUS_VERSION = "broken-2026.09";

/**
 * NO REQUIRES_SUBJECT, for the same reason as `seo-technical`: there is no
 * subject whose absence would make this rulebook honestly silent. Every page has
 * text and almost every page has URLs, and the readability floor in
 * `report/run.mjs` already abstains on a shell, which is the case that arises.
 */

/**
 * The values a failed interpolation leaves behind. These are the string forms
 * JavaScript produces when something was not what the template expected, and
 * each one is a specific accident:
 *
 *   `undefined`         a property that was not there
 *   `null`              a value that was explicitly empty
 *   `NaN`               arithmetic on something that was not a number
 *   `[object Object]`   an object where a string belonged
 *   `Infinity`          division by zero, usually a percentage or an average
 *
 * They are matched as a WHOLE word in text, because "undefined" legitimately
 * appears in prose about programming and in our own documentation. That is why
 * the rule reads URL values and visible text through different patterns rather
 * than scanning everything with one.
 *
 * TWO VALUES ARE IN THE URL LIST AND NOT IN THE TEXT LIST, and the omissions are
 * the careful part:
 *
 *   `Infinity` is a real word and a real business name. "Infinity Pools" and
 *   "Infinity Salon" are the kind of customer this product is for, so matching
 *   it in visible text would open a report by telling somebody their own name is
 *   a bug. In a URL it is unambiguous, so it stays there.
 *
 *   `null` is a whole word in text far too often to be useful, in "null and
 *   void" and in any page discussing data, and unlike `undefined` it is short
 *   enough to appear inside ordinary strings. It stays in the URL list only.
 */
const FAILED_VALUES = ["undefined", "null", "NaN", "[object Object]", "Infinity"];

/** For visible text. Narrower than the URL list, for the reasons given above. */
const FAILED_IN_TEXT = /(^|[^A-Za-z0-9_])(undefined|NaN|\[object Object\])([^A-Za-z0-9_]|$)/;

/**
 * A failed value inside a URL. Anchored to a separator on both sides so that
 * `/nullify-the-contract` and `/undefinedly` are not reported: the first draft
 * used a bare `includes("/null")` and would have fired on both.
 */
const failedInUrl = (value) => {
  const v = value.trim();
  for (const bad of FAILED_VALUES) {
    if (v === bad) return bad;
    // A path segment or a query value that IS the failed string, and nothing more.
    const re = new RegExp(`[/=]${bad.replace(/[[\]]/g, "\\$&")}([/?#&]|$)`);
    if (re.test(v)) return bad;
  }
  return null;
};

/**
 * Template syntax that should have been replaced before the page was served.
 * Five families, because five template languages are in play across the tools a
 * small business site gets built with.
 */
const TEMPLATE_SYNTAX = [
  /\{\{[^}]{1,80}\}\}/, // Handlebars, Mustache, Vue, Angular
  /\$\{[^}]{1,80}\}/, // JavaScript template literal
  /<%[=-]?[\s\S]{1,80}?%>/, // EJS, ERB, ASP
  /\{%[^%]{1,80}%\}/, // Jinja, Liquid, Twig
  /\[\[[^\]]{1,80}\]\]/, // Polymer, some CMS placeholders
];

/** A host or address that only exists on the machine the site was built on. */
const LOCAL_ADDRESS = /^(https?:)?\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(:\d+)?(\/|$)/i;

/**
 * A hostname that is a development or preview environment.
 *
 * `vercel.app` IS DELIBERATELY ABSENT and that is the whole care in this rule.
 * A great many real small business sites are served from a vercel.app or
 * netlify.app subdomain as their actual public address, so reporting it would
 * fire on the customer's live site and tell them their real domain is a mistake.
 * Only hostnames that cannot be a public address are listed.
 */
const DEV_HOST = /^(https?:)?\/\/([^/]*\.)?(staging|preview|dev|test|qa|uat)\.[^/]+/i;
const TUNNEL_OR_MDNS = /^(https?:)?\/\/[^/]*\.(ngrok(-free)?\.(app|io)|loca\.lt|trycloudflare\.com|local|localhost)(:\d+)?(\/|$)/i;

/** A path from the filesystem of whoever built the page. */
const FILESYSTEM_PATH = /^(file:\/\/|[a-z]:[\\/]|\/(Users|home)\/[^/]+\/(Desktop|Downloads|Documents))/i;

/** Attributes whose value is a URL, which is what most of these rules read. */
const URL_ATTRS = ["href", "src", "action", "data", "poster", "formaction", "cite"];

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

  const URL_ATTRS = ["href", "src", "action", "data", "poster", "formaction", "cite"];

  /*
   * Every URL-bearing attribute on the page, with the element it sat on. Both
   * the attribute NAME and the tag are kept, because a finding that says
   * `href on <a>` is actionable and one that says "a URL is wrong" is not.
   */
  const urls = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    for (const name of URL_ATTRS) {
      if (!el.hasAttribute(name)) continue;
      urls.push({
        tag: el.tagName.toLowerCase(),
        attr: name,
        // NOT normalised: whitespace inside a URL is itself a defect and
        // trimming it here would hide it from the rules below.
        value: el.getAttribute(name) || "",
        rel: (el.getAttribute("rel") || "").toLowerCase(),
        selector: sel(el),
      });
    }
  }

  /*
   * Elements carrying their OWN text, rather than the text of their children.
   * Without that restriction every ancestor of a broken string reports it, so a
   * single `undefined` in a paragraph produces a finding on the paragraph, the
   * section, main and body. The locator has to be the smallest element that
   * actually contains the text.
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

  /*
   * Attribute values a visitor can READ: the accessible and hover text. A failed
   * interpolation in an alt or a title is as visible as one in a paragraph, and
   * it is the one nobody proofreads.
   */
  const readableAttrs = [];
  for (const el of Array.from(document.querySelectorAll("[alt],[title],[aria-label],[placeholder],[value]"))) {
    for (const name of ["alt", "title", "aria-label", "placeholder", "value"]) {
      if (!el.hasAttribute(name)) continue;
      const value = norm(el.getAttribute(name));
      if (value) readableAttrs.push({ attr: name, value, selector: sel(el) });
    }
  }

  const images = Array.from(document.querySelectorAll("img")).map((img) => ({
    hasSrc: img.hasAttribute("src"),
    src: img.getAttribute("src") || "",
    srcset: img.getAttribute("srcset") || "",
    width: img.getAttribute("width"),
    height: img.getAttribute("height"),
    selector: sel(img),
  }));

  // Fragment targets: what exists on the page to jump to, and what is aimed at it.
  const anchorTargets = new Set();
  for (const el of Array.from(document.querySelectorAll("[id]"))) anchorTargets.add(el.getAttribute("id"));
  for (const el of Array.from(document.querySelectorAll("a[name]"))) anchorTargets.add(el.getAttribute("name"));

  const bodyText = norm(document.body ? document.body.textContent : "");

  return {
    urls,
    textBlocks,
    readableAttrs,
    images,
    anchorTargets: Array.from(anchorTargets),
    counts: {
      urls: urls.length,
      textBlocks: textBlocks.length,
      readableAttributes: readableAttrs.length,
      images: images.length,
      anchorTargets: anchorTargets.size,
      bodyTextLength: bodyText.length,
    },
  };
};

const at = (selector, observed) => ({ selector, observed });

/** A URL value that is present and not just whitespace. */
const hasValue = (u) => u.value.trim().length > 0;

/** Quote a value short enough to read in a report. */
const quote = (s, n = 100) => JSON.stringify(s.length > n ? `${s.slice(0, n)}...` : s);

export const RULES = [
  {
    id: "broken.interpolation-failed",
    family: "rendering",
    weight: 10,
    severity: "high",
    title: "The page shows a value that failed to render",
    rationale:
      "undefined, null, NaN and [object Object] are what a template leaves behind when the value it " +
      "expected was not there. A visitor reads them as the site being broken, and they are right. " +
      "This is weighted at the top of the rulebook because it needs no expertise to confirm and no " +
      "expertise to judge: the quoted text is either on the page or it is not.",
    falsePositiveNote:
      "Wrong on a page that is ABOUT programming, where undefined and NaN are ordinary vocabulary, " +
      "which is why they are matched only as whole words and why a documentation site will still " +
      "trip this. It is also wrong when the text is rendered correctly by JavaScript after " +
      "delivery: this reads the HTML that arrived, so a placeholder replaced on the client looks " +
      "broken here and is not.",
    prevention:
      "Render nothing rather than a failed value. A template that cannot find a name should omit " +
      "the greeting, and a build that produces the literal string undefined in HTML should fail.",
    since: "broken-2026.09",
    detect: (f) => {
      const out = [];
      for (const b of f.textBlocks) {
        const m = b.text.match(FAILED_IN_TEXT);
        if (m) out.push(at(b.selector, `visible text contains ${quote(m[2])}: ${quote(b.text, 120)}`));
      }
      for (const a of f.readableAttrs) {
        const m = a.value.match(FAILED_IN_TEXT);
        if (m) out.push(at(a.selector, `${a.attr}=${quote(a.value)}`));
      }
      for (const u of f.urls) {
        const bad = failedInUrl(u.value);
        if (bad) out.push(at(u.selector, `${u.attr} on <${u.tag}> contains ${quote(bad)}: ${quote(u.value)}`));
      }
      return out;
    },
  },
  {
    id: "broken.template-syntax-unrendered",
    family: "rendering",
    weight: 10,
    severity: "high",
    title: "Template syntax reached the page unrendered",
    rationale:
      "Curly braces or angle-percent tags in the delivered HTML mean the template engine never ran " +
      "over that part of the page, or ran and could not resolve it. The visitor sees the source of " +
      "the site instead of the site. Like a failed interpolation, this is certain rather than " +
      "inferred and needs no expertise to confirm.",
    falsePositiveNote:
      "Wrong on documentation that DEMONSTRATES template syntax, which is a real and common page " +
      "type and will trip this rule every time. It is also wrong on a client-side framework that " +
      "resolves its own bindings in the browser after delivery, which is why the finding quotes the " +
      "surrounding text: a binding inside an app shell is expected, and the same string inside a " +
      "sentence of marketing copy is not.",
    prevention:
      "Make an unresolved placeholder a build failure rather than a runtime string. Most template " +
      "engines can be configured to throw on a missing key instead of emitting the tag.",
    since: "broken-2026.09",
    detect: (f) => {
      const out = [];
      const scan = (text, where, selector) => {
        for (const re of TEMPLATE_SYNTAX) {
          const m = text.match(re);
          if (m) {
            out.push(at(selector, `${where} contains ${quote(m[0], 60)}: ${quote(text, 120)}`));
            return;
          }
        }
      };
      for (const b of f.textBlocks) scan(b.text, "visible text", b.selector);
      for (const a of f.readableAttrs) scan(a.value, a.attr, a.selector);
      for (const u of f.urls) {
        for (const re of TEMPLATE_SYNTAX) {
          if (re.test(u.value)) {
            out.push(at(u.selector, `${u.attr} on <${u.tag}> is ${quote(u.value)}`));
            break;
          }
        }
      }
      return out;
    },
  },
  {
    id: "broken.local-address",
    family: "environment",
    weight: 10,
    severity: "high",
    title: "A URL points at the machine the site was built on",
    rationale:
      "localhost and 127.0.0.1 resolve to the visitor's own computer, so a link or an image pointing " +
      "there fails for everybody except the person who built the page, on whose machine it works " +
      "perfectly. That asymmetry is why it survives testing, and it is most often on a form action " +
      "or an API call, which means the thing that breaks is the thing that takes the money.",
    falsePositiveNote:
      "Wrong only on a page never intended to be public: a local development build, or a template " +
      "checked before deployment. If the file being checked is a production build, this rule cannot " +
      "be wrong about the address, because localhost has exactly one meaning and it is not the " +
      "server.",
    prevention:
      "Build every URL from one configured origin that differs by environment, and never from a " +
      "literal. A hardcoded localhost is a value that was correct once.",
    since: "broken-2026.09",
    detect: (f) =>
      f.urls
        .filter(hasValue)
        .filter((u) => LOCAL_ADDRESS.test(u.value.trim()))
        .map((u) => at(u.selector, `${u.attr} on <${u.tag}> is ${quote(u.value)}`)),
  },
  {
    id: "broken.filesystem-path",
    family: "environment",
    weight: 10,
    severity: "high",
    title: "A URL is a path on somebody's own computer",
    rationale:
      "A file:// URL or a path beginning with a drive letter or a home directory refers to the " +
      "filesystem of whoever wrote the page. It loads nothing for a visitor. It also publishes the " +
      "name of the account it came from, which is usually somebody's real name, into the page " +
      "source.",
    falsePositiveNote:
      "Wrong only on a page meant to be opened from disk rather than served, which is rare enough " +
      "to be worth confirming when it happens. On a served page this cannot be right: a visitor's " +
      "browser will not read a file from the author's Desktop, and no configuration makes it.",
    prevention:
      "Add images to the project and reference them by their served path. A file:// URL almost " +
      "always arrives from dragging a file into an editor or a visual builder.",
    since: "broken-2026.09",
    detect: (f) =>
      f.urls
        .filter(hasValue)
        .filter((u) => FILESYSTEM_PATH.test(u.value.trim()))
        .map((u) => at(u.selector, `${u.attr} on <${u.tag}> is ${quote(u.value)}`)),
  },
  {
    id: "broken.development-host",
    family: "environment",
    weight: 8,
    severity: "high",
    title: "A URL points at a staging or tunnel host",
    rationale:
      "A staging subdomain, an ngrok tunnel or a .local address is reachable by whoever set it up " +
      "and by nobody else, and the tunnel ones stop existing when the session that created them " +
      "ends. A visitor gets a failure whose cause is invisible from the page.",
    falsePositiveNote:
      "This rule deliberately does NOT list vercel.app or netlify.app, because a great many real " +
      "small business sites are served from one of those as their genuine public address and " +
      "reporting it would tell somebody their live domain is a mistake. Only hosts that cannot be a " +
      "public address are matched. It is still wrong on a site that genuinely operates a subdomain " +
      "called test or dev as a real service.",
    prevention:
      "Keep environment hostnames in configuration, never in content, and check a production build " +
      "for them before deploying rather than checking the running site afterwards.",
    since: "broken-2026.09",
    detect: (f) =>
      f.urls
        .filter(hasValue)
        /*
         * NO LOCALHOST GUARD HERE, and its absence is deliberate.
         *
         * This filter used to begin `if (LOCAL_ADDRESS.test(v)) return false`,
         * with a comment saying the local-address rule owns localhost so it is
         * not reported twice. A mutation deleting that line SURVIVED the whole
         * suite, which is how it was found to be dead: neither DEV_HOST nor
         * TUNNEL_OR_MDNS can match a bare localhost, because the first requires
         * a staging-style label and the second requires a dot before the host.
         * The line never changed an outcome, and the comment above it described
         * a protection that was not being applied.
         *
         * A guard nothing can observe is not a guard, so it is gone. The
         * property it was aiming at is real and is now asserted where a test CAN
         * see it: `broken.test.mjs` checks that the two rules are DISJOINT over a
         * list of addresses, which goes red if either pattern is ever widened to
         * overlap the other. See LEARNINGS P-22.
         */
        .filter((u) => {
          const v = u.value.trim();
          return DEV_HOST.test(v) || TUNNEL_OR_MDNS.test(v);
        })
        .map((u) => at(u.selector, `${u.attr} on <${u.tag}> is ${quote(u.value)}`)),
  },
  {
    id: "broken.image-has-no-source",
    family: "assets",
    weight: 8,
    severity: "high",
    title: "An image element has nothing to load",
    rationale:
      "An img with no src, an empty src, or a src of # renders as a broken image placeholder or as " +
      "nothing at all, depending on the browser. An empty src is worse than nothing: some browsers " +
      "resolve it to the page's own URL and request the whole page again as an image.",
    falsePositiveNote:
      "Wrong on an image whose src is set by JavaScript after delivery, which is how lazy loading " +
      "worked before the loading attribute existed and is still common. An img carrying a data-src " +
      "or a srcset is likely that case, and images with a srcset are excluded for exactly this " +
      "reason.",
    prevention:
      "Render no img element at all when there is no image, rather than one with an empty src. Use " +
      "the loading attribute for lazy loading instead of an empty src and a script.",
    since: "broken-2026.09",
    detect: (f) =>
      f.images
        .filter((img) => !img.srcset.trim())
        .filter((img) => !img.hasSrc || !img.src.trim() || img.src.trim() === "#")
        .map((img) =>
          at(
            img.selector,
            !img.hasSrc ? "<img> has no src attribute" : `<img src=${quote(img.src)}>`,
          ),
        ),
  },
  {
    id: "broken.empty-url",
    family: "assets",
    weight: 6,
    severity: "medium",
    title: "A URL attribute is present but empty",
    rationale:
      "An empty href or action is resolved against the current page, so the link goes nowhere " +
      "visible and the form submits to itself. Nothing appears broken and nothing works, which is " +
      "the combination that takes longest to find. On a form action it means submissions are lost.",
    falsePositiveNote:
      "An empty action IS a documented way to submit a form back to its own URL, so on a page that " +
      "handles its own submission this is correct and intentional. It is not correct on an anchor, " +
      "where an empty href produces a link to the current page with no indication that is what it " +
      "does.",
    prevention:
      "Treat an empty URL as a missing one at the point the value is built, and omit the attribute " +
      "rather than emitting it empty.",
    since: "broken-2026.09",
    detect: (f) =>
      f.urls
        .filter((u) => u.value.trim().length === 0)
        .map((u) => at(u.selector, `${u.attr} on <${u.tag}> is empty`)),
  },
  {
    id: "broken.fragment-target-missing",
    family: "navigation",
    weight: 6,
    severity: "medium",
    title: "A link jumps to a section that is not on the page",
    rationale:
      "A link to #pricing does nothing at all if no element on the page has that id. The click " +
      "registers, the page does not move, and a visitor concludes the site is broken rather than " +
      "that they missed something. It is the commonest result of renaming a section.",
    falsePositiveNote:
      "Wrong when the target is added by JavaScript after delivery, or when the fragment is meant " +
      "for a single-page router that reads it rather than for the browser's own scrolling. Both are " +
      "real. This reads the HTML that arrived, so anything created later is invisible to it.",
    prevention:
      "Generate in-page links from the same list that generates the sections, so a renamed section " +
      "cannot leave a link behind.",
    since: "broken-2026.09",
    detect: (f) => {
      const targets = new Set(f.anchorTargets);
      return f.urls
        .filter((u) => u.attr === "href")
        .map((u) => ({ u, v: u.value.trim() }))
        .filter(({ v }) => v.startsWith("#") && v.length > 1)
        .filter(({ v }) => {
          // A percent-encoded fragment is compared decoded, because the id in
          // the document is not encoded and comparing the two forms directly
          // would report every non-ASCII heading link as broken.
          let id = v.slice(1);
          try {
            id = decodeURIComponent(id);
          } catch {
            // A malformed escape is left as written; it is still a real target
            // name to compare, and throwing here would lose the whole page.
          }
          return !targets.has(id) && !targets.has(v.slice(1));
        })
        .map(({ u, v }) => at(u.selector, `href=${quote(v)} but no element on this page has that id`));
    },
  },
  {
    id: "broken.contact-link-empty",
    family: "navigation",
    weight: 7,
    severity: "high",
    title: "A contact link has no address or number in it",
    rationale:
      "mailto: with nothing after it opens an empty mail window, and tel: with no digits does " +
      "nothing. These are the two links a small business most needs to work, they are usually in " +
      "the header or footer of every page, and they are the least likely to be clicked by whoever " +
      "built the site.",
    falsePositiveNote:
      "Wrong when the address is filled in by JavaScript to frustrate address harvesting, which is " +
      "a real practice and produces exactly this markup. If a reported link works when clicked on " +
      "the live site, that is why, and the trade being made is that it also does not work for " +
      "anybody with scripts blocked.",
    prevention:
      "Build contact links from the same configured values the rest of the site uses, and treat an " +
      "empty one as a build failure since there is no case where an empty mailto is wanted.",
    since: "broken-2026.09",
    detect: (f) =>
      f.urls
        .filter((u) => u.attr === "href")
        .map((u) => ({ u, v: u.value.trim() }))
        .filter(({ v }) => {
          if (/^mailto:/i.test(v)) return !/^mailto:[^?]*@[^?]*\./i.test(v);
          if (/^tel:/i.test(v)) return (v.replace(/^tel:/i, "").match(/\d/g) || []).length < 5;
          return false;
        })
        .map(({ u, v }) => at(u.selector, `href=${quote(v)}`)),
  },
  {
    id: "broken.escaped-markup-in-text",
    family: "rendering",
    weight: 7,
    severity: "high",
    title: "HTML tags are being shown to the visitor as text",
    rationale:
      "A paragraph reading &lt;strong&gt;Open today&lt;/strong&gt; means content was escaped twice: " +
      "once when it was stored and again when it was rendered. The visitor sees the markup rather " +
      "than the formatting. It usually affects one field everywhere it appears, so it looks like a " +
      "site-wide problem to whoever reports it.",
    falsePositiveNote:
      "Wrong on any page that deliberately shows markup as an example, which includes documentation, " +
      "a tutorial and a code sample, and those will trip this rule. The finding quotes the " +
      "surrounding text so that case is obvious to a reader. It is also narrow on purpose: only a " +
      "handful of common tag names are matched, so escaped markup using an uncommon tag is missed " +
      "rather than guessed at.",
    prevention:
      "Escape once, at output. Storing pre-escaped HTML and escaping it again on the way out is the " +
      "usual cause, and it is fixed at the point of storage rather than in the template.",
    since: "broken-2026.09",
    detect: (f) => {
      // Narrow deliberately: a small set of tag names that carry no other
      // meaning as prose, so the rule misses rather than guesses.
      const ESCAPED = /&lt;\/?(p|div|span|strong|em|b|i|br|ul|ol|li|a|h[1-6]|img|table)\b/i;
      const LITERAL = /<\/?(p|div|span|strong|em|br|ul|li|h[1-6])>/i;
      const out = [];
      for (const b of f.textBlocks) {
        // textContent already decodes entities, so an escaped tag arrives here
        // as literal angle brackets. Both forms are tested because a
        // double-escaped one arrives still carrying &lt;.
        const m = b.text.match(ESCAPED) || b.text.match(LITERAL);
        if (m) out.push(at(b.selector, `visible text contains the tag ${quote(m[0])}: ${quote(b.text, 120)}`));
      }
      return out;
    },
  },
  {
    id: "broken.zero-dimension-image",
    family: "assets",
    weight: 4,
    severity: "low",
    title: "An image is sized to nothing",
    rationale:
      "A width or height of zero renders the image invisible while still downloading it, so the " +
      "visitor waits for something they never see. It is usually left over from hiding an element " +
      "by resizing it rather than by removing it.",
    falsePositiveNote:
      "Wrong on a tracking pixel or a beacon, which is deliberately sized to nothing and is doing " +
      "its job, and that is a common enough pattern that this rule is weighted low rather than " +
      "reported as serious. An image with no alt text and a zero dimension is almost certainly a " +
      "pixel rather than a defect.",
    prevention:
      "Hide an element with CSS or omit it, rather than by setting a dimension to zero, so the " +
      "browser can also skip the download.",
    since: "broken-2026.09",
    detect: (f) =>
      f.images
        .filter((img) => img.width === "0" || img.height === "0")
        .map((img) => at(img.selector, `<img width=${quote(String(img.width))} height=${quote(String(img.height))}>`)),
  },
  {
    id: "broken.doubled-path-separator",
    family: "assets",
    weight: 4,
    severity: "low",
    title: "A URL contains a doubled slash in its path",
    rationale:
      "A path like /assets//logo.png is what joining a base ending in a slash to a path starting " +
      "with one produces. Many servers tolerate it and some do not, and the ones that do not return " +
      "a not-found for an asset that exists, which makes the failure depend on hosting rather than " +
      "on the site.",
    falsePositiveNote:
      "Wrong wherever the doubled slash is meaningful or harmless, which is most servers, so this " +
      "is weighted low and reported as tidiness. The scheme's own two slashes and a " +
      "protocol-relative URL are both excluded, since neither is the case this describes.",
    prevention:
      "Join URL segments with a helper that collapses separators rather than by concatenating " +
      "strings, so a base path with or without a trailing slash produces the same result.",
    since: "broken-2026.09",
    detect: (f) =>
      f.urls
        .filter(hasValue)
        .map((u) => ({ u, v: u.value.trim() }))
        /*
         * OPAQUE SCHEMES HAVE NO PATH, so there is nothing here for this rule to
         * be about. Excluding them is not tidiness: this rule fired on our own
         * home page against an inline SVG favicon, because a `data:` URI carries
         * the whole SVG document in its body and that document contains
         * `http://www.w3.org/2000/svg`. The doubled slash was in somebody else's
         * namespace URL, embedded in an encoded image.
         */
        .filter(({ v }) => !/^(data|javascript|mailto|tel|blob|about):/i.test(v))
        // Strip the scheme and authority, so only the PATH is examined.
        .map(({ u, v }) => ({ u, v, path: v.replace(/^[a-z][a-z0-9+.-]*:/i, "").replace(/^\/\/[^/]*/, "") }))
        .filter(({ path }) => path.includes("//"))
        .map(({ u, v }) => at(u.selector, `${u.attr} on <${u.tag}> is ${quote(v)}`)),
  },
];
