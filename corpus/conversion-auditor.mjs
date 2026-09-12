/**
 * The `conversion-auditor` corpus: whether a visitor who wants to act CAN.
 *
 * WHY THIS SEAT IS RE-MARKED [D] AND WHY THAT IS NOT A PROMOTION.
 *
 * The roster plan marks this department [A], model judgement over a playbook, and
 * that was right for the department as described. Conversion is mostly judgement:
 * whether the offer is worth taking, whether the copy earns the click, whether
 * the price is the friction. None of that is decidable from bytes and this
 * rulebook does not touch it.
 *
 * What IS decidable is the structural half, and the structural half is where the
 * money actually leaks on a small-business site. A phone number that is not a
 * `tel:` link is a dead number on the device most visitors are holding. A page
 * with no route to the action is a page that asks for nothing. A primary button
 * that shipped `disabled` is a checkout nobody can start. Those are certain, they
 * cite a line, and they are the cases somebody loses revenue to without ever
 * learning why.
 *
 * SO THIS SEAT OWNS HALF A JOB, DELIBERATELY, in the same way `broken-things`
 * owns the offline half of breakage and says so. The other half stays judgement
 * and stays unmeasured, because attaching a measurement to it is the thing this
 * house refuses.
 *
 * WHAT IT CANNOT SEE, and no rule below implies otherwise:
 *   - whether the action is worth taking, or the copy persuasive
 *   - anything rendered by script after this file was built
 *   - whether the form's handler delivers (that is forms-and-capture, and even
 *     there the handler is invisible)
 *   - whether a visitor on a phone can read any of it, which needs rendering
 */

export const CORPUS_ID = "conversion-auditor";
export const CORPUS_VERSION = "conversion-2026.09";

/**
 * A page with no interactive element at all cannot be asked whether its action is
 * reachable. Unlike `measurement`, the absence here is genuinely out of scope: a
 * privacy policy or an article is not a page with a broken conversion path, it is
 * a page with no conversion path by design, and firing on every one of them is
 * how a department gets turned off.
 */
export const REQUIRES_SUBJECT = { key: "interactive", label: "link, button or form" };

/** Words that mark a link or button as the thing the page wants you to do. */
const ACTION_WORDS =
  /\b(contact|call|book|order|buy|get (a )?quote|quote|enquire|inquire|apply|sign ?up|start|request|schedule|reserve|hire|shop|checkout|donate|subscribe|join|get started|talk to)\b/i;

/**
 * A phone number as a person writes one, not as a spec defines one.
 *
 * Deliberately conservative. It wants a shape with separators or a leading +,
 * because a bare run of nine digits is as likely to be an order number, a licence
 * number or a year range, and a rule that flags those is a rule somebody turns
 * off before it ever catches a real dead number.
 */
