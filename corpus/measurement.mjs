/**
 * The `measurement` corpus: whether the numbers exist at all.
 *
 * WHY THIS IS THE FIRST COMMERCIAL DEPARTMENT TO SHIP, ahead of six that sound
 * more commercial. Every reporting seat in the plan produces a number, and a
 * number with no denominator behind it is this house's named defect. `seo-reporting`
 * exists "to stop the department grading its own homework", which presumes
 * somebody has checked that the homework was recorded. Nobody had. This seat owns
 * the denominator itself, and until it runs, every monthly report we sell is a
 * claim about traffic we have not confirmed anyone is counting.
 *
 * It is also the cheapest honest thing to sell. A client paying monthly for
 * "we watch your site" and having no analytics installed is paying for a report
 * whose numbers cannot exist, and that is discoverable from the bytes of one page
 * in about a millisecond.
 *
 * WHAT THIS CAN AND CANNOT SEE, said plainly because the temptation here is to
 * imply more:
 *
 *   CAN   a tag's presence, its configured id, a meta CSP that would block it,
 *         a consent UI sitting next to an unconditional tag, a policy page naming
 *         tools the page does not load and loading tools it does not name.
 *   CANNOT whether a tag actually FIRES, whether events reach the property,
 *         whether the property is the client's own, or whether anybody reads it.
 *         All four need a network request, and the installed side makes none.
 *
 * So every rule below is about the WIRING, never the data. A finding here says
 * "this cannot be measuring what you think" and never "your traffic is wrong".
 *
 * NO `REQUIRES_SUBJECT`, DELIBERATELY, AND IT IS THE OPPOSITE CHOICE FROM
 * `forms-and-capture`. That corpus abstains when a page has no form, because a
 * rulebook about forms has nothing to say about a page without one. Here the
 * absence IS the finding: a page with no analytics script is exactly the page
 * this department exists to report on. Requiring a subject would make the most
 * valuable case abstain silently, which is the same defect in the other
 * direction.
 */

export const CORPUS_ID = "measurement";
export const CORPUS_VERSION = "measurement-2026.09";

/**
 * Analytics and tag tools, by the host they load from and the name a privacy
 * policy would call them.
 *
 * VENDORED AS DATA rather than as a regex over "analytics", and compared in both
 * directions by the policy rule below. A hand-written pattern for somebody else's
 * product names is a guess about their naming, and a guess that fails silently
 * reads as a clean result.
 */
const TOOLS = [
  { id: "ga4", label: "Google Analytics", hosts: ["googletagmanager.com/gtag/js", "google-analytics.com"], general: true, policyNames: [/google analytics/i, /\bga4\b/i, /gtag/i] },
  { id: "gtm", label: "Google Tag Manager", hosts: ["googletagmanager.com/gtm.js"], general: false, policyNames: [/google tag manager/i, /\bgtm\b/i] },
  { id: "plausible", label: "Plausible", hosts: ["plausible.io"], general: true, policyNames: [/plausible/i] },
  { id: "fathom", label: "Fathom", hosts: ["usefathom.com"], general: true, policyNames: [/fathom/i] },
  { id: "umami", label: "Umami", hosts: ["umami.is"], general: true, policyNames: [/umami/i] },
  { id: "posthog", label: "PostHog", hosts: ["posthog.com", "i.posthog.com"], general: true, policyNames: [/posthog/i] },
  { id: "matomo", label: "Matomo", hosts: ["matomo.cloud", "matomo.php", "piwik"], general: true, policyNames: [/matomo/i, /piwik/i] },
  { id: "mixpanel", label: "Mixpanel", hosts: ["mixpanel.com"], general: true, policyNames: [/mixpanel/i] },
  { id: "amplitude", label: "Amplitude", hosts: ["amplitude.com"], general: true, policyNames: [/amplitude/i] },
  { id: "hotjar", label: "Hotjar", hosts: ["hotjar.com"], general: false, policyNames: [/hotjar/i] },
  { id: "clarity", label: "Microsoft Clarity", hosts: ["clarity.ms"], general: false, policyNames: [/clarity/i] },
  { id: "meta-pixel", label: "Meta Pixel", hosts: ["connect.facebook.net"], general: false, policyNames: [/meta pixel/i, /facebook pixel/i] },
  { id: "vercel-analytics", label: "Vercel Analytics", hosts: ["/_vercel/insights", "va.vercel-scripts.com"], general: true, policyNames: [/vercel analytics/i] },
];

