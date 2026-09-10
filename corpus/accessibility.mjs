/**
 * The `accessibility` corpus.
 *
 * SCOPE, and it is drawn to avoid two failures rather than to look thorough.
 *
 * FIRST, it does not repeat `seo-onpage`. Both corpora legitimately care about
 * alt text, heading order and the lang attribute, and if both fired the customer
 * would get every one of those twice with two different department names on it.
 * Duplicated findings make a report feel padded and teach a reader to skim, so
 * the overlap lives in one place and this file covers what that one does not.
 *
 * SECOND, it does not pretend to see what it cannot. Colour contrast, focus
 * order, tap target size and anything about how a screen reader actually
 * announces something all need rendering, computed styles or a real assistive
 * technology. None of that is available to a parser, so none of it is here, and
 * `cannotSee` on every report says so. A checker that claims a contrast result
 * from parsed HTML is guessing, and an accessibility report that a customer later
 * discovers was guessing is worse than no report.
 *
 * The marketing page promises this department covers "contrast, focus order,
 * labels, landmarks, keyboard path". Labels, landmarks and the structural half of
 * the keyboard path are real here. Contrast and true focus order are not, and
 * that gap is published rather than papered over.
 */
import { classifyRole } from "./aria-vocabulary.mjs";

export const CORPUS_ID = "accessibility";
export const CORPUS_VERSION = "a11y-2026.09";

