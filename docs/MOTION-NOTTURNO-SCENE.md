# Scroll scene: the "Notturno" ink-theatre, rebuilt as a Proof component

Status: SPEC, 2026-09-11. Reference read frame by frame from
`instagram.com/reels/DdIPYHuxoDS` (a screen recording of a site the poster captioned
"POV: Gpt-6 Astra COOKED"). 18.7s, ~18 frames pulled at 1s and inspected.

This is a **clone of the mechanism, not of the artwork**. The illustrations in the reference are
somebody's drawings for a fashion house and do not come with us. What transfers is the scene
machine, the transition, and the type treatment, all three of which are reusable across any client
with a strong visual identity and a story to tell in one scroll.

---

## What the reference actually does

Six beats, scroll-scrubbed, in a pinned viewport. Everything is flat 2-D ink work: black line and
hatching on warm off-white, exactly one accent colour, no photography except a single inset.

| Beat | t | What is on screen |
|---|---|---|
| 1 | 0.0–2.5 | Hero. Display serif wordmark, cream, letter-spaced wide, set OVER an ink cloud-bank illustration that occupies the lower half. Nav is three words, upper right. |
| 2 | 2.5–6.5 | A seated hooded figure from behind, filled ochre, the only warm mass in the frame, looking down a hatched colonnade to a vanishing point. A floating sphere upper right, a red disc mid-right, a body-copy panel upper left. |
| 3 | 6.5–8.5 | **The transition.** The whole scene shreds into vertical ink striations, black on cream, like a pulled squeegee. A red form and an arc surface through it. |
| 4 | 8.5–10.5 | Ground flips to flood red. Black colonnade in silhouette, an inset rectangle at top holding a pair of hatched eyes, three tiny bottles centred on a plinth far below. Scale inversion is the whole point of the beat. |
| 5 | 10.5–14 | Product. The same three bottles, now large, on a white plinth, against the striation curtain. Blue, green, yellow: the only place in the piece where more than one accent exists. |
| 6 | 14–18.7 | Finale. Full red ground, wordmark in cream, **fragmenting into torn-paper shards** that drift and separate without ever fully leaving. |

The craft lesson is restraint: one typeface, one ink weight, one accent, and every beat is a hard
cut rather than a fade. The energy comes from the striation wipe and the shatter, not from
movement inside the scenes.

---

## The component: `<ScrollTheatre>`

One pinned section, N beats, scroll drives a single timeline. Stack is GSAP + ScrollTrigger, which
is the house motion stack for client work.

```
<ScrollTheatre beats={6} height="600vh">
  <Beat layer="ground" />        // flat colour, cross-cuts on beat boundaries
  <Beat layer="art" />           // one SVG or PNG per beat, absolutely positioned
  <Beat layer="type" />          // the wordmark and any panel copy
  <Wipe kind="striation" />      // the transition, sits above art, below type
</ScrollTheatre>
```

### 1. The scene machine

```js
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: sectionRef.current,
    start: 'top top',
    end: '+=600%',          // one viewport of scroll per beat
    pin: true,
    scrub: 0.6,             // NOT true. 0.6 keeps the shards moving a beat after the wheel stops
    anticipatePin: 1,
  },
})
```

Each beat is a label, and beats hard-cut: set `autoAlpha` to 0/1 at the boundary rather than
tweening it. The reference never cross-fades and the piece would go soft if it did.

Give every beat a tiny internal drift so a paused scroll is not a still image: a 2–4% scale creep
on the art layer over the beat's whole duration, ease `none`. That is what makes it read as a held
shot rather than a JPEG.

### 2. The striation wipe (beat 3, and reusable)

No WebGL. A repeating-linear-gradient mask whose stripe width animates from 0 to full.

```css
.striation {
  -webkit-mask-image: repeating-linear-gradient(
    90deg,
    #000 0 var(--stripe),
    transparent var(--stripe) calc(var(--stripe) * 2)
  );
  mask-image: repeating-linear-gradient(90deg, #000 0 var(--stripe), transparent var(--stripe) calc(var(--stripe)*2));
}
```

```js
tl.fromTo(wipeRef.current,
  { '--stripe': '0px' },
  { '--stripe': '14px', duration: 1, ease: 'power2.inOut' }, 'beat3')
```

Two layers of this at different stripe widths and opposite directions gives the torn, uneven edge
the reference has; a single uniform mask reads as a barcode. Register `--stripe` with
`CSS.registerProperty({ name: '--stripe', syntax: '<length>', initialValue: '0px', inherits: false })`
so it interpolates rather than snapping.

### 3. The shatter (beat 6)

The wordmark breaks into torn paper. Done with duplicated text layers under `clip-path` polygons,
which keeps the type as real selectable text underneath and needs no canvas.

1. Render the wordmark once, visible, as the accessible text.
2. Render 12–18 `aria-hidden` clones absolutely stacked on it, each with an irregular
   `clip-path: polygon(...)` covering one shard. Generate the polygons once at build time from a
   seeded Voronoi over the type's bounding box; do not randomise per load, or the piece is
   different every visit and cannot be reviewed.
3. Hide the original at the beat boundary, then tween each clone on `x`, `y`, `rotate` by a small
   amount — the reference displaces by roughly 2–6% of the width, never more. The shards must stay
   legible as a wordmark.

```js
shards.forEach((el, i) => {
  tl.to(el, {
    x: gsap.utils.random(-28, 28, 1, true)(),
    y: gsap.utils.random(-18, 18, 1, true)(),
    rotate: gsap.utils.random(-4, 4, 0.1, true)(),
    duration: 1, ease: 'power3.out',
  }, 'beat6+=' + i * 0.02)   // 20ms stagger, so it tears rather than explodes
})
```

Seed the randomness (`gsap.utils.random(..., true)` returns a function; call it once at module load
and freeze the values) for the same reviewability reason.

### 4. The ground flip

`background-color` on the section, stepped at beat boundaries with `ease: 'steps(1)'`. Cream
`#F2EDE4` → red `#E8161A` → back. Flip the type colour in the same tween so there is never a frame
of red-on-red.

---

## Constraints this has to meet before it ships to a client

- **`prefers-reduced-motion`.** Kill the pin and the scrub entirely; render the six beats as a
  normal stacked scroll with the art and type static. Not a shorter animation, no animation.
- **Weight.** The reference is six full-bleed illustrations. Budget 6 × ~120 KB as AVIF with WebP
  fallback, `loading="eager"` on beat 1 only and `fetchpriority="high"` on it, the rest lazy and
  preloaded one beat ahead. If the art is line work, SVG will usually beat both — try it first.
- **Mobile.** 600vh of pinned scroll on a phone is a hostage situation. Below 768px, drop to four
  beats, unpin, and keep only the striation wipe between sections.
- **The site must work with JS off.** All six beats' art and copy present in the DOM, stacked.
  ScrollTrigger enhances; it does not deliver the content.
- **It has to pass our own detector.** This is the house product: a scroll-jacking hero with no
  content behind it is exactly the shape `template-tells` and `broken-things` exist to catch. Run
  the page through Proof before it goes to a client, and fix what it says about us.

---

## Where it fits

This is a **flagship** treatment, not a default. It suits a client with real artwork and one story:
a restaurant, a fashion or fragrance label, a distillery, a venue. It is wrong for a plumber, and
offering it to one is how an agency ends up with a beautiful site nobody can update.

Build it once as `<ScrollTheatre>` with the art passed in as props, so the second client costs a
day instead of a week.