/** Placeholder measurement ids that ship in templates and tutorials. */
const PLACEHOLDER_IDS = [
  /G-XXXXXXX/i, /UA-XXXXX/i, /GTM-XXXXXX/i, /\bYOUR[_-]?(?:GA|TRACKING|MEASUREMENT)[_-]?ID\b/i,
  /\bG-0{4,}\b/, /%NEXT_PUBLIC_[A-Z_]*(?:GA|ANALYTICS)[A-Z_]*%/i,
  /\{\{\s*[A-Z_]*(?:GA|ANALYTICS|MEASUREMENT)[A-Z_]*\s*\}\}/i,
];

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

  const scripts = Array.from(document.querySelectorAll("script")).map((s) => ({
    src: s.getAttribute("src") || "",
    type: (s.getAttribute("type") || "").toLowerCase(),
    // A tag a consent tool controls is usually marked, either by a blocking type
    // or by an attribute the CMP reads. Recorded rather than judged here.
    consentAttrs: Array.from(s.attributes || [])
      .map((a) => a.name.toLowerCase())
      .filter((n) => /consent|cookie|cmp|klaro|osano|cookiebot|iubenda|data-category|data-cookieconsent/.test(n)),
    inline: (s.textContent || "").slice(0, 4000),
    selector: sel(s),
  }));

  const metaCsp =
    document.querySelector('meta[http-equiv="Content-Security-Policy" i]')?.getAttribute("content") || "";

  const verification = Array.from(document.querySelectorAll("meta[name]"))
    .map((m) => (m.getAttribute("name") || "").toLowerCase())
    .filter((n) => /site-verification|verify-v1|verification/.test(n));

  const bodyText = (document.body?.innerText || document.body?.textContent || "").replace(/\s+/g, " ");
  const title = (document.title || "") + " " + (document.querySelector("h1")?.textContent || "");

  return {
    scripts,
    metaCsp,
    verification,
    bodyText: bodyText.slice(0, 200000),
    // Heuristic, and used ONLY to scope the policy rule. A page that calls itself
    // a privacy or cookie policy is the one page where naming your tools is the
    // point, so it is the only page where a mismatch is a finding rather than a
    // guess about where the policy lives.
    isPolicyPage: /privacy|cookie/i.test(title) || /\bprivacy policy\b|\bcookie policy\b/i.test(bodyText.slice(0, 4000)),
    hasConsentUi:
      Boolean(document.querySelector('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i]')) ||
      /\b(accept all cookies|manage cookies|we use cookies|cookie preferences)\b/i.test(bodyText.slice(0, 20000)),
    consentUiSelector:
      sel(
        document.querySelector('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i]') ||
          document.documentElement,
      ),
    /*
     * `counts.bodyTextLength` is REQUIRED by report/run.mjs, which reads it before
     * any rule result is published and withholds the whole report on a shell page.
     * Omitting it does not degrade the report, it throws, so every corpus owes it.
     */
    counts: {
      scripts: scripts.length,
      bodyTextLength: bodyText.length,
    },
  };
};

const at = (selector, observed) => ({ selector, observed });

/** Which tools this page actually loads, by src or by inline reference. */
const loaded = (f) =>
  TOOLS.filter((t) =>
    f.scripts.some(
      (s) => t.hosts.some((h) => s.src.includes(h)) || t.hosts.some((h) => s.inline.includes(h)),
    ),
  );

