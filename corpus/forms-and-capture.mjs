/**
 * The `forms-and-capture` corpus.
 *
 * WHY THIS DEPARTMENT EXISTS AT ALL, and it is not a hypothetical. This
 * repository shipped a live site whose application form posted every submission
 * to `hello@example.com`, a placeholder, and then told the visitor it had worked.
 * The free draft is the entire business hook and that form was the only way to
 * ask for one, so every application was discarded by a mail server while the
 * person applying saw a confirmation.
 *
 * A form that reports success and delivers nothing is the exact defect this whole
 * product exists to detect, and it happened here. So this corpus is pointed at
 * the class rather than the instance: does the form have somewhere to go, does it
 * have a way to submit, and are the fields shaped so a person can actually
 * complete them.
 *
 * THE HARD LIMIT, stated because it is the most important thing about this
 * department. A parser CANNOT see a JavaScript submit handler. So the one defect
 * that started this file, a form whose handler sends to the wrong place, is
 * invisible here, and no rule below claims otherwise. What is visible is the
 * weaker and still useful question: whether the form has any declared
 * destination at all, which is the case where a handler is the ONLY thing
 * standing between the customer and silence.
 */

export const CORPUS_ID = "forms-and-capture";
export const CORPUS_VERSION = "forms-2026.09";

/**
 * What must EXIST for this rulebook's silence to mean anything.
 *
 * Found by reading our own receipt. On a page with no form at all, the report
 * read "read 0 forms, 0 fields. Nothing fired. Every one of the 6 rules ran",
 * which a customer reads as "your forms are fine". There were no forms. That is
 * the difference between "we looked and found nothing wrong" and "there was
 * nothing to look at", and this house's own rule is that a probe reporting zero
 * things examined is a FAILURE regardless of exit code.
 *
 * So a corpus whose whole subject is absent abstains, with its own code, rather
 * than reporting a clean result it did not earn.
 */
export const REQUIRES_SUBJECT = { key: "forms", label: "form" };

/** Field names whose autocomplete value materially speeds up completion. */
const AUTOFILL_HINTS = {
  email: "email",
  name: "name",
  fname: "given-name",
  lname: "family-name",
  phone: "tel",
  tel: "tel",
  address: "street-address",
  city: "address-level2",
  zip: "postal-code",
  postcode: "postal-code",
  company: "organization",
  organization: "organization",
};

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

  const forms = Array.from(document.querySelectorAll("form")).map((form) => {
    const fields = Array.from(form.querySelectorAll("input,select,textarea")).map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute("type") || "text").toLowerCase(),
      name: el.getAttribute("name") || "",
      id: el.getAttribute("id") || "",
      selector: sel(el),
      autocomplete: el.getAttribute("autocomplete"),
      required: el.hasAttribute("required"),
      inputmode: el.getAttribute("inputmode"),
    }));
    const submits = Array.from(form.querySelectorAll("button,input[type=submit],input[type=image]")).filter(
      (b) => {
        const t = (b.getAttribute("type") || "").toLowerCase();
        return b.tagName.toLowerCase() === "button" ? t === "" || t === "submit" : true;
      },
    );
    const radioGroups = {};
    for (const el of form.querySelectorAll("input[type=radio]")) {
      const n = el.getAttribute("name") || "";
      radioGroups[n] = (radioGroups[n] || 0) + 1;
    }
    return {
      selector: sel(form),
      action: form.getAttribute("action"),
      method: (form.getAttribute("method") || "get").toLowerCase(),
      novalidate: form.hasAttribute("novalidate"),
      fields,
      submitCount: submits.length,
      submitLabels: submits.map((b) => text(b) || b.getAttribute("value") || "").filter(Boolean),
      radioGroups: Object.entries(radioGroups).map(([name, count]) => ({
        name,
        count,
        inFieldset: !!(
          form.querySelector(`fieldset input[type=radio][name="${name}"]`) &&
          form.querySelector("fieldset > legend")
        ),
      })),
    };
  });

  return {
    forms,
    counts: {
      forms: forms.length,
      fields: forms.reduce((n, f) => n + f.fields.length, 0),
      bodyTextLength: text(document.body).length,
    },
  };
};

