"use client";

/**
 * A pinned, scroll-driven scene machine. Six beats by default, hard cuts, one
 * accent colour, a striation wipe between scenes and a seeded type shatter at
 * the end.
 *
 * THE CONTENT IS IN THE DOM WHETHER OR NOT THIS RUNS. Every beat's art and copy
 * is rendered as an ordinary stacked section; the pinning, the wipe and the
 * shatter are an enhancement applied on top. With JavaScript off, with an error
 * thrown in this file, or with reduced motion requested, the page is a normal
 * scroll through six sections and nothing is missing. A hero that delivers its
 * content only through an animation is the shape our own `broken-things` seat
 * exists to catch, and shipping one from this repo would be embarrassing.
 *
 * No animation library. See components/ScrollTheatre/theatre.mjs for why, and
 * docs/MOTION-NOTTURNO-SCENE.md for what this is a rebuild of.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { beatAt, stripeWidth, shards, toPolygon, shardDrift, rng } from "./theatre.mjs";
import { PlainTheatre } from "./plain.mjs";

export type Beat = {
  /** Ground colour for this beat. Hard-cuts at the boundary; it never tweens. */
  ground: string;
  /** Ink/type colour, flipped in the same cut so there is never a frame of red on red. */
  ink: string;
  art?: React.ReactNode;
  copy?: React.ReactNode;
  /** Run the striation wipe on the way INTO this beat. */
  wipe?: boolean;
  /** Shatter the wordmark during this beat. One beat only, normally the last. */
  shatter?: string;
};

export function ScrollTheatre({
  beats,
  seed = 20260911,
  shardCount = 14,
  className = "",
}: {
  beats: Beat[];
  seed?: number;
  shardCount?: number;
  className?: string;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [enhanced, setEnhanced] = useState(false);

  /*
   * Enhancement is opt-IN at runtime, so the server-rendered markup is always
   * the plain stacked version. Rendering the pinned version on the server and
   * then discovering reduced motion on the client is a flash of the thing the
   * user asked not to see.
   */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 767px)");
    const decide = () => setEnhanced(!mq.matches && !narrow.matches);
    decide();
    mq.addEventListener("change", decide);
    narrow.addEventListener("change", decide);
    return () => {
      mq.removeEventListener("change", decide);
      narrow.removeEventListener("change", decide);
    };
  }, []);

  useEffect(() => {
    if (!enhanced) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      // A section shorter than the viewport has no travel; guard the divide
      // rather than letting it produce Infinity and pin at beat 0 forever.
      setProgress(travel <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / travel)));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enhanced]);

  const { index, within } = beatAt(progress, beats.length);
  const current = beats[index] ?? beats[0];

  /* Generated once per (seed, count). A shatter that regenerates on re-render
   * is a different shatter every time React feels like it. */
  const polygons = useMemo(
    () => shards(seed, shardCount).map(toPolygon),
    [seed, shardCount],
  );
  const drifts = useMemo(() => {
    const r = rng(seed ^ 0x5f3759df);
    return Array.from({ length: shardCount }, (_, i) => ({ i, r: [r(), r(), r()] }));
  }, [seed, shardCount]);

  // The always-delivered path lives in plain.mjs so a test can import it
  // without a JSX transform. It was a branch in here, which meant the no-JS
  // guarantee was a comment rather than something anything could check.
  if (!enhanced) return <PlainTheatre beats={beats} className={className} />;

  return (
    <section
      ref={sectionRef}
      className={`theatre ${className}`}
      style={{ height: `${beats.length * 100}vh` }}
    >
      <div className="theatre__stage" style={{ background: current.ground, color: current.ink }}>
        {beats.map((b, i) => (
          <div key={i} className="theatre__beat" hidden={i !== index} aria-hidden={i !== index}>
            {b.art}
            {b.copy}
            {b.shatter ? (
              <div className="theatre__shatter">
                {/* The real, selectable, accessible text. It stays in the DOM
                    and stays readable to a screen reader while the shards are
                    on screen; it is only the PAINT that moves to the clones,
                    so the wordmark is never something only sighted users get. */}
                <p className={`theatre__wordmark${i === index ? " theatre__wordmark--masked" : ""}`}>
                  {b.shatter}
                </p>
                {i === index
                  ? polygons.map((clip, s) => {
                      // Each shard draws its three numbers in order from its own
                      // pre-drawn triple. Returning the same number three times
                      // would tie x, y and rotation together and every shard
                      // would move along the same diagonal.
                      let k = 0;
                      const seeded = () => drifts[s].r[k++ % 3];
                      const d = shardDrift(s, polygons.length, within, seeded);
                      return (
                        <p
                          key={s}
                          aria-hidden
                          className="theatre__wordmark theatre__shard"
                          style={{
                            clipPath: clip,
                            transform: `translate(${d.x}%, ${d.y}%) rotate(${d.rotate}deg)`,
                          }}
                        >
                          {b.shatter}
                        </p>
                      );
                    })
                  : null}
              </div>
            ) : null}
          </div>
        ))}

        {current.wipe ? (
          <div
            className="theatre__wipe"
            aria-hidden
            style={{ ["--stripe" as string]: `${stripeWidth(within)}px` }}
          />
        ) : null}
      </div>
    </section>
  );
}

export default ScrollTheatre;
