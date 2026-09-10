/**
 * The `seo-structured-data` corpus. The fifth rulebook, and the second one to
 * lean on a vendored vocabulary rather than on a pattern we invented.
 *
 * RULES ARE DATA. Everything that decides how much a finding matters is a field.
 * Only `detect` is a function. See `corpus/seo-onpage.mjs` for the shape and
 * `corpus/load.mjs` for the refusals that enforce it.
 *
 * WHY STRUCTURED DATA IS A GOOD FIT FOR A DETERMINISTIC RULEBOOK, and this is
 * the reason it was built before the departments that need a browser: the input
 * is JSON that the site published on purpose, so almost every finding here is a
 * comparison between two things that are both in front of us. There is very
 * little inference. A block that does not parse does not parse. A `@type` of
 * `"localbusiness"` is not the type `LocalBusiness`, and schema.org types are
 * case-sensitive. Those are facts, not opinions about search results.
 *
 * THE ONE PLACE THIS COULD HAVE GONE WRONG, and it is worth naming because the
 * obvious rule is the unsound one. The tempting check is "is this @type a real
 * schema.org type", and we cannot write it. schema.org publishes more than eight
 * hundred types and the vendored list in `corpus/schema-org-vocabulary.mjs` is a
 * subset, so absence from our list is not evidence of anything. A rule of that
 * shape would report a real type as invalid because we had not heard of it, and
 * that is the direction that accuses honest work. What is sound from a subset is
 * a check that only fires on a POSITIVE match, which is why the only use of the
 * type list here is the case comparison.
 *
 * WHAT THIS CORPUS CANNOT SEE, published rather than implied:
 *   - MICRODATA AND RDFa. Only JSON-LD is evaluated. Microdata blocks are
 *     counted so a microdata-only page is not silently treated as having no
 *     structured data, but no rule reads them, and the abstention says so.
 *   - whether a URL in the markup resolves, whether an image exists at it, or
 *     whether an `@id` reference points at a node that exists on another page.
 *     All three need a network request, which the no-egress rule forbids.
 *   - whether the markup is ELIGIBLE for a rich result. Eligibility is Google's
 *     decision and it is not a property of the page. No rule here claims it.
 *   - whether a rating is honest. Rule `sd.aggregate-rating-not-on-page` reports
 *     that a number is absent from the page, which is a fact. It does not and
 *     may not say the rating is invented.
 */

import {
  TYPES_BY_LOWERCASE,
  REQUIRED_PROPERTIES,
  SELF_SERVING_REVIEW_HOSTS,
} from "./schema-org-vocabulary.mjs";

export const CORPUS_ID = "seo-structured-data";
export const CORPUS_VERSION = "structured-data-2026.09";

/**
 * A page with no JSON-LD abstains instead of reporting clean.
 *
 * This is the deliberate call and it is the same one `forms-and-capture` makes.
 * "No findings" on a page with no structured data reads as "your structured data
 * is fine", and there is none. The advice that a site SHOULD have structured
 * data is real advice, and it belongs to the advisory side of the department,
 * because a deterministic rule that fires on every page without markup fires on
 * most of the web and gets switched off in a week.
 */
export const REQUIRES_SUBJECT = { key: "structuredDataBlocks", label: "JSON-LD structured data block" };

/**
 * Values that are template scaffolding somebody forgot to replace. OUR
 * hypothesis, not somebody else's published vocabulary, so it lives here rather
 * than in the vendored file. The split is deliberate: vendored data in a
 * vendored file, our own guesses in our own.
 *
 * Two lists because the risk is different. An EXACT match on a short generic
 * word is safe; the same word as a substring is not, since a real product can be
 * called "Test Kit" and a real company can be named "Example Industries".
 */
