/**
 * The no-JS path, on its own, in plain .mjs.
 *
 * WHY IT IS A SEPARATE MODULE. This is the version a crawler reads, the version
 * a reader with JS off gets, the version that renders on the server, and the
 * version somebody who asked for reduced motion keeps. It is the only path that
 * is ALWAYS delivered, and it was a branch inside a .tsx file that no test could
 * import, so the guarantee lived in a comment.
 *
 * Written with createElement rather than JSX so `node --test` can run it with no
 * transform, which is the same reason the corpora are .mjs.
 *
 * It is not a degraded version. It carries every beat's art and copy, in order,
 * with the grounds and ink colours applied. Nothing is withheld for the people
 * who cannot run the animation.
 */
import { createElement as h } from "react";

export function PlainTheatre({ beats, className = "" }) {
  return h(
    "div",
    { className: `theatre theatre--plain ${className}`.trim() },
    beats.map((b, i) =>
      h(
        "section",
        { key: i, className: "theatre__plainBeat", style: { background: b.ground, color: b.ink } },
        b.art ?? null,
        b.shatter ? h("p", { className: "theatre__wordmark" }, b.shatter) : null,
        b.copy ?? null,
      ),
    ),
  );
}

export default PlainTheatre;
