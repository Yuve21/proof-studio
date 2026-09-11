/**
 * The no-JS guarantee, gated rather than asserted in a comment.
 *
 * ScrollTheatre's header claims every beat's content is in the DOM whether or
 * not the enhancement runs. That claim is the difference between a flagship
 * hero and the defect our own `broken-things` seat exists to catch, and it is
 * exactly the kind of claim that stays true until somebody moves a render
 * branch and nobody notices, because the enhanced path still looks perfect in a
 * browser.
 *
 * So: render it the way a crawler, a reader with JS off, and the server itself
 * see it, and assert every beat's words survived.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlainTheatre } from "./plain.mjs";

const BEATS = [
  { ground: "#F2EDE4", ink: "#111", copy: h("p", null, "beat one copy") },
  { ground: "#F2EDE4", ink: "#111", copy: h("p", null, "beat two copy") },
  { ground: "#F2EDE4", ink: "#111", wipe: true, copy: h("p", null, "beat three copy") },
  { ground: "#E8161A", ink: "#F2EDE4", copy: h("p", null, "beat four copy") },
  { ground: "#F2EDE4", ink: "#111", copy: h("p", null, "beat five copy") },
  { ground: "#E8161A", ink: "#F2EDE4", shatter: "THE NOTTURNO EXPERIENCE" },
];

test("the server render contains every beat's content, not just the first", () => {
  const html = renderToStaticMarkup(h(PlainTheatre, { beats: BEATS }));
  for (const b of BEATS) {
    if (b.copy) {
      const words = b.copy.props.children;
      assert.ok(html.includes(words), `"${words}" is missing from the server render, so a reader with JS off never gets that beat`);
    }
  }
  assert.ok(html.includes("THE NOTTURNO EXPERIENCE"), "the wordmark only exists once the shatter runs");
});

test("the server render is the PLAIN path, with no pinned stage and no shards", () => {
  const html = renderToStaticMarkup(h(PlainTheatre, { beats: BEATS }));
  assert.match(html, /theatre--plain/, "the server rendered the enhanced path, which flashes the thing reduced-motion users asked not to see");
  assert.ok(!html.includes("theatre__shard"), "decorative shard clones reached the server render");
  assert.ok(!html.includes("theatre__stage"), "the pinned stage reached the server render");
});

test("the wordmark is real text, not an image or a pile of spans", () => {
  const html = renderToStaticMarkup(h(PlainTheatre, { beats: BEATS }));
  // One <p> carrying the whole string, so it is selectable and readable aloud.
  assert.match(html, /<p[^>]*>THE NOTTURNO EXPERIENCE<\/p>/);
});

test("it renders a single beat without dividing by zero", () => {
  const html = renderToStaticMarkup(h(PlainTheatre, { beats: [BEATS[0]] }));
  assert.ok(html.includes("beat one copy"));
});