const PHONE_TEXT =
  /(\+\d{1,3}[\s.-]?)?(\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{2,4}[\s.-]\d{2,4}(?![\d])/;

const EMAIL_TEXT = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

/*
 * NOTHING IN HERE MAY REFERENCE MODULE SCOPE.
 *
 * `collect` is stringified and re-evaluated by mcp/dom.mjs, roughly as
 * `new Function("document", "return (" + collect.toString() + ")()")`, so this
 * module's own constants do not exist at the moment it runs. The first version of
 * this file used ACTION_WORDS inside collect and every rule threw
 * ReferenceError; the suite caught it in one run, but a reference that only
 * sometimes executes would not have been caught at all.
 *
 * Helpers that need a shared constant belong in the RULES, which are called
 * normally and keep their closure.
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
  const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();

  const inFooter = (el) => Boolean(el.closest && el.closest("footer, [role=contentinfo]"));

  const links = Array.from(document.querySelectorAll("a[href]")).map((a) => ({
    href: a.getAttribute("href") || "",
    label: text(a).slice(0, 120),
    selector: sel(a),
    inFooter: inFooter(a),
  }));

  const buttons = Array.from(document.querySelectorAll("button, input[type=submit], [role=button]")).map((b) => ({
    label: (text(b) || b.getAttribute("value") || b.getAttribute("aria-label") || "").slice(0, 120),
    disabled: b.hasAttribute("disabled") || b.getAttribute("aria-disabled") === "true",
    selector: sel(b),
    inFooter: inFooter(b),
  }));

  const forms = Array.from(document.querySelectorAll("form")).map((f) => {
    const fields = Array.from(f.querySelectorAll("input,select,textarea")).filter(
      (el) => !["hidden", "submit", "button", "image"].includes((el.getAttribute("type") || "").toLowerCase()),
    );
    return {
      selector: sel(f),
      fieldCount: fields.length,
      requiredCount: fields.filter((el) => el.hasAttribute("required")).length,
      requiredNames: fields
        .filter((el) => el.hasAttribute("required"))
        .map((el) => el.getAttribute("name") || el.getAttribute("id") || el.getAttribute("type") || "field")
        .slice(0, 12),
      inFooter: inFooter(f),
    };
  });

  const bodyText = text(document.body);


  return {
    links,
    buttons,
    forms,
    bodyText: bodyText.slice(0, 200000),
    hasTelLink: links.some((l) => /^tel:/i.test(l.href)),
    hasMailto: links.some((l) => /^mailto:/i.test(l.href)),
    counts: {
      interactive: links.length + buttons.length + forms.length,
      links: links.length,
      buttons: buttons.length,
      forms: forms.length,
      bodyTextLength: bodyText.length,
    },
  };
};

const at = (selector, observed) => ({ selector, observed });

/** Every element that offers the visitor a way to act. */
const actions = (f) => [
  ...f.links.filter((l) => ACTION_WORDS.test(l.label) || /^(tel:|mailto:)/i.test(l.href)),
  ...f.buttons.filter((b) => ACTION_WORDS.test(b.label)),
  ...f.forms,
];

export const RULES = [
  {
    id: "conversion.no-route-to-any-action",
    family: "reachability",
    weight: 8,
    severity: "high",
    title: "Nothing on this page asks the visitor to do anything",
    rationale:
      "A page with links and buttons but no contact link, no phone, no form and no action wording is " +
      "a page somebody can read and leave with no next step. On a small-business site that is the " +
      "whole cost of the page: the visitor was interested enough to arrive and had nowhere to go.",
    falsePositiveNote:
      "Wrong on pages that SHOULD have no action, which is why it is scoped to pages with " +
      "interactive elements and why the finding names what it found instead. An article, a policy " +
      "page or a blog index legitimately asks for nothing. Read it as a question about whether this " +
      "particular page is one of those, not as a defect on every page it names.",
    prevention:
      "Give every page that could end a visit one clear next step, even if it is a link to the page " +
      "that has the real action on it.",
    since: "conversion-2026.09",
    detect: (f) => (actions(f).length === 0 ? [at("body", `${f.counts.links} link(s) and ${f.counts.buttons} button(s), none of them an action and no form`)] : []),
  },

  {
    id: "conversion.phone-number-is-not-tappable",
    family: "reachability",
    weight: 8,
    severity: "high",
    title: "A phone number is printed as text with no tel: link anywhere on the page",
    rationale:
      "Most visitors to a local business site are on a phone. A number they cannot tap is a number " +
      "they have to memorise, switch apps for and retype, and a meaningful share of them do not. " +
      "This is the single cheapest conversion fix on a small-business site and it is almost always " +
      "missed, because it works perfectly on the desktop the site was built on.",
    falsePositiveNote:
      "Wrong when the matched text is not a phone number at all: an order reference, a licence " +
      "number, an ABN or a date range can take the same shape, which is why the pattern requires " +
      "separators or a country prefix rather than accepting any run of digits. It is also wrong when " +
      "the number is deliberately not for calling, such as a fax line or a number shown as an " +
      "example. The observed text is quoted so that is decidable at a glance.",
    prevention:
      'Wrap it: <a href="tel:+15551234567">(555) 123-4567</a>. Keep the human formatting in the ' +
      "text and put the E.164 form in the href.",
    since: "conversion-2026.09",
    detect: (f) => {
      if (f.hasTelLink) return [];
      const m = f.bodyText.match(PHONE_TEXT);
      return m ? [at("body", `phone-shaped text "${m[0].trim()}" and no tel: link on the page`)] : [];
    },
  },

  {
    id: "conversion.email-is-not-a-mailto",
    family: "reachability",
    weight: 5,
    severity: "medium",
    title: "An email address is printed as text with no mailto: link anywhere on the page",
    rationale:
      "Same failure as the phone number and a smaller one, because an address can be copied. It " +
      "still costs the visitor a deliberate act at the exact moment they had decided to get in touch.",
    falsePositiveNote:
      "Frequently deliberate, and that is why this is medium rather than high: addresses are often " +
      "printed unlinked to slow down scrapers, which is a real trade a business is allowed to make. " +
      "Wrong too when the address belongs to somebody else, such as a quoted reference or a licence " +
      "contact.",
    prevention:
      "Link it, or replace it with a form. If it is unlinked to deter scraping, say so somewhere a " +
      "reviewer will see, so the next audit does not re-raise it.",
    since: "conversion-2026.09",
    detect: (f) => {
      if (f.hasMailto) return [];
      const m = f.bodyText.match(EMAIL_TEXT);
      return m ? [at("body", `email text "${m[0]}" and no mailto: link on the page`)] : [];
    },
  },

  {
    id: "conversion.primary-action-shipped-disabled",
    family: "blocking",
    weight: 9,
    severity: "high",
    title: "An action control is disabled in the bytes that shipped",
    rationale:
      "A disabled button in the built HTML is a control nobody can press until script enables it. If " +
      "that script fails, is blocked, or never runs, the visitor sees the thing they came to do and " +
      "cannot do it. It is also invisible in review, because whoever checks it has JavaScript working.",
    falsePositiveNote:
      "Correct and expected on a form that enables its submit only once the fields validate, which is " +
      "good practice. The finding is worth reading anyway: it tells you the page depends on script " +
      "for its primary action, and that is a dependency worth knowing rather than a defect by itself.",
    prevention:
      "Ship the control enabled and let the server reject bad input, or make sure the enabling script " +
      "cannot fail silently. A control that is disabled with no visible reason is a dead end.",
    since: "conversion-2026.09",
    detect: (f) =>
      f.buttons
        .filter((b) => b.disabled && ACTION_WORDS.test(b.label))
        .map((b) => at(b.selector, `action control "${b.label || "(no label)"}" carries disabled in the shipped HTML`)),
  },

  {
    id: "conversion.action-only-in-the-footer",
    family: "reachability",
    weight: 6,
    severity: "medium",
    title: "The only way to act is in the footer",
    rationale:
      "A visitor who is convinced halfway down has to keep going to the very bottom to find out how " +
      "to proceed, and the footer is the part of a page people scroll past rather than to. If the " +
      "page is worth reading, the action belongs where the reading happens.",
    falsePositiveNote:
      "Wrong on a page whose whole job is to inform, where a footer contact block is the correct and " +
      "unobtrusive answer. It is also wrong when the real action lives in a sticky header this parser " +
      "cannot distinguish from any other element. Treat it as a prompt to look at the page rather " +
      "than as a defect.",
    prevention:
      "Repeat the action once in the body, near the point where somebody would have decided. The " +
      "footer copy can stay.",
    since: "conversion-2026.09",
    detect: (f) => {
      const all = actions(f);
      if (all.length === 0) return [];
      return all.every((a) => a.inFooter)
        ? [at("footer", `all ${all.length} action element(s) on this page are inside the footer`)]
        : [];
    },
  },

  {
    id: "conversion.form-asks-for-too-much",
    family: "friction",
    weight: 5,
    severity: "medium",
    title: "A form makes more than five fields required before anybody can send it",
    rationale:
      "Every required field is a place to stop. For a first contact, the business usually needs a way " +
      "to reply and a sentence about what is wanted; the rest can be asked in the reply, when the " +
      "person is already talking to you rather than deciding whether to.",
    falsePositiveNote:
      "Wrong whenever the fields are genuinely needed before anybody can respond, which is common: a " +
      "booking needs a date, a quote needs the job, a regulated trade may need details it cannot " +
      "proceed without. The required field names are listed in the finding so that judgement can be " +
      "made without opening the page.",
    prevention:
      "Require the minimum that lets you reply. Keep the rest, optional, for the people happy to give " +
      "it.",
    since: "conversion-2026.09",
    detect: (f) =>
      f.forms
        .filter((form) => form.requiredCount > 5)
        .map((form) =>
          at(form.selector, `${form.requiredCount} required field(s) of ${form.fieldCount}: ${form.requiredNames.join(", ")}`),
        ),
  },
];