export const RULES = [
  {
    id: "measurement.nothing-is-counting",
    family: "denominator",
    weight: 9,
    severity: "high",
    title: "No analytics of any kind is installed, so no report about this site can have a denominator",
    rationale:
      "Every monthly report a client pays for rests on a number somebody recorded. With no tag on " +
      "the page, there is nothing recording, and any figure quoted later came from somewhere other " +
      "than this site. This is the cheapest possible finding and the most expensive one to discover " +
      "six months into a retainer.",
    falsePositiveNote:
      "Wrong when measurement is server-side, which is increasingly common and completely legitimate: " +
      "log-based analytics, a reverse proxy, Cloudflare Web Analytics injected at the edge, or a tag " +
      "injected by a platform after this file was built. None of those appear in the bytes here. It " +
      "is also wrong for a page deliberately excluded from measurement, such as a thank-you page " +
      "kept out of the funnel. Read it as: nothing in THIS FILE counts anything, so confirm what does.",
    prevention:
      "Install one analytics tool and confirm it reports, or write down where the numbers actually " +
      "come from so the monthly report can cite a source instead of implying one.",
    since: "measurement-2026.09",
    detect: (f) => (loaded(f).length === 0 ? [at("head", `${f.scripts.length} script(s) on the page, none of them a known analytics or tag tool`)] : []),
  },

  {
    id: "measurement.placeholder-id",
    family: "denominator",
    weight: 9,
    severity: "high",
    title: "A tag is installed with a placeholder id, so it is reporting into nothing",
    rationale:
      "A tag carrying G-XXXXXXX or YOUR_TRACKING_ID is the template's example value. It loads, it " +
      "runs, it looks installed in every screenshot, and it sends to no property. This is worse than " +
      "having no analytics, because everybody believes the numbers are being collected.",
    falsePositiveNote:
      "Wrong when the real id is injected at runtime from an environment variable and the placeholder " +
      "is the fallback in the source. That is a real pattern, and it is also exactly how a site ships " +
      "to production with the fallback live, so the finding stands and asks you to confirm which one " +
      "the deployed page carries.",
    prevention:
      "Put the real measurement id in, then load the deployed page and confirm a hit arrives in the " +
      "property. An id you have not seen receive a hit is not installed.",
    since: "measurement-2026.09",
    detect: (f) =>
      f.scripts
        .filter((s) => PLACEHOLDER_IDS.some((re) => re.test(s.inline) || re.test(s.src)))
        .map((s) => at(s.selector, `analytics tag carrying a placeholder id: ${(s.inline.match(/G-[A-Z0-9X]+|UA-[0-9X-]+|GTM-[A-Z0-9X]+|YOUR[_-]?\w*ID/i) || [s.src])[0]}`)),
  },

  {
    id: "measurement.two-tools-counting-the-same-thing",
    family: "agreement",
    weight: 5,
    severity: "medium",
    title: "Two general-purpose analytics tools are installed, and they will not agree",
    rationale:
      "Two tools counting the same visits produce two different numbers, because they differ on bot " +
      "filtering, session length, consent handling and what a pageview is. Nobody reconciles them; " +
      "people quote whichever is higher. A report that cites one without saying which is a report " +
      "whose denominator moves.",
    falsePositiveNote:
      "Deliberately wrong during a migration, which is a normal and correct reason to run two for a " +
      "few weeks. It is also wrong when one is scoped to a subdomain or a single funnel. The fix is " +
      "usually to name which one is canonical rather than to remove either.",
    prevention:
      "Name one tool as the source of truth for reported numbers, and say so wherever those numbers " +
      "are published. Keep the second if it earns its place.",
    since: "measurement-2026.09",
    detect: (f) => {
      const general = loaded(f).filter((t) => t.general);
      return general.length > 1
        ? [at("head", `${general.length} general-purpose analytics tools on one page: ${general.map((t) => t.label).join(", ")}`)]
        : [];
    },
  },

  {
    id: "measurement.csp-blocks-its-own-tag",
    family: "delivery",
    weight: 8,
    severity: "high",
    title: "A Content-Security-Policy on this page cannot permit the analytics host it loads",
    rationale:
      "A script-src directive that does not list the analytics host stops the browser fetching it. " +
      "The tag is in the HTML, the site looks instrumented to anybody reading the source, and the " +
      "browser refuses it silently to everyone except whoever opens the console.",
    falsePositiveNote:
      "Only the META policy is read here. A CSP sent as an HTTP header is the more common case and is " +
      "invisible to a parser, so a page with a header policy shows nothing and a page with both may " +
      "be governed by the header instead. This rule therefore finds a real subset and never claims " +
      "the absence of one means the CSP is fine.",
    prevention:
      "Add the analytics host to script-src and connect-src, then load the page and confirm the " +
      "request is made rather than blocked.",
    since: "measurement-2026.09",
    detect: (f) => {
      if (!f.metaCsp) return [];
      const scriptSrc = (f.metaCsp.match(/script-src([^;]*)/i) || [])[1];
      if (!scriptSrc) return [];
      if (/\*(?!\.)|'unsafe-inline'\s*\*/.test(scriptSrc)) return [];
      return loaded(f)
        .filter((t) => !t.hosts.some((h) => scriptSrc.includes(h.split("/")[0])))
        .map((t) => at("meta[http-equiv=Content-Security-Policy]", `${t.label} is loaded, and script-src does not list its host: script-src${scriptSrc}`));
    },
  },

  {
    id: "measurement.consent-ui-with-unconditional-tag",
    family: "consent",
    weight: 7,
    severity: "high",
    title: "A cookie banner is on the page and the analytics tag loads regardless",
    rationale:
      "A banner asking permission next to a tag that never waited for it is the shape regulators and " +
      "customers both treat as the bad case: the site collected first and asked after. It is also a " +
      "measurement problem, because consent-mode numbers and unconditional numbers are different " +
      "populations and mixing them makes a trend meaningless.",
    falsePositiveNote:
      "Wrong when the consent tool blocks tags at the network layer rather than by marking them, which " +
      "several CMPs do, and wrong when the tag is a cookieless analytics product that legitimately " +
      "needs no consent. The check looks for a consent-related attribute or a blocking script type on " +
      "the tag itself, so a correctly wired CMP that marks its tags does not fire.",
    prevention:
      "Gate the tag behind the consent decision, or drop the banner if the tool genuinely sets no " +
      "cookies and you can say so. A banner that changes nothing is worse than no banner.",
    since: "measurement-2026.09",
    detect: (f) => {
      if (!f.hasConsentUi) return [];
      const tags = f.scripts.filter(
        (s) =>
          TOOLS.some((t) => t.hosts.some((h) => s.src.includes(h) || s.inline.includes(h))) &&
          s.consentAttrs.length === 0 &&
          !/text\/plain|javascript\/blocked/.test(s.type),
      );
      return tags.map((s) => at(s.selector, `a consent UI is present and this tag carries no consent attribute or blocking type: ${s.src || "inline tag"}`));
    },
  },

  {
    id: "measurement.policy-and-page-disagree",
    family: "consent",
    weight: 6,
    severity: "medium",
    title: "This policy page names tools it does not load, or loads tools it does not name",
    rationale:
      "A privacy or cookie policy is a published claim about what the site collects, and this house's " +
      "standing rule is that a published claim needs something true behind it. Both directions are " +
      "wrong in the same way: naming a tool you removed overstates collection, and loading one you " +
      "never named understates it.",
    falsePositiveNote:
      "Scoped to a page that calls itself a privacy or cookie policy, and compared only against the " +
      "tools loaded on THAT page. A site that loads its pixel only on the checkout will look like an " +
      "unnamed absence here, which is why the finding says what it compared. It also cannot see tools " +
      "a tag manager loads at runtime, and a policy that names them is correct even though nothing " +
      "on the page matches.",
    prevention:
      "Reconcile the list in the policy with the tags that actually ship, in both directions, and " +
      "date the policy so the next reconciliation has a starting point.",
    since: "measurement-2026.09",
    detect: (f) => {
      if (!f.isPolicyPage) return [];
      const here = loaded(f);
      const named = TOOLS.filter((t) => t.policyNames.some((re) => re.test(f.bodyText)));
      const out = [];
      for (const t of named) {
        if (!here.some((l) => l.id === t.id)) out.push(at("body", `the policy names ${t.label}, and this page does not load it`));
      }
      for (const t of here) {
        if (!named.some((n) => n.id === t.id)) out.push(at("head", `this page loads ${t.label}, and the policy text does not name it`));
      }
      return out;
    },
  },

  {
    id: "measurement.no-search-console-verification",
    family: "denominator",
    weight: 3,
    severity: "low",
    title: "No search-console verification token, so nobody can see what this site ranks for",
    rationale:
      "Analytics says what happened after somebody arrived. Search Console is the only place the " +
      "queries, impressions and positions live, and it is free. Without verification, every claim " +
      "about search performance in a monthly report is unsourced.",
    falsePositiveNote:
      "Frequently wrong, and low weight for that reason: verification by DNS record or by an uploaded " +
      "HTML file is at least as common as the meta tag, and neither is visible in this file. Treat it " +
      "as a prompt to confirm verification exists somewhere, not as evidence that it does not.",
    prevention:
      "Verify the property once, by whichever method you prefer, and record which method was used so " +
      "the next person does not re-verify it.",
    since: "measurement-2026.09",
    detect: (f) => (f.verification.length === 0 ? [at("head", "no site-verification meta tag of any provider")] : []),
  },
];
