/**
 * The ARIA role vocabulary, VENDORED AS DATA.
 *
 * WHY THIS IS A SEPARATE FILE AND NOT A REGEX. An enumeration is a hypothesis
 * about your input, exactly as a regex is. When the input's vocabulary is
 * published by somebody else, the discipline this house follows is: vendor their
 * list as data, keep it in a DIFFERENT file from your own logic, and compare the
 * two in BOTH directions, because deriving one from the other makes the check a
 * mirror rather than a comparison.
 *
 * The sibling product paid for that lesson twice. A hand-written enumeration
 * could express 5 of 20 published concepts and nobody knew until the two lists
 * were counted against each other, and the gaps did not all fail in the same
 * direction: a missing term on the counter side RAISED a score, which is the
 * direction that accuses honest work.
 *
 * SOURCE: WAI-ARIA 1.2 role taxonomy, W3C Recommendation 2023-06-06, the
 * abstract-role and concrete-role lists in section 5.4. Retrieved 2026-09-10.
 *
 * WHAT THIS FILE CANNOT DO, said here rather than left for a reader to assume:
 * it cannot tell you whether this snapshot is current, because nothing in this
 * repository makes a network request. Refreshing it is a manual step against the
 * specification, and the date above is the only claim about freshness.
 */

/** Concrete roles an author may legitimately put on an element. */
export const CONCRETE_ROLES = new Set([
  "alert", "alertdialog", "application", "article", "banner", "blockquote", "button",
  "caption", "cell", "checkbox", "code", "columnheader", "combobox", "complementary",
  "contentinfo", "definition", "deletion", "dialog", "directory", "document", "emphasis",
  "feed", "figure", "form", "generic", "grid", "gridcell", "group", "heading", "img",
  "insertion", "link", "list", "listbox", "listitem", "log", "main", "marquee", "math",
  "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "meter", "navigation",
  "none", "note", "option", "paragraph", "presentation", "progressbar", "radio", "radiogroup",
  "region", "row", "rowgroup", "rowheader", "scrollbar", "search", "searchbox", "separator",
  "slider", "spinbutton", "status", "strong", "subscript", "superscript", "switch", "tab",
  "table", "tablist", "tabpanel", "term", "textbox", "time", "timer", "toolbar", "tooltip",
  "tree", "treegrid", "treeitem",
]);

/**
 * ABSTRACT roles, which are the interesting half.
 *
 * These are real, published, spelled correctly, and MUST NOT appear on an
 * element: the specification says they are for the taxonomy only and authors are
 * forbidden from using them. So a checker that only asks "is this role in the
 * vocabulary" passes them, and a checker that only knows concrete roles reports
 * them as a typo, which sends the author looking for a misspelling that is not
 * there.
 *
 * Three states, not two: valid, ABSTRACT, and absent. That is the same shape as
 * the retired-versus-absent distinction the sibling product got wrong once, where
 * comparing against the active half of a vocabulary read a retired term as an
 * invention.
 */
export const ABSTRACT_ROLES = new Set([
  "command", "composite", "input", "landmark", "range", "roletype", "section",
  "sectionhead", "select", "structure", "widget", "window",
]);

/** Roles that define a landmark, used by the landmark rules. */
export const LANDMARK_ROLES = new Set([
  "banner", "complementary", "contentinfo", "form", "main", "navigation", "region", "search",
]);

/**
 * Classify a role token.
 *
 * @returns {"valid"|"abstract"|"unknown"}
 */
export function classifyRole(role) {
  const token = String(role || "").trim().toLowerCase();
  if (!token) return "unknown";
  if (CONCRETE_ROLES.has(token)) return "valid";
  if (ABSTRACT_ROLES.has(token)) return "abstract";
  return "unknown";
}

/**
 * Every role name in the vendored snapshot. Exported so a test can compare it
 * against the checker's own expectations in both directions, which is the whole
 * reason this file is separate.
 */
export const ALL_ROLES = new Set([...CONCRETE_ROLES, ...ABSTRACT_ROLES]);
