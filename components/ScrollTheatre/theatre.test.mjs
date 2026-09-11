/**
 * Gates for the parts of the scroll theatre that fail silently.
 *
 * Every test here corresponds to a defect that would ship looking correct:
 * a seam through a wordmark, a beat boundary that renders two scenes, a
 * "seeded" shatter that is different on every load, a drift big enough that the
 * type stops being type.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, beatAt, stripeWidth, shards, toPolygon, shardDrift, MAX_DRIFT_PERCENT } from "./theatre.mjs";

test("the seeded rng is deterministic, and two seeds differ", () => {
  const a = rng(7), b = rng(7), c = rng(8);
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()], seqC = [c(), c(), c()];
  assert.deepEqual(seqA, seqB, "same seed produced a different sequence, so nothing here is reproducible");
  assert.notDeepEqual(seqA, seqC, "two seeds produced the same sequence, so the seed does nothing");
  for (const v of seqA) assert.ok(v >= 0 && v < 1, `rng returned ${v}, outside [0,1)`);
});

test("beats partition the scroll exactly, with no frame showing two", () => {
  const beats = 6;
  for (let i = 0; i < beats; i += 1) {
    const start = beatAt(i / beats, beats);
    assert.equal(start.index, i, `progress at the start of beat ${i} resolved to beat ${start.index}`);
    assert.ok(Math.abs(start.within) < 1e-9, `beat ${i} does not start at within=0`);
  }
  assert.equal(beatAt(1, beats).index, beats - 1, "the last frame fell off the end and rendered beat 0");
  assert.equal(beatAt(0, beats).index, 0);
  // Out of range is clamped rather than throwing: a rubber-band scroll on iOS
  // reports progress outside 0..1 every time somebody overscrolls.
  assert.equal(beatAt(-0.4, beats).index, 0);
  assert.equal(beatAt(1.7, beats).index, beats - 1);
});

test("the wipe opens and closes, so it never leaves a permanent barcode", () => {
  assert.equal(stripeWidth(0), 0);
  assert.equal(stripeWidth(1), 0);
  assert.ok(stripeWidth(0.5) > 13, "the wipe never reaches full stripe width at the midpoint");
  assert.ok(stripeWidth(0.5) <= 14);
  for (const t of [-1, 0.25, 0.75, 2]) {
    const w = stripeWidth(t);
    assert.ok(w >= 0 && w <= 14, `stripe width ${w} out of range at ${t}`);
  }
});

test("shards tile the box with no gap and no overlap at the boundaries", () => {
  const count = 14;
  const list = shards(1234, count);
  assert.equal(list.length, count);

  const steps = list[0].length / 2;
  for (let i = 0; i < count - 1; i += 1) {
    // The right edge of shard i, read back out of the polygon, must be the
    // left edge of shard i+1, point for point. A near-match is a hairline.
    const rightOfI = list[i].slice(steps).reverse();
    const leftOfNext = list[i + 1].slice(0, steps);
    assert.deepEqual(
      rightOfI, leftOfNext,
      `shards ${i} and ${i + 1} do not share a boundary exactly, which shows as a seam through the word`,
    );
  }

  // The outer edges are straight and flush, or the tear clips the glyphs.
  for (const [x] of list[0].slice(0, steps)) assert.equal(x, 0, "the left edge wanders, so the first letter is clipped");
  for (const [x] of list[count - 1].slice(steps)) assert.equal(x, 100, "the right edge wanders");
});

test("the same seed shatters the same way twice", () => {
  assert.deepEqual(shards(99, 10), shards(99, 10), "the shatter is different on every call, so no approval of it means anything");
  assert.notDeepEqual(shards(99, 10), shards(100, 10));
});

test("fewer than two shards is refused rather than silently rendered whole", () => {
  assert.throws(() => shards(1, 1), /not a tear/);
});

test("toPolygon emits a valid-looking polygon()", () => {
  const css = toPolygon([[0, 0], [100, 0], [100, 100]]);
  assert.match(css, /^polygon\(0% 0%, 100% 0%, 100% 100%\)$/);
});

test("drift stays under the readability cap at full progress", () => {
  const count = 14;
  for (let i = 0; i < count; i += 1) {
    const d = shardDrift(i, count, 1);
    assert.ok(Math.abs(d.x) <= MAX_DRIFT_PERCENT, `shard ${i} drifts ${d.x}%, past the point the wordmark reads as a wordmark`);
    assert.ok(Math.abs(d.y) <= MAX_DRIFT_PERCENT);
    assert.ok(Math.abs(d.rotate) <= 5);
  }
});

test("drift is zero before the beat starts and monotonic through it", () => {
  const at = (t) => Math.abs(shardDrift(0, 14, t, rng(1)).x);
  assert.equal(shardDrift(3, 14, 0).x, 0, "shards have already moved at the start of the beat");
  const seq = [0, 0.25, 0.5, 0.75, 1].map(at);
  for (let i = 1; i < seq.length; i += 1) {
    assert.ok(seq[i] >= seq[i - 1] - 1e-9, `drift went backwards between ${i - 1} and ${i}, which reads as a bounce nobody asked for`);
  }
});

/*
 * MUTATION CHECK. The seam test is the one that would be satisfied by its own
 * existence if shards() ever generated each edge independently, so prove the
 * comparison can actually fail.
 */
test("the seam check can fail", () => {
  const list = shards(5, 6);
  const steps = list[0].length / 2;
  const broken = list.map((s) => [...s]);
  broken[1][0] = [broken[1][0][0] + 0.5, broken[1][0][1]];
  const rightOf0 = broken[0].slice(steps).reverse();
  const leftOf1 = broken[1].slice(0, steps);
  assert.notDeepEqual(rightOf0, leftOf1, "a deliberately broken boundary still compared equal, so the seam test proves nothing");
});