const at = (selector, observed) => ({ selector, observed });

export const RULES = [
  {
    id: "forms.no-declared-destination",
    family: "delivery",
    weight: 7,
    severity: "high",
    title: "A form declares no destination, so only script can be delivering it",
    rationale:
      "With no action attribute, submitting the form posts back to the same URL, which for a static " +
      "page does nothing. That means a script is the only thing delivering it, and if that script is " +
      "wrong or fails the visitor still sees whatever the page tells them.",
    falsePositiveNote:
      "This fires on most modern forms and it is a QUESTION rather than a defect, which is why the " +
      "wording says only script can be delivering it. A React or Next form with an onSubmit handler " +
      "legitimately has no action, and that is correct practice. The right response is not to add an " +
      "action, it is to confirm the handler delivers somewhere real and reports honestly when it " +
      "cannot. This corpus cannot see the handler, so it cannot answer that for you, and this rule " +
      "exists to make sure somebody asks.",
    prevention:
      "Confirm the handler's destination is real, and make it report a failure to the visitor rather " +
      "than a success it cannot back up. A fallback that opens the visitor's own mail app is better " +
      "than a lost submission.",
    since: "forms-2026.09",
    detect: (f) =>
      f.forms
        .filter((form) => !form.action || !form.action.trim())
        .map((form) =>
          at(
            form.selector,
            `<form> with no action and ${form.fields.length} field(s), method="${form.method}"`,
          ),
        ),
  },
  {
    id: "forms.no-submit-control",
    family: "completion",
    weight: 8,
    severity: "high",
    title: "A form has no way to submit it",
    rationale:
      "With no submit button, the only way to send the form is pressing Enter in a text field, which " +
      "does not work at all from a textarea and is not discoverable. On a touch screen there is no " +
      "way at all.",
    falsePositiveNote:
      "Wrong when the submit control is rendered by script after this check reads the document, which " +
      "is why the field count is reported alongside: a form with fields and no button is worth " +
      "looking at, and one with neither is probably a shell that had not rendered. Also wrong for a " +
      "search form that submits on input change by design, though those still want a visible control " +
      "for touch users.",
    prevention: "One clearly labelled submit button per form, inside the form element.",
    since: "forms-2026.09",
    detect: (f) =>
      f.forms
        .filter((form) => form.fields.length > 0 && form.submitCount === 0)
        .map((form) => at(form.selector, `<form> with ${form.fields.length} field(s) and no submit control`)),
  },
  {
    id: "forms.email-field-wrong-type",
    family: "input",
    weight: 4,
    severity: "medium",
    title: "A field asking for an email address is not an email input",
    rationale:
      "type=\"email\" gets the phone keyboard with the at sign on it, browser validation, and " +
      "autofill. As type=\"text\" it gets none of those, so a phone user types an address on the " +
      "alphabetic keyboard and a typo reaches you instead of a warning reaching them.",
    falsePositiveNote:
      "Matched on the field's name or id containing 'email', so a field named 'emailPreference' that " +
      "is genuinely a checkbox or a select is not reported, because only text-like inputs are " +
      "considered. It IS wrong where a field deliberately accepts a comma-separated list of " +
      "addresses, which type=\"email\" rejects without the multiple attribute.",
    prevention: "Use type=\"email\" with autocomplete=\"email\".",
    since: "forms-2026.09",
    detect: (f) =>
      f.forms.flatMap((form) =>
        form.fields
          .filter((x) => x.tag === "input" && ["text", "", null].includes(x.type))
          .filter((x) => /e-?mail/i.test(`${x.name} ${x.id}`))
          .map((x) => at(x.selector, `<input type="${x.type || "text"}" name="${x.name}"> asks for an email`)),
      ),
  },
  {
    id: "forms.autocomplete-missing",
    family: "completion",
    weight: 3,
    severity: "medium",
    title: "A field a browser could autofill does not say what it holds",
    rationale:
      "An autocomplete token lets a browser or password manager fill the field in one tap. Without " +
      "it a customer on a phone types their name, email and address by hand, and every extra field " +
      "typed by hand is a chance to abandon the form.",
    falsePositiveNote:
      "Only fires on names this corpus can map with confidence, listed in AUTOFILL_HINTS, so an " +
      "unusual field name is left alone rather than guessed at. It is wrong where filling from a " +
      "saved profile would be actively unhelpful, for example a form asking about somebody else's " +
      "details, and in that case autocomplete=\"off\" is the honest answer rather than nothing at all.",
    prevention: "Add the matching autocomplete token. The list is short and it is in the HTML spec.",
    since: "forms-2026.09",
    detect: (f) => {
      const hints = {
        email: "email", name: "name", fname: "given-name", lname: "family-name",
        phone: "tel", tel: "tel", address: "street-address", city: "address-level2",
        zip: "postal-code", postcode: "postal-code", company: "organization",
        organization: "organization",
      };
      return f.forms.flatMap((form) =>
        form.fields
          .filter((x) => x.tag === "input" && !x.autocomplete)
          .map((x) => {
            const key = Object.keys(hints).find((k) => (x.name || x.id).toLowerCase() === k);
            return key
              ? at(x.selector, `<input name="${x.name || x.id}"> could carry autocomplete="${hints[key]}"`)
              : null;
          })
          .filter(Boolean),
      );
    },
  },
  {
    id: "forms.radio-group-no-fieldset",
    family: "structure",
    weight: 4,
    severity: "medium",
    title: "A group of radio buttons has no shared question",
    rationale:
      "Each radio has its own label, but nothing states the question they answer. A screen reader " +
      "announces 'Saturday, radio button, one of three' with no indication that the question was " +
      "which day you want, so the options arrive without the thing they are options for.",
    falsePositiveNote:
      "Fires only on groups of two or more sharing a name, so a single radio used as a toggle is not " +
      "reported. It is wrong when the question is carried by a heading immediately above the group " +
      "and tied to it with aria-labelledby on a role=\"radiogroup\" container, which is a valid " +
      "alternative this rule cannot distinguish from nothing at all.",
    prevention: "Wrap the group in a fieldset and put the question in a legend.",
    since: "forms-2026.09",
    detect: (f) =>
      f.forms.flatMap((form) =>
        form.radioGroups
          .filter((g) => g.count > 1 && !g.inFieldset)
          .map((g) => at(form.selector, `${g.count} radios named "${g.name}" with no fieldset and legend`)),
      ),
  },
  {
    id: "forms.novalidate-with-required",
    family: "input",
    weight: 5,
    severity: "medium",
    title: "The form marks fields required and then turns validation off",
    rationale:
      "novalidate disables the browser's own check, so a required field can be submitted empty. " +
      "Either the script validates instead, or the customer submits an incomplete form and finds out " +
      "later, or does not find out at all.",
    falsePositiveNote:
      "Very often deliberate and correct: novalidate is the standard way to replace browser messages, " +
      "which cannot be styled and read poorly, with your own. So this is a prompt to confirm the " +
      "replacement exists rather than a defect on its own. It only fires where required attributes " +
      "are also present, which is the combination that suggests the intent was validation rather than " +
      "no validation.",
    prevention:
      "Keep novalidate if you are validating in script, and make sure that script blocks submission " +
      "and names the field that is wrong.",
    since: "forms-2026.09",
    detect: (f) =>
      f.forms
        .filter((form) => form.novalidate && form.fields.some((x) => x.required))
        .map((form) =>
          at(
            form.selector,
            `<form novalidate> with ${form.fields.filter((x) => x.required).length} required field(s)`,
          ),
        ),
  },
];