const PLACEHOLDER_EXACT = [
  /^\s*(todo|tbd|n\/a|na|none|null|undefined|xxx+|test|example|placeholder|sample|foo|bar|baz|title|name|description)\s*$/i,
  /*
   * FOUND BY A FAILING TEST, and the failure is the shape this house names most
   * often: two patterns that each covered half of the real string and neither
   * covered it. One matched "your company" and one matched "company name", and
   * the actual template default is "Your Company Name", which is both and so was
   * neither. The optional trailing noun is the fix.
   */
  /^\s*your\s+(company|business|site|website|name|brand|store|shop|title|address|city|domain|logo)(\s+(name|title|here))?\s*$/i,
  /^\s*(company|business|site|website|brand|store|shop|product|service)\s+name(\s+here)?\s*$/i,
  /*
   * Narrowed on purpose. The first draft accepted "add" and made "your"
   * optional, which reports a real service called Insert Molding and a real
   * product called Add Water. Requiring "your" costs a little coverage and
   * removes the whole class of false positive.
   */
  /^\s*(enter|insert)\s+your\s+/i,
  /^\s*(lorem ipsum|lorem)\s*$/i,
  /^\s*(john|jane) doe\s*$/i,
];

const PLACEHOLDER_SUBSTRING = [
  /\bexample\.(com|org|net)\b/i,
  /\byour(domain|site|company|business|brand)\.(com|org|net)\b/i,
  /\blorem ipsum dolor\b/i,
  /\[(insert|your|enter)[^\]]{0,40}\]/i,
  /\{\{[^}]{0,40}\}\}/,
  /\b123[- .]?456[- .]?7890\b/,
  /\b555[- .]?555[- .]?5555\b/,
  /\bchange ?(this|me)\b/i,
];