export const collect = () => {
  /*
   * DEFINED INSIDE collect, and that is not a style choice.
   *
   * This function is SERIALISED and run inside the page, either by a browser's
   * evaluate or by the MCP server's parser, so it cannot see anything in this
   * module's scope. As a module-level constant this threw
   * `ReferenceError: NATIVELY_FOCUSABLE is not defined` from inside the page, on
   * the first real run. Third time in this session: any function that crosses
   * into another execution context takes nothing with it.
   *
   * Note also that the RULES below CAN use module scope, because their detect
   * functions run here in node against plain facts. Only collect crosses over.
   */
  const NATIVELY_FOCUSABLE = "a[href],button,input,select,textarea,summary,[contenteditable]";

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

  /**
   * The accessible NAME, computed the way it actually resolves rather than by
   * reading one attribute. Order matters: aria-labelledby wins, then aria-label,
   * then a wrapped image's alt, then the element's own text. Getting this order
   * wrong is how a checker reports a named element as unnamed.
   */
  const accessibleName = (el, doc) => {
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const named = labelledBy
        .split(/\s+/)
        .map((id) => doc.getElementById(id))
        .filter(Boolean)
        .map((n) => text(n))
        .join(" ")
        .trim();
      if (named) return named;
    }
    const ariaLabel = (el.getAttribute("aria-label") || "").trim();
    if (ariaLabel) return ariaLabel;
    const img = el.querySelector ? el.querySelector("img[alt]") : null;
    if (img) {
      const alt = (img.getAttribute("alt") || "").trim();
      if (alt) return alt;
    }
    const own = text(el);
    if (own) return own;
    const title = (el.getAttribute("title") || "").trim();
    return title;
  };

  const all = Array.from(document.querySelectorAll("*"));

  // Duplicate ids, which silently break every label-for and aria reference
  // pointing at them.
  const idCounts = {};
  for (const el of all) {
    const id = el.getAttribute("id");
    if (id) idCounts[id] = (idCounts[id] || 0) + 1;
  }

  const controls = Array.from(document.querySelectorAll("input,select,textarea")).map((el) => {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    const id = el.getAttribute("id");
    const wrappedInLabel = !!(el.closest && el.closest("label"));
    const labelFor = id ? !!document.querySelector(`label[for="${id}"]`) : false;
    return {
      tag: el.tagName.toLowerCase(),
      type,
      name: el.getAttribute("name") || "",
      id: id || "",
      selector: sel(el),
      hasLabelElement: wrappedInLabel || labelFor,
      ariaLabel: el.getAttribute("aria-label"),
      ariaLabelledby: el.getAttribute("aria-labelledby"),
      placeholder: el.getAttribute("placeholder"),
      autocomplete: el.getAttribute("autocomplete"),
      required: el.hasAttribute("required"),
      accessibleName: accessibleName(el, document),
    };
  });

  const interactive = Array.from(document.querySelectorAll("button,a[href],[role='button'],[role='link']")).map(
    (el) => ({
      tag: el.tagName.toLowerCase(),
      selector: sel(el),
      role: el.getAttribute("role") || "",
      accessibleName: accessibleName(el, document),
      hasImageChild: !!(el.querySelector && el.querySelector("img,svg")),
      href: el.getAttribute("href") || "",
    }),
  );

  const roles = all
    .filter((el) => el.getAttribute("role"))
    .map((el) => ({ selector: sel(el), role: el.getAttribute("role").trim(), tag: el.tagName.toLowerCase() }));

  const tabindexed = all
    .filter((el) => el.getAttribute("tabindex"))
    .map((el) => ({ selector: sel(el), tabindex: el.getAttribute("tabindex"), tag: el.tagName.toLowerCase() }));

  // aria-hidden on something that still takes focus: a keyboard user lands on an
  // element a screen reader refuses to announce.
  const hiddenButFocusable = all
    .filter((el) => el.getAttribute("aria-hidden") === "true")
    .flatMap((el) => {
      const inside = Array.from(el.querySelectorAll(NATIVELY_FOCUSABLE));
      const selfFocusable = el.matches && el.matches(NATIVELY_FOCUSABLE) ? [el] : [];
      return [...selfFocusable, ...inside]
        .filter((f) => f.getAttribute("tabindex") !== "-1")
        .map((f) => ({ selector: sel(f), tag: f.tagName.toLowerCase() }));
    });

  const labels = Array.from(document.querySelectorAll("label[for]")).map((el) => ({
    selector: sel(el),
    forId: el.getAttribute("for"),
    targetExists: !!document.getElementById(el.getAttribute("for")),
    text: text(el).slice(0, 60),
  }));

  const landmarks = {
    main: document.querySelectorAll("main, [role='main']").length,
    nav: document.querySelectorAll("nav, [role='navigation']").length,
    header: document.querySelectorAll("header, [role='banner']").length,
    footer: document.querySelectorAll("footer, [role='contentinfo']").length,
  };

  const tables = Array.from(document.querySelectorAll("table")).map((el) => ({
    selector: sel(el),
    headerCells: el.querySelectorAll("th").length,
    rows: el.querySelectorAll("tr").length,
    role: el.getAttribute("role") || "",
    hasCaption: !!el.querySelector("caption"),
  }));

  const media = Array.from(document.querySelectorAll("audio,video")).map((el) => ({
    tag: el.tagName.toLowerCase(),
    selector: sel(el),
    autoplay: el.hasAttribute("autoplay"),
    controls: el.hasAttribute("controls"),
    muted: el.hasAttribute("muted"),
    hasTrack: !!el.querySelector("track"),
  }));

  return {
    controls,
    interactive,
    roles,
    tabindexed,
    hiddenButFocusable,
    labels,
    landmarks,
    tables,
    media,
    duplicateIds: Object.entries(idCounts)
      .filter(([, n]) => n > 1)
      .map(([id, n]) => ({ id, count: n })),
    counts: {
      elements: all.length,
      controls: controls.length,
      interactive: interactive.length,
      roles: roles.length,
      tables: tables.length,
      media: media.length,
      bodyTextLength: text(document.body).length,
    },
  };
};

const at = (selector, observed) => ({ selector, observed });

