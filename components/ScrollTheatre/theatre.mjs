/**
 * The arithmetic behind <ScrollTheatre>, kept separate from the component so it
 * can be gated without a browser.
 *
 * WHY THESE FUNCTIONS ARE PURE. Animation is the easiest thing in a codebase to
 * ship broken, because it is reviewed by looking at it and it looks fine at the
 * moment somebody looks. The parts that fail SILENTLY are arithmetic: a beat
 * boundary that lands a frame early, shards that leave a hairline gap through
 * the middle of a wordmark, a "seeded" random that reseeds on every mount so the
 * thing you approved is not the thing that ships. All three are decidable
 * without rendering, so all three get a test.
 *
 * No dependency. GSAP would be the house stack for a client build with a real
 * motion budget, and this deliberately does not reach for it: the site that
 * sells a performance seat should not put 60 KB on a marketing page to move six
 * images. Everything here is a CSS custom property driven by one rAF-throttled
 * scroll read.
 */

/**
 * Deterministic PRNG (mulberry32). SEEDED ON PURPOSE.
 *
 * A shatter built from Math.random() is a different shatter on every load, which
 * means the version somebody approved is not the version a customer sees and no
 * screenshot of it is evidence of anything. The seed is part of the design, the
 * same way a colour is.
 */
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which beat a scroll progress falls in, and how far through it.
 *
 * `progress` is 0..1 across the whole pinned section. Boundaries are closed at
 * the bottom and open at the top, so beat N starts EXACTLY at its boundary and
 * there is no frame where two beats are both active. The final boundary is
 * inclusive or the last frame of the piece would render beat 0.
 */
export function beatAt(progress, beats) {
  if (!Number.isFinite(progress) || beats < 1) return { index: 0, within: 0 };
  const p = Math.min(1, Math.max(0, progress));
  const raw = p * beats;
  const index = Math.min(beats - 1, Math.floor(raw));
  return { index, within: raw - index };
}

/**
 * The striation wipe's stripe width, in pixels, for a progress through ONE beat.
 *
 * Opens and closes: 0 at the start, `max` at the middle, 0 again at the end, so
 * the wipe reveals the next scene rather than leaving a permanent barcode over
 * it. Eased so the shred is fast and the recovery is slow, which is what makes
 * it read as a pulled squeegee rather than a dissolve.
 */
export function stripeWidth(within, max = 14) {
  const t = Math.min(1, Math.max(0, within));
  const triangle = 1 - Math.abs(t * 2 - 1);
  return +(max * (1 - Math.pow(1 - triangle, 3))).toFixed(3);
}

/**
 * Tear a box into `count` vertical shards with jagged edges.
 *
 * Returns one `clip-path: polygon()` point list per shard, in percentages.
 *
 * THE INVARIANT THAT MATTERS: adjacent shards share their boundary polyline
 * EXACTLY, and the outer edges sit on 0 and 100. That is what stops a hairline
 * of background showing through the middle of a word, which is the defect this
 * technique produces when the polygons are generated independently. It is
 * decidable here and invisible in review, so it is asserted rather than eyeballed.
 *
 * @param {number} seed
 * @param {number} count   how many shards
 * @param {number} jag     max horizontal wander of a boundary, in percent
 * @param {number} steps   vertical points per boundary; more is more torn
 */
export function shards(seed, count = 14, jag = 2.2, steps = 5) {
  if (count < 2) throw new Error("shards(): fewer than two shards is not a tear");
  const next = rng(seed);

  // Build every boundary ONCE, then share it between the two shards that meet
  // on it. Generating each shard's own edges is the bug.
  const boundaries = [];
  for (let i = 0; i <= count; i += 1) {
    const x = (i / count) * 100;
    const edge = i === 0 || i === count;
    const line = [];
    for (let s = 0; s < steps; s += 1) {
      const y = (s / (steps - 1)) * 100;
      // The outer two boundaries stay dead straight: a torn OUTER edge would
      // clip the glyphs themselves rather than the gap between shards.
      const wander = edge ? 0 : (next() * 2 - 1) * jag;
      line.push([+(x + wander).toFixed(3), +y.toFixed(3)]);
    }
    boundaries.push(line);
  }

  return boundaries.slice(0, -1).map((left, i) => {
    const right = boundaries[i + 1];
    return [...left, ...[...right].reverse()];
  });
}

/** A point list as a CSS polygon() value. */
export const toPolygon = (points) =>
  `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;

/**
 * How far one shard travels at a given progress.
 *
 * Capped deliberately. The reference displaces by roughly 2-6% of the width and
 * never more, because the wordmark has to stay READABLE as a wordmark: past
 * about 8% it stops reading as torn paper and starts reading as an explosion,
 * which is a different and much cheaper effect.
 */
export function shardDrift(index, count, within, seedFn) {
  const t = Math.min(1, Math.max(0, within));
  const ease = 1 - Math.pow(1 - t, 3);
  // 20ms-equivalent stagger expressed as a fraction of the beat, so the piece
  // tears left to right instead of detonating.
  const stagger = (index / count) * 0.25;
  const local = Math.min(1, Math.max(0, (ease - stagger) / (1 - stagger || 1)));
  const r = seedFn ?? rng(index + 1);
  const dx = (r() * 2 - 1) * 6;
  const dy = (r() * 2 - 1) * 4;
  const rot = (r() * 2 - 1) * 4;
  return { x: +(dx * local).toFixed(3), y: +(dy * local).toFixed(3), rotate: +(rot * local).toFixed(3) };
}

export const MAX_DRIFT_PERCENT = 8;