/**
 * Serialised into the page and run against the live DOM. Everything the rules
 * reason over is produced here, so the rules never touch a DOM API and stay
 * testable against a plain object.
 */
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

  const typeList = (raw) => {
    if (typeof raw === "string") return [raw];
    if (Array.isArray(raw)) return raw.filter((t) => typeof t === "string");
    return [];
  };

  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  const blocks = [];
  const nodes = [];
  const untyped = [];

  /*
   * Flatten every typed object out of the parsed JSON, keeping the path it came
   * from. The path is what makes a finding actionable: "block 2 @graph[1].offers"
   * tells somebody where to look inside a file, which a CSS selector on a script
   * tag cannot.
   */
  const walk = (value, path, selector, depth) => {
    if (depth > 12) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`, selector, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const types = typeList(value["@type"]);
    if (types.length > 0) {
      nodes.push({ path, selector, types, obj: value });
    }
    for (const key of Object.keys(value)) {
      if (key === "@type" || key === "@context") continue;
      walk(value[key], `${path}.${key}`, selector, depth + 1);
    }
  };

  scripts.forEach((script, i) => {
    const selector = sel(script);
    const raw = script.textContent || "";
    const label = `block ${i + 1}`;
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseError = err && err.message ? String(err.message) : "not valid JSON";
    }

    /*
     * The top-level entities of a block, which are what @context applies to and
     * what an untyped-entity check has to look at. A node buried three levels
     * down without a @type is usually a plain value bag and is not a defect; a
     * top-level one, or a direct member of @graph, is an entity nobody declared.
     */
    const tops = parsed === null ? [] : Array.isArray(parsed) ? parsed : [parsed];
    const contexts = [];
    tops.forEach((top, ti) => {
      if (!top || typeof top !== "object" || Array.isArray(top)) return;
      const path = Array.isArray(parsed) ? `${label}[${ti}]` : label;
      contexts.push({
        path,
        selector,
        context: typeof top["@context"] === "string" ? top["@context"] : null,
        contextPresent: Object.prototype.hasOwnProperty.call(top, "@context"),
        contextIsObject: typeof top["@context"] === "object" && top["@context"] !== null,
      });
      const graph = Array.isArray(top["@graph"]) ? top["@graph"] : null;
      const entities = graph ? graph.map((g, gi) => ({ obj: g, path: `${path}.@graph[${gi}]` })) : [{ obj: top, path }];
      for (const e of entities) {
        if (!e.obj || typeof e.obj !== "object" || Array.isArray(e.obj)) continue;
        if (typeList(e.obj["@type"]).length === 0 && !Array.isArray(e.obj["@graph"])) {
          untyped.push({ path: e.path, selector, keys: Object.keys(e.obj).slice(0, 8) });
        }
      }
    });

    blocks.push({
      index: i,
      selector,
      label,
      parsed: parsed !== null,
      parseError,
      // Truncated because a finding quotes it and a minified block can be 40kB.
      // The full block is in the page; this is a locator, not a copy.
      excerpt: norm(raw).slice(0, 160),
      rawLength: raw.length,
      contexts,
    });

    if (parsed !== null) walk(parsed, label, selector, 0);
  });

  /*
   * Everything a visitor can actually read, plus the attribute text a screen
   * reader would. Rule `sd.aggregate-rating-not-on-page` compares a number in
   * the markup against this, and the attribute half is what keeps it from firing
   * on a star widget that puts the number in an aria-label instead of in text.
   *
   * NOT truncated, on purpose. A cap here would turn "the number is further down
   * the page than our cap" into "the number is not on the page", which is a
   * false positive manufactured by the collector.
   */
  const attrText = Array.from(document.querySelectorAll("[aria-label],[title],[alt],[content],[value]"))
    .map((el) =>
      ["aria-label", "title", "alt", "content", "value"].map((a) => el.getAttribute(a) || "").join(" "),
    )
    .join(" ");

  const microdata = Array.from(document.querySelectorAll("[itemtype]")).map((el) => ({
    itemtype: (el.getAttribute("itemtype") || "").slice(0, 120),
    selector: sel(el),
  }));

  const bodyText = norm(document.body ? document.body.textContent : "");

  return {
    blocks,
    nodes,
    untyped,
    microdata,
    visibleText: bodyText,
    attrText: norm(attrText),
    counts: {
      // The abstention subject. Zero means this rulebook says nothing, loudly.
      structuredDataBlocks: blocks.length,
      parseFailures: blocks.filter((b) => !b.parsed).length,
      ldNodes: nodes.length,
      microdataBlocks: microdata.length,
      bodyTextLength: bodyText.length,
    },
  };
};

/** Convenience for a finding, so every one carries a locator by construction. */
const at = (selector, observed) => ({ selector, observed });

/**
 * Is this node a REFERENCE rather than a definition? `{"@type":"Organization",
 * "@id":"https://x/#org"}` is a pointer at a node defined elsewhere, and
 * demanding `name` on it is the single most likely false positive in this whole
 * corpus. A reference is a node whose only other content is an identifier.
 */
const isReference = (obj) => {
  const keys = Object.keys(obj).filter((k) => k !== "@type" && k !== "@context");
  return keys.length > 0 && keys.every((k) => k === "@id" || k === "url" || k === "name") && !!obj["@id"] && keys.length <= 2;
};

const present = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

/** Every string value in a node, shallow plus one level, with the key it sat under. */
const stringValues = (obj, depth = 0) => {
  const out = [];
  if (depth > 4 || !obj || typeof obj !== "object") return out;
  for (const [key, value] of Object.entries(obj)) {
    if (key === "@context") continue;
    if (typeof value === "string") out.push({ key, value });
    else if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === "string") out.push({ key, value: v });
        else out.push(...stringValues(v, depth + 1));
      }
    } else if (value && typeof value === "object") out.push(...stringValues(value, depth + 1));
  }
  return out;
};

const URL_PROPERTIES = new Set(["url", "logo", "image", "contentUrl", "thumbnailUrl", "sameAs", "embedUrl", "target"]);

export const RULES = [
  {
    id: "sd.json-unparseable",
    family: "syntax",
    weight: 9,
    severity: "high",
    title: "A structured data block is not valid JSON",
    rationale:
      "A JSON-LD block that does not parse is discarded in full and in silence. Nothing warns you, " +
      "the page looks finished, and every property in that block is doing nothing. This is the " +
      "highest-weighted rule in the rulebook because the failure is total and invisible.",
    falsePositiveNote:
      "Never wrong about the parse itself: the block either parsed or it did not, and the parser's " +
      "own message is quoted. It IS wrong about the cause when a template engine is expected to " +
      "substitute a value at request time and the file on disk was checked instead of the served " +
      "page. Check the response a browser receives before editing a template.",
    prevention:
      "Serialise structured data with a JSON encoder rather than a string template. A trailing " +
      "comma, an unescaped quote in a business name, or an interpolated value that arrived empty " +
      "all produce this.",
    since: "structured-data-2026.09",
    detect: (f) =>
      f.blocks
        .filter((b) => !b.parsed)
        .map((b) => at(b.selector, `${b.label} (${b.rawLength} bytes) did not parse: ${b.parseError}`)),
  },
  {
    id: "sd.context-missing",
    family: "syntax",
    weight: 7,
    severity: "high",
    title: "A structured data block does not declare the schema.org context",
    rationale:
      "Without @context pointing at schema.org, the vocabulary is undefined and a consumer has no " +
      "basis for reading @type or any property. The block parses as JSON and means nothing, which " +
      "is why it survives review: it looks like data.",
    falsePositiveNote:
      "Wrong when @context is an object or an array that maps prefixes rather than a plain string, " +
      "which is valid JSON-LD and is normal in output from a CMS that mixes vocabularies. This rule " +
      "reports that case separately as an object context rather than as a missing one, so a finding " +
      "quoting an object is telling you it could not read it, not that it is absent.",
    prevention:
      "Put a single string @context of https://schema.org at the top of every block. If a block is " +
      "generated by concatenating fragments, the context belongs on the wrapper.",
    since: "structured-data-2026.09",
    detect: (f) =>
      f.blocks
        .filter((b) => b.parsed)
        .flatMap((b) => b.contexts)
        .filter((c) => !c.contextPresent || (!c.contextIsObject && !/schema\.org/i.test(c.context || "")))
        .map((c) =>
          at(
            c.selector,
            c.contextPresent
              ? `${c.path} has @context ${JSON.stringify(c.context)}, which does not name schema.org`
              : `${c.path} has no @context at all`,
          ),
        ),
  },
  {
    id: "sd.entity-has-no-type",
    family: "syntax",
    weight: 6,
    severity: "high",
    title: "A structured data entity has no @type",
    rationale:
      "An entity with properties and no @type is a bag of values nobody can interpret. The " +
      "properties are read against no definition and the whole entity is ignored, so the effort " +
      "that went into filling it in is spent and invisible.",
    falsePositiveNote:
      "Wrong on a node that is deliberately a plain value bag, for example a bare object under a " +
      "property whose expected range is a literal. This rule only looks at TOP-LEVEL entities and " +
      "direct members of @graph for that reason, so a nested value bag is never reported. If a " +
      "reported node is intentionally untyped at the top level, it is not doing anything.",
    prevention:
      "Every top-level entity and every member of @graph carries a @type. If a fragment is built in " +
      "one place and typed in another, type it where it is built.",
    since: "structured-data-2026.09",
    detect: (f) =>
      f.untyped.map((u) =>
        at(u.selector, `${u.path} has no @type, and carries: ${u.keys.join(", ") || "nothing"}`),
      ),
  },
  {
    id: "sd.type-wrong-case",
    family: "vocabulary",
    weight: 8,
    severity: "high",
    title: "A @type is a known schema.org type spelled with the wrong case",
    rationale:
      "schema.org types are case-sensitive. localbusiness is not LocalBusiness, it resolves to " +
      "nothing, and the entity is dropped. It is a single-character defect with the same effect as " +
      "deleting the block, and it survives review because it reads correctly to a person.",
    falsePositiveNote:
      "This rule only fires on a POSITIVE match: the value matches a type in our vendored list " +
      "case-insensitively and differs from it exactly. It cannot be wrong about that comparison. " +
      "The reason there is no companion rule reporting an UNKNOWN type is that our type list is a " +
      "subset of schema.org, so absence from it would be evidence of nothing.",
    prevention:
      "Copy type names from the schema.org page for the type rather than typing them. Lowercasing " +
      "usually arrives from a config value or a database column that normalises case.",
    since: "structured-data-2026.09",
    detect: (f) =>
      f.nodes.flatMap((n) =>
        n.types
          .map((t) => ({ t, canonical: TYPES_BY_LOWERCASE.get(t.toLowerCase()) }))
          .filter((x) => x.canonical && x.canonical !== x.t)
          .map((x) => at(n.selector, `${n.path} has @type ${JSON.stringify(x.t)}, and the type is ${x.canonical}`)),
      ),
  },
  {
    id: "sd.required-property-missing",
    family: "completeness",
    weight: 6,
    severity: "medium",
    title: "A typed entity is missing a property its type requires",
    rationale:
      "A required property is the difference between markup that is read and markup that is " +
      "discarded. An Offer without a price, or a LocalBusiness without an address, is the shape " +
      "that gets built once from a tutorial and never revisited, because nothing on the page looks " +
      "broken.",
    falsePositiveNote:
      "Wrong on a REFERENCE node, and that is the most likely false positive in this rulebook: " +
      "{\"@type\":\"Organization\",\"@id\":\"/#org\"} is a pointer at an entity defined on another " +
      "page and correctly carries nothing else. Such nodes are excluded. It is also silent by " +
      "design on any type absent from our required-property table, which is small, so a clean " +
      "result here does not mean every type on the page was checked.",
    prevention:
      "Check the type against the schema.org page for it when you add markup, and treat a required " +
      "property that arrives empty from a database as a reason not to emit the entity at all.",
    since: "structured-data-2026.09",
    detect: (f) =>
      f.nodes.flatMap((n) => {
        if (isReference(n.obj)) return [];
        const out = [];
        for (const type of n.types) {
          const spec = REQUIRED_PROPERTIES[type];
          if (!spec) continue;
          for (const prop of spec.all) {
            if (!present(n.obj[prop])) {
              out.push(at(n.selector, `${n.path} is a ${type} with no ${prop}`));
            }
          }
          for (const group of spec.anyOf) {
            if (!group.some((prop) => present(n.obj[prop]))) {
              out.push(at(n.selector, `${n.path} is a ${type} with none of: ${group.join(", ")}`));
            }
          }
        }
        return out;
      }),
  },
  {
    id: "sd.placeholder-value",
    family: "content",
    weight: 8,
    severity: "high",
    title: "Structured data carries a template placeholder",
    rationale:
      "A placeholder in structured data is worse than one in visible copy, because nobody reads " +
      "structured data on the way past. Your Company Name or example.com sits in the machine " +
      "readable description of the business until somebody looks, and it is exactly what a search " +
      "engine reads first.",
    falsePositiveNote:
      "Wrong when the placeholder-looking value is the real one: a company genuinely called Example " +
      "or a product line named Test Kit. That is why short generic words are matched only as the " +
      "WHOLE value and distinctive strings like example.com are matched anywhere. If a reported " +
      "value is real, it is real, and the rule was still right to ask.",
    prevention:
      "Fail the build when structured data contains a value from the placeholder set. A template " +
      "default that is a valid-looking string is a template default that ships.",
    since: "structured-data-2026.09",
    detect: (f) =>
      f.nodes.flatMap((n) =>
        stringValues(n.obj)
          .filter(
            ({ value }) =>
              PLACEHOLDER_EXACT.some((re) => re.test(value)) ||
              PLACEHOLDER_SUBSTRING.some((re) => re.test(value)),
          )
          .map(({ key, value }) => at(n.selector, `${n.path} has ${key}: ${JSON.stringify(value.slice(0, 80))}`)),
      ),
  },
  {
    id: "sd.aggregate-rating-not-on-page",
    family: "content",
    weight: 8,
    severity: "high",
    title: "A rating in the markup does not appear anywhere on the page",
    rationale:
      "Structured data is required to describe what the page shows. A rating that exists only in " +
      "the markup is invisible to a visitor and, if a search engine shows it, the visitor arrives " +
      "at a page that does not support it. This is the rule with the largest gap between how small " +
      "the defect looks and how much it costs, because the consequence is a manual action rather " +
      "than a ranking change.",
    falsePositiveNote:
      "Wrong when the rating is rendered as an image, a canvas, or a chart with no text and no " +
      "accessible label, since this rule reads visible text AND aria-label, title, alt and content " +
      "attributes. It is also wrong when the rating loads after an interaction this probe did not " +
      "perform. If the number is genuinely on the page in text a person can select, this rule does " +
      "not fire.",
    prevention:
      "Render the rating from the same value that generates the markup, so the two cannot diverge. " +
      "A rating hardcoded in a template while the page renders a live average is the usual cause.",
    since: "structured-data-2026.09",
    detect: (f) => {
      const haystack = `${f.visibleText} ${f.attrText}`;
      return f.nodes
        .filter((n) => n.types.includes("AggregateRating"))
        .flatMap((n) => {
          const raw = n.obj.ratingValue;
          if (raw === null || raw === undefined || raw === "") return [];
          const text = String(raw).trim();
          const num = Number(text);
          // Both spellings, because markup often carries 4.80 where the page
          // renders 4.8, and reporting that as absent would be our defect.
          const candidates = new Set([text]);
          if (Number.isFinite(num)) candidates.add(String(num));
          const found = [...candidates].some((c) => haystack.includes(c));
          return found ? [] : [at(n.selector, `${n.path} claims ratingValue ${JSON.stringify(text)}, which is not in the page text or in any aria-label, title, alt or content attribute`)];
        });
    },
  },
  {
    id: "sd.self-serving-review",
    family: "policy",
    weight: 5,
    severity: "medium",
    title: "A business marks up reviews of itself",
    rationale:
      "Review markup attached to the organisation publishing the page is self-serving, and the " +
      "review snippet guidelines exclude it. The markup is not merely ignored: it is the pattern " +
      "that a manual review looks for, so it puts the rest of the site's markup under scrutiny to " +
      "buy nothing.",
    falsePositiveNote:
      "Wrong when the marked-up organisation is not the publisher of the page, which is normal on a " +
      "directory, a marketplace listing, or a review site describing somebody else's business. " +
      "Nothing in the page tells us who owns it, so this rule cannot distinguish the two and it " +
      "reports the shape rather than a violation. On a directory it is expected and correct.",
    prevention:
      "Attach reviews to a Product, a Service, or a specific offering rather than to the " +
      "Organization or LocalBusiness node, and keep the aggregate on the thing being reviewed.",
    since: "structured-data-2026.09",
    detect: (f) =>
      f.nodes
        .filter((n) => n.types.some((t) => SELF_SERVING_REVIEW_HOSTS.has(t)))
        .filter((n) => present(n.obj.review) || present(n.obj.aggregateRating))
        .map((n) =>
          at(
            n.selector,
            `${n.path} is a ${n.types.join(", ")} carrying ${
              present(n.obj.aggregateRating) ? "aggregateRating" : "review"
            } about itself`,
          ),
        ),
  },
  {
    id: "sd.relative-url",
    family: "syntax",
    weight: 5,
    severity: "medium",
    title: "A URL in the markup is relative",
    rationale:
      "Structured data is consumed away from the page it came from, so a relative URL has nothing " +
      "to resolve against. An image at /logo.png or a url of /about is dropped, which usually means " +
      "the logo or the canonical link the markup exists to provide is missing.",
    falsePositiveNote:
      "Wrong on a protocol-relative URL beginning with two slashes and on a data URI, both of which " +
      "resolve, and both are excluded. It is right about a leading single slash or a bare path even " +
      "when the page renders correctly, because the browser resolves those and a structured data " +
      "consumer does not.",
    prevention:
      "Build absolute URLs from a single configured origin when generating markup. A relative URL " +
      "here almost always arrives from reusing the same helper that renders an href.",
    since: "structured-data-2026.09",
    detect: (f) =>
      f.nodes.flatMap((n) =>
        stringValues(n.obj)
          .filter(({ key, value }) => {
            if (!URL_PROPERTIES.has(key)) return false;
            const v = value.trim();
            if (!v) return false;
            if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // any scheme, including data:
            if (v.startsWith("//")) return false; // protocol-relative resolves
            return true;
          })
          .map(({ key, value }) => at(n.selector, `${n.path} has ${key}: ${JSON.stringify(value.slice(0, 100))}`)),
      ),
  },
];