export const RULES = [
  {
    id: "a11y.control-unlabelled",
    family: "labels",
    weight: 8,
    severity: "high",
    title: "A form control has no label of any kind",
    rationale:
      "A screen reader announces a control by its accessible name. With no label element, no " +
      "aria-label and no aria-labelledby, it announces the control type and nothing else, so the " +
      "user hears 'edit text' and has to guess what to type.",
    falsePositiveNote:
      "The accessible name is computed here in the real order, so a control named by a wrapping " +
      "label, a label[for], aria-label or aria-labelledby is not reported. What remains is genuinely " +
      "unnamed. It IS wrong on a hidden control used to carry state rather than take input, for " +
      "example a honeypot field or a CSRF token, which nobody is meant to fill in: those want " +
      "type=hidden, and if one is a visible input for technical reasons then this rule does not apply " +
      "to it.",
    prevention:
      "Give every control a label element tied to it by for and id, or wrap the control in the label.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.controls
        .filter((c) => c.type !== "hidden" && c.type !== "submit" && c.type !== "button")
        .filter((c) => !c.hasLabelElement && !c.ariaLabel && !c.ariaLabelledby)
        .map((c) =>
          at(
            c.selector,
            `<${c.tag}${c.type ? ` type="${c.type}"` : ""}${c.name ? ` name="${c.name}"` : ""}> with no ` +
              `label, aria-label or aria-labelledby` +
              (c.placeholder ? `, only placeholder "${c.placeholder}"` : ""),
          ),
        ),
  },
  {
    id: "a11y.placeholder-as-label",
    family: "labels",
    weight: 4,
    severity: "medium",
    title: "A control is labelled only by its placeholder, which disappears as soon as somebody types",
    rationale:
      "A placeholder is a hint, not a name. It vanishes on the first keystroke, so anybody " +
      "interrupted mid-form loses the only indication of what the field was for, and it is commonly " +
      "rendered at a contrast ratio too low to read.",
    falsePositiveNote:
      "Fires only where there is a placeholder AND an aria-label or aria-labelledby but no visible " +
      "label element, which is the case a checker looking at accessible names alone would pass. That " +
      "is a real pattern in compact search bars where a visible label is a genuine design decision " +
      "and the aria-label carries the name, so treat this as a question about that trade rather than " +
      "as a defect. It does not fire on a control with a real label element.",
    prevention:
      "Keep the placeholder as an example of the format and add a visible label above the field.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.controls
        .filter((c) => c.placeholder && !c.hasLabelElement && (c.ariaLabel || c.ariaLabelledby))
        .map((c) => at(c.selector, `placeholder "${c.placeholder}" with no visible label element`)),
  },
  {
    id: "a11y.interactive-no-name",
    family: "labels",
    weight: 8,
    severity: "high",
    title: "A button or link has no accessible name",
    rationale:
      "An icon-only button with no aria-label is announced as 'button' with no indication of what it " +
      "does. Screen reader users can list every link on a page out of context, and an unnamed entry " +
      "in that list is unusable.",
    falsePositiveNote:
      "The name is computed in the real resolution order including a wrapped image's alt text, so an " +
      "icon button whose img carries alt is not reported. It is wrong on a decorative anchor used " +
      "purely as a scroll target, which has no name because it needs none: those should not be " +
      "focusable at all, and the honest fix there is to remove the href rather than to invent a name.",
    prevention:
      "Every icon-only control gets an aria-label saying what it does, in the words a user would use.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.interactive
        .filter((el) => !el.accessibleName)
        .map((el) =>
          at(
            el.selector,
            `<${el.tag}${el.role ? ` role="${el.role}"` : ""}> has no accessible name` +
              (el.hasImageChild ? " and its image carries no alt text" : ""),
          ),
        ),
  },
  {
    id: "a11y.duplicate-id",
    family: "structure",
    weight: 6,
    severity: "high",
    title: "The same id is used more than once",
    rationale:
      "Every label-for, aria-labelledby and aria-describedby reference resolves to the FIRST element " +
      "with that id. A duplicate means one of those references silently points at the wrong element, " +
      "and nothing in a browser reports it.",
    falsePositiveNote:
      "Effectively never wrong, and it is worth saying why it looks harmless: duplicated ids often " +
      "produce a page that renders and behaves correctly for a sighted mouse user, because only " +
      "reference resolution breaks. The one legitimate case is a template fragment repeated by a " +
      "component that was never meant to appear twice on one page, and that is a real defect in the " +
      "component rather than a false positive here.",
    prevention: "Derive ids from something unique, or scope them to the component instance.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.duplicateIds.map((d) => at(`#${d.id}`, `id "${d.id}" appears ${d.count} times`)),
  },
  {
    id: "a11y.label-points-nowhere",
    family: "labels",
    weight: 5,
    severity: "medium",
    title: "A label points at an element that does not exist",
    rationale:
      "A label with for=\"email\" and no element with id=\"email\" labels nothing. The field is " +
      "unnamed to a screen reader and clicking the label does not focus the input, both of which " +
      "look fine to a sighted mouse user.",
    falsePositiveNote:
      "Wrong when the target is rendered by client-side script after this check reads the document, " +
      "which is why `counts.controls` is reported alongside: if that is zero the page may simply not " +
      "have rendered its form yet, and the honest reading is that this check saw a shell.",
    prevention: "Generate the for and the id from the same value so they cannot drift apart.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.labels
        .filter((l) => !l.targetExists)
        .map((l) => at(l.selector, `label for="${l.forId}" but no element has that id`)),
  },
  {
    id: "a11y.tabindex-positive",
    family: "keyboard",
    weight: 5,
    severity: "medium",
    title: "A positive tabindex forces this element ahead of the natural focus order",
    rationale:
      "Any tabindex above zero jumps that element to the front of the whole page's tab sequence, " +
      "ahead of everything with the default order. One positive value effectively requires every " +
      "other focusable element to be managed by hand, and the result is a tab order that does not " +
      "match the visible layout.",
    falsePositiveNote:
      "Not wrong often, but the exception is real: a deliberately managed order inside a complex " +
      "widget, such as a grid or a custom listbox that implements its own keyboard model, can use " +
      "positive values coherently. This rule reads the DOM and cannot tell a coherent scheme from an " +
      "accidental one, so check whether the values form a deliberate sequence before changing them.",
    prevention:
      "Use tabindex=\"0\" to make something focusable and tabindex=\"-1\" to take it out, and let " +
      "document order do the rest.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.tabindexed
        .filter((t) => Number(t.tabindex) > 0)
        .map((t) => at(t.selector, `<${t.tag} tabindex="${t.tabindex}">`)),
  },
  {
    id: "a11y.aria-hidden-focusable",
    family: "keyboard",
    weight: 7,
    severity: "high",
    title: "Something hidden from screen readers can still be focused",
    rationale:
      "aria-hidden=\"true\" tells a screen reader the element does not exist, but it does not remove " +
      "it from the tab order. A keyboard user tabs onto a control their screen reader refuses to " +
      "announce, so focus lands somewhere that reads as nothing at all.",
    falsePositiveNote:
      "Elements carrying tabindex=\"-1\" are excluded, because that is the correct pairing. It is " +
      "wrong when the element is also visually hidden by CSS in a way that removes it from focus, " +
      "such as display:none, because this reads parsed HTML and cannot see computed styles: a control " +
      "inside a closed menu will be reported and may be fine. Check whether the container is actually " +
      "rendered before acting.",
    prevention: "Pair aria-hidden=\"true\" with tabindex=\"-1\", or hide the element properly instead.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.hiddenButFocusable.map((h) =>
        at(h.selector, `<${h.tag}> is focusable inside an aria-hidden="true" element`),
      ),
  },
  {
    id: "a11y.role-not-in-vocabulary",
    family: "aria",
    weight: 5,
    severity: "medium",
    title: "A role is not a real ARIA role",
    rationale:
      "A misspelled or invented role is ignored, and the element falls back to whatever its tag " +
      "means. A div with role=\"buton\" is announced as a plain group, so the control that looked " +
      "labelled is silent.",
    falsePositiveNote:
      "Checked against a vendored snapshot of the WAI-ARIA 1.2 taxonomy, not against a hand-written " +
      "list, and the snapshot's date is recorded in corpus/aria-vocabulary.mjs. Two things follow. A " +
      "role added to a later specification than that snapshot would be reported wrongly, so check " +
      "the date before believing this about a very new role. And a role used inside a design system " +
      "that polyfills its own behaviour may be deliberate.",
    prevention: "Prefer the native element. When a role is genuinely needed, copy it from the spec.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.roles
        .filter((r) => classifyRole(r.role) === "unknown")
        .map((r) => at(r.selector, `<${r.tag} role="${r.role}"> is not an ARIA role`)),
  },
  {
    id: "a11y.role-is-abstract",
    family: "aria",
    weight: 4,
    severity: "medium",
    title: "An abstract role is used on an element, which the specification forbids",
    rationale:
      "Roles like widget, input and landmark exist to organise the taxonomy and the specification " +
      "explicitly forbids authors from using them. They are ignored on an element, so the element " +
      "silently keeps its native meaning.",
    falsePositiveNote:
      "Separated from the unknown-role rule ON PURPOSE, and that separation is the point. These roles " +
      "are real, published and spelled correctly, so a checker that only asks whether a role exists " +
      "passes them, and one that only knows concrete roles calls them typos, which sends the author " +
      "hunting a misspelling that is not there. A vocabulary has three states here, valid, abstract " +
      "and absent, and collapsing the middle one wastes somebody's afternoon.",
    prevention: "Use a concrete role that inherits from the abstract one, or the native element.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.roles
        .filter((r) => classifyRole(r.role) === "abstract")
        .map((r) =>
          at(r.selector, `<${r.tag} role="${r.role}"> is an ABSTRACT role, which authors may not use`),
        ),
  },
  {
    id: "a11y.no-main-landmark",
    family: "landmarks",
    weight: 4,
    severity: "medium",
    title: "The page has no main landmark",
    rationale:
      "Screen reader users navigate by landmark to skip past the header and navigation. With no main, " +
      "there is nothing to skip to, and reaching the content means tabbing through every link in the " +
      "menu on every page.",
    falsePositiveNote:
      "Wrong on a fragment that was never a whole page, such as an email template or an embedded " +
      "widget, where there is no document to have a main region. If the artifact is not a page " +
      "somebody navigates to, this rule does not apply and the report should be scoped instead.",
    prevention: "Wrap the page's own content in a main element, once per page.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.landmarks.main === 0
        ? [at("body", `no <main> and no role="main" (${f.counts.elements} elements on the page)`)]
        : [],
  },
  {
    id: "a11y.multiple-main-landmarks",
    family: "landmarks",
    weight: 3,
    severity: "low",
    title: "The page has more than one main landmark",
    rationale:
      "Two main regions means the page asserts two different things to be its content, so navigating " +
      "by landmark stops being a shortcut and becomes another list to read through.",
    falsePositiveNote:
      "Weak on purpose. A page rendering two views at once, such as a master and detail layout where " +
      "only one is visible at a time, can end up with two main elements where only one is displayed, " +
      "and this reads parsed HTML so it cannot see which. Check what is actually rendered.",
    prevention: "One main per page. Use section or article for the rest.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.landmarks.main > 1 ? [at("body", `${f.landmarks.main} main landmarks on one page`)] : [],
  },
  {
    id: "a11y.data-table-no-headers",
    family: "tables",
    weight: 5,
    severity: "medium",
    title: "A table of data has no header cells",
    rationale:
      "Header cells are what let a screen reader announce which column a value belongs to. Without " +
      "them a price table is read as a stream of numbers with no indication of what each one measures.",
    falsePositiveNote:
      "Tables with role=\"presentation\" or role=\"none\" are excluded, because those are declared as " +
      "layout rather than data and that declaration is the correct way to say so. Single-row tables " +
      "are also excluded, since one row is usually layout. What remains is a multi-row table claiming " +
      "to be data with nothing naming its columns.",
    prevention: "Use th for the header row, with scope=\"col\", and caption for what the table is.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.tables
        .filter((t) => !["presentation", "none"].includes(t.role))
        .filter((t) => t.rows > 1 && t.headerCells === 0)
        .map((t) => at(t.selector, `table with ${t.rows} rows and no th cells`)),
  },
  {
    id: "a11y.media-autoplay-uncontrolled",
    family: "media",
    weight: 6,
    severity: "high",
    title: "Audio or video plays automatically with no way to stop it",
    rationale:
      "Unexpected sound covers a screen reader's own speech, which makes the page unusable rather " +
      "than merely annoying, and there is no way to find the control that stops it if you cannot hear " +
      "the announcement telling you where it is.",
    falsePositiveNote:
      "Muted media is excluded, because a muted autoplaying video is a background decoration and " +
      "makes no sound. What remains is unmuted autoplay with no controls attribute. It is wrong if " +
      "script attaches controls after load, which this cannot see, so confirm in a browser before " +
      "concluding the page is silent about it.",
    prevention: "Do not autoplay sound. If media must autoplay, mute it and add controls.",
    since: "a11y-2026.09",
    detect: (f) =>
      f.media
        .filter((m) => m.autoplay && !m.muted && !m.controls)
        .map((m) => at(m.selector, `<${m.tag} autoplay> with no controls and not muted`)),
  },
];
