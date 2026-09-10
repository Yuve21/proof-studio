/**
 * Mechanical HTML to JSX conversion for the Proof marketing markup.
 *
 * This exists instead of retyping 24KB of hand-tuned markup by hand, because a
 * hand port of a scroll narrative fails silently: the page still renders, one
 * element loses a data attribute, and a GSAP selector quietly matches nothing.
 *
 * It is deliberately NOT general purpose. It handles exactly the constructs this
 * one file contains, and it THROWS on anything it was not built to express,
 * because a converter that passes through what it cannot parse is the same defect
 * as a regex that cannot express its input: it fails in silence and reads as a
 * clean result.
 *
 * Verified by scripts/verify-dom-parity.mjs, which renders the Next route and the
 * original static file in a real browser and diffs the resulting DOM. The
 * converter being "correct" is not the claim; the DOM matching is.
 */
import { readFileSync, writeFileSync } from "node:fs";

const VOID = new Set([
  "br", "hr", "img", "input", "meta", "link", "source", "area", "base", "col",
  "embed", "param", "track", "wbr",
  // SVG shapes that appear unclosed in this file
  "path", "circle", "ellipse", "polygon", "polyline", "line", "rect", "use", "stop",
]);

// Attribute renames. Anything hyphenated and NOT in here, and not data-/aria-,
// is a hard failure rather than a pass-through.
const RENAME = {
  class: "className",
  for: "htmlFor",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "stroke-opacity": "strokeOpacity",
  "fill-opacity": "fillOpacity",
  "fill-rule": "fillRule",
  "clip-path": "clipPath",
  "clip-rule": "clipRule",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "text-anchor": "textAnchor",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "letter-spacing": "letterSpacing",
  "dominant-baseline": "dominantBaseline",
  "shape-rendering": "shapeRendering",
  "vector-effect": "vectorEffect",
  "paint-order": "paintOrder",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  colspan: "colSpan",
  rowspan: "rowSpan",
  srcset: "srcSet",
  crossorigin: "crossOrigin",
  novalidate: "noValidate",
  enctype: "encType",
  accesskey: "accessKey",
  contenteditable: "contentEditable",
  spellcheck: "spellCheck",
  autoplay: "autoPlay",
  playsinline: "playsInline",
};

// Boolean attributes: `required` becomes `required={true}` implicitly in JSX, so
// a bare attribute is fine. Listed so an unknown bare attribute still throws.
const BOOLEAN = new Set([
  "required", "disabled", "checked", "selected", "readonly", "multiple", "hidden",
  "autofocus", "novalidate", "autoplay", "controls", "loop", "muted", "playsinline",
  "defer", "async", "open", "reversed", "download", "itemscope",
]);

const styleToObject = (css, where) => {
  const out = [];
  for (const decl of css.split(";")) {
    const t = decl.trim();
    if (!t) continue;
    const i = t.indexOf(":");
    if (i < 0) throw new Error(`unparseable style declaration "${t}" in ${where}`);
    const prop = t.slice(0, i).trim();
    const value = t.slice(i + 1).trim();
    // A custom property keeps its name verbatim and must be quoted as a key.
    const key = prop.startsWith("--")
      ? JSON.stringify(prop)
      : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out.push(`${key}: ${JSON.stringify(value)}`);
  }
  if (!out.length) throw new Error(`empty style attribute in ${where}`);
  // A CSS custom property is valid at runtime and absent from React's
  // CSSProperties, so TypeScript rejects it. The cast is the standard escape and
  // it is worth noting HOW this was found: `tsc` and `next build` both failed on
  // it and a browser would not have, because the property works fine at runtime.
  // A mutation aimed at a type is invisible to a runtime check.
  const cast = out.some((d) => d.startsWith('"--')) ? " as React.CSSProperties" : "";
  return `{{ ${out.join(", ")} }${cast}}`;
};

const convertAttrs = (raw, tag) => {
  if (!raw || !raw.trim()) return "";
  const parts = [];
  // name="value" | name='value' | name
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  let m;
  let consumed = "";
  while ((m = re.exec(raw)) !== null) {
    consumed += m[0];
    const name = m[1];
    const hasValue = m[2] !== undefined || m[3] !== undefined;
    const value = m[2] !== undefined ? m[2] : m[3];

    if (name === "style") {
      if (!hasValue) throw new Error(`bare style attribute on <${tag}>`);
      parts.push(`style=${styleToObject(value, `<${tag}>`)}`);
      continue;
    }
    let out = name;
    if (RENAME[name]) out = RENAME[name];
    else if (name.startsWith("data-") || name.startsWith("aria-")) out = name;
    else if (name.includes("-")) {
      throw new Error(
        `<${tag}> carries hyphenated attribute "${name}" with no rename rule. ` +
        `Add it to RENAME rather than letting it through: React would drop it silently.`,
      );
    }
    if (!hasValue) {
      // A bare data- or aria- attribute is valid HTML and lands in the DOM as
      // an EMPTY string. Passing it bare to JSX makes it `true`, which React
      // renders as data-x="true". GSAP selectors here are attribute-presence
      // based, so that particular difference would not break them, but a DOM
      // diff would show it and a value comparison anywhere else would. Emit the
      // empty string so the rendered DOM is identical to the static file.
      if (name.startsWith("data-") || name.startsWith("aria-")) {
        parts.push(`${out}=""`);
        continue;
      }
      if (!BOOLEAN.has(name.toLowerCase())) {
        throw new Error(`<${tag}> has bare non-boolean attribute "${name}"`);
      }
      parts.push(out);
      continue;
    }
    // A value containing a brace would be read as an expression by JSX.
    if (/[{}]/.test(value)) throw new Error(`<${tag}> attribute "${name}" contains a brace`);
    parts.push(`${out}="${value}"`);
  }
  // Completeness check: everything in the attribute blob must have been consumed
  // by the tokeniser, or something was silently skipped.
  const norm = (s) => s.replace(/\s+/g, "");
  if (norm(consumed) !== norm(raw)) {
    throw new Error(
      `attribute tokeniser did not consume the whole blob on <${tag}>.\n` +
      `  raw:      ${raw.trim()}\n  consumed: ${consumed.trim()}`,
    );
  }
  return parts.length ? " " + parts.join(" ") : "";
};

export function htmlToJsx(html) {
  let selfClosed = 0;
  const jsx = html.replace(
    /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)(\/?)>/g,
    (_all, tag, attrs, slash) => {
      const converted = convertAttrs(attrs, tag);
      if (slash === "/") return `<${tag}${converted} />`;
      if (VOID.has(tag.toLowerCase())) {
        selfClosed += 1;
        return `<${tag}${converted} />`;
      }
      return `<${tag}${converted}>`;
    },
  );
  if (/<!--/.test(jsx)) throw new Error("HTML comment survived; JSX needs {/* */}");
  return { jsx, selfClosed };
}

if (process.argv[2]) {
  const [, , inFile, outFile] = process.argv;
  const { jsx, selfClosed } = htmlToJsx(readFileSync(inFile, "utf8"));
  writeFileSync(outFile, jsx);
  console.log(`converted ${inFile} -> ${outFile}: ${selfClosed} void tag(s) self-closed`);
}
