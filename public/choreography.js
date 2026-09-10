(function(){
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── the application form ─────────────────────────────────────
     No backend on a static page, and pretending otherwise would be the
     worst thing to ship on a site whose pitch is honesty. The form composes
     a complete email and hands it to the visitor's mail app. */
  var form = document.getElementById("applyForm");
  var note = document.getElementById("formNote");
  var TO = "yuvraj.chandyok@gmail.com";

  /* THE ONE INVARIANT: AN APPLICATION MUST NEVER BE SILENTLY LOST.

     This handler previously sent every application to a PLACEHOLDER address,
     hello@example.com, and then told the visitor it had worked. On a live site
     that means every application was discarded by a mail server while the person
     applying saw a confirmation. The free draft is the entire hook and this form
     is the only way to ask for one, so that was the worst defect on the site.

     So: try the server first, and if the server cannot deliver, fall back to the
     visitor own mail app with everything filled in. The worst case becomes "you
     have to press send yourself", never "it vanished". */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var get = function (id) { return (document.getElementById(id).value || "").trim(); };
    var payload = {
      biz: get("biz"), who: get("who"), email: get("email"),
      social: get("social"), kind: get("kind"), about: get("about"), want: get("want")
    };
    var lines = [
      "Business:      " + payload.biz,
      "Contact:       " + payload.who,
      "Email:         " + payload.email,
      "Instagram/web: " + (payload.social || "not given"),
      "Type:          " + payload.kind,
      "", "WHAT THEY SELL", payload.about,
      "", "WHAT THEY WANT THE SITE TO DO", payload.want || "not given"
    ];
    var btn = form.querySelector("button[type=submit]");

    var mailto = function () {
      window.location.href = "mailto:" + TO
        + "?subject=" + encodeURIComponent("Free draft request: " + payload.biz)
        + "&body=" + encodeURIComponent(lines.join("\n"));
      note.textContent = "Your email app should have opened with everything filled in. If it did not, email " + TO + " directly.";
      note.style.color = "var(--acc)";
    };

    if (btn) { btn.disabled = true; }
    note.style.color = "var(--mute)";
    note.textContent = "Sending\u2026";

    fetch("/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (btn) { btn.disabled = false; }
        if (res.ok && data && data.delivered) {
          note.textContent = "Got it. We will read this properly and come back to you, usually within a day.";
          note.style.color = "var(--acc)";
          form.reset();
          return;
        }
        if (res.status === 400 && data && data.error) {
          /* Their mistake rather than ours: name the field and let them fix it,
             instead of dumping them into a mail client to work it out. */
          note.textContent = data.error;
          note.style.color = "var(--acc)";
          return;
        }
        mailto();
      });
    }).catch(function () {
      if (btn) { btn.disabled = false; }
      mailto();
    });
  });

  /* ── nav tone ────────────────────────────────────────────────
     The bar is sticky and crosses every flip. Whatever tone sits directly
     under its bottom edge is the tone it wears. This runs with or without
     GSAP and with or without motion; only the sweep is optional. */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var motion = !reduce && typeof gsap !== "undefined";
  var header = $("#siteNav"), navWipe = $("#navWipe");
  var toneSecs = $$("main > section[data-tone], footer[data-tone]");
  var navTone = header.getAttribute("data-tone"), navTl = null;
  function toneUnderNav() {
    /* sample just under the bar: the tone flips the moment the last of the
       old ground disappears beneath it, which is also exactly where an
       anchor jump lands a section's top edge */
    var y = header.offsetHeight + 1;
    for (var i = 0; i < toneSecs.length; i++) {
      var r = toneSecs[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return toneSecs[i].getAttribute("data-tone");
    }
    return navTone;
  }
  function setNavTone(t, animate) {
    if (t === navTone) return; navTone = t;
    if (!animate || !motion) { header.setAttribute("data-tone", t); return; }
    if (navTl) navTl.kill();
    navTl = gsap.timeline()
      .set(navWipe, { xPercent: -101, autoAlpha: 1 })
      .to(navWipe, { xPercent: 0, duration: .26, ease: "power3.in" })
      .add(function () { header.setAttribute("data-tone", t); })
      .to(navWipe, { xPercent: 101, duration: .38, ease: "expo.out" })
      .set(navWipe, { autoAlpha: 0 });
  }
  var navRaf = 0;
  function onScroll() {
    if (navRaf) return;
    navRaf = requestAnimationFrame(function () { navRaf = 0; setNavTone(toneUnderNav(), true); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  setNavTone(toneUnderNav(), false);

  /* ── motion ─────────────────────────────────────────────────── */
  var intro = document.getElementById("intro");
  if (!motion) { if (intro) intro.remove(); return; }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power3.out" });

  var isDesktop = window.matchMedia("(min-width: 941px)").matches;

  /* ═══ HERO BUILD. The draft assembles like a site being made: chrome,
     nav, headline lines, copy, button, cup, strip, flavors, schedule.
     Then it scrolls itself so it reads as a page, not a picture. */
  var heroBuilt = false;
  function buildHero() {
    if (heroBuilt) return; heroBuilt = true;
    var tl = gsap.timeline();
    tl.from("#hero h1 .line > span", { yPercent: 110, duration: .9, stagger: .07, ease: "expo.out" }, 0)
      .from("[data-hero]", { y: 22, autoAlpha: 0, duration: .7, stagger: .07 }, .35)
      .from("#draft", { y: 60, rotateX: 8, autoAlpha: 0, duration: 1, ease: "expo.out" }, .15)
      .from("[data-d='nav'] > *", { y: -14, autoAlpha: 0, duration: .45, stagger: .06 }, .7)
      .from("[data-d='h']", { yPercent: 110, duration: .6, stagger: .07, ease: "expo.out" }, .85)
      .from("[data-d='sub']", { y: 12, autoAlpha: 0, duration: .5 }, 1.15)
      .from("[data-d='btn']", { scale: .6, autoAlpha: 0, duration: .5, ease: "back.out(2)" }, 1.3)
      .from("[data-d='cup']", { y: 90, rotate: 14, autoAlpha: 0, duration: .9, ease: "expo.out" }, 1.05)
      .from("[data-d='strip']", { scaleY: 0, transformOrigin: "top", duration: .5, ease: "power2.inOut" }, 1.45)
      .from("[data-d='flav']", { scale: .7, autoAlpha: 0, duration: .45, stagger: .05, ease: "back.out(1.6)" }, 1.55)
      .from("[data-d='sched']", { y: 16, autoAlpha: 0, duration: .5 }, 1.85)
      .add(function () { $("#draftState").textContent = "Live"; }, 1.9);

    /* the draft browses itself: down to the schedule and back, forever, slowly */
    var page = $("#draft .page"), sc = $("#dScroller");
    function selfScroll() {
      var dist = Math.max(0, sc.scrollHeight - page.clientHeight);
      gsap.killTweensOf(sc);
      gsap.set(sc, { y: 0 });
      if (dist > 0) gsap.to(sc, { y: -dist, duration: 5.5, ease: "power1.inOut", yoyo: true, repeat: -1, repeatDelay: 1.2, delay: 2.4 });
    }
    selfScroll();
    ScrollTrigger.addEventListener("refreshInit", selfScroll);

    /* the draft leans toward the pointer, desktop only */
    if (isDesktop && window.matchMedia("(pointer:fine)").matches) {
      var stage = $(".draft-stage"), d = $("#draft");
      var qx = gsap.quickTo(d, "rotationY", { duration: .6, ease: "power3" }),
          qy = gsap.quickTo(d, "rotationX", { duration: .6, ease: "power3" });
      $("#hero").addEventListener("pointermove", function (e) {
        var r = stage.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width / 2)) / r.width, ny = (e.clientY - (r.top + r.height / 2)) / r.height;
        qx(gsap.utils.clamp(-7, 7, nx * 10)); qy(gsap.utils.clamp(-6, 6, -ny * 8));
      });
      $("#hero").addEventListener("pointerleave", function () { qx(0); qy(0); });
    }
  }

  /* ═══ INTRO. Violet over dark. Three acts, ~3.0s in all, slower by the
     founder's call and with more to see:
       1  (0 to 1.15s)   the mark alone, centred, poster-sized: the frame draws
                          itself anticlockwise from the open corner and the
                          stone lands in the gap that is left. The proof is
                          complete.
       2  (1.05 to 1.9s) the mark shifts left and settles to 1x while the word
                          slides out from behind it through a clip, so the
                          lockup composes itself.
       3  (1.9 to 3.0s)  the lockup flies to exactly where the nav lockup sits
                          while the violet field wipes upward and the dark field
                          follows a beat behind; the white hero is what is left.
     The intro lockup and the nav lockup are the same em-sized object, so the
     flight is a uniform scale about the top-left corner plus a translation of
     the top-left corners: no centre maths to get wrong. Plays on every load.
     Any input at any moment ends it instantly. */
  var introDone = false, introTl = null;
  function finishIntro(instant) {
    if (introDone) return; introDone = true;
    ["wheel","touchstart","pointerdown","keydown"].forEach(function (ev) { window.removeEventListener(ev, skipIntro); });
    if (!intro) { buildHero(); return; }
    if (instant) { intro.remove(); gsap.set("#navMark", { clearProps: "all" }); buildHero(); return; }
    var lockup = $("#introLockup"), mark = $("#navMark");
    var lr = lockup.getBoundingClientRect(), mr = mark.getBoundingClientRect();
    var scale = mr.height / lr.height;
    var dx = mr.left - lr.left, dy = mr.top - lr.top;
    var tl = gsap.timeline({ onComplete: function () { intro.remove(); gsap.set(mark, { clearProps: "all" }); } });
    tl.to(lockup, { x: dx, y: dy, scale: scale, duration: .75, ease: "power3.inOut" }, 0)
      .to(lockup, { color: "#14161A", duration: .3, ease: "none" }, .4)
      .to("#introStone", { fill: "#4B3BFF", duration: .3, ease: "none" }, .4)
      .to(".intro-hint", { autoAlpha: 0, duration: .2 }, .2)
      .to("#intro .f2", { yPercent: -100, duration: .6, ease: "expo.inOut" }, .3)
      .to("#intro .f1", { yPercent: -100, duration: .6, ease: "expo.inOut" }, .5)
      .from(mark, { autoAlpha: 0, duration: .01 }, .74)
      .add(buildHero, .58);
  }
  function skipIntro() { if (!introDone) { if (introTl) introTl.kill(); finishIntro(true); } }

  if (intro) {
    gsap.set("#navMark", { autoAlpha: 0 });
    intro.style.animation = "none"; /* JS owns the exit from here on */
    var lockupEl = $("#introLockup"), introMark = $("#introMark"), introWordEl = $("#introWord");
    var frameLen = $("#introFrame").getTotalLength();
    /* act 1 starts with the mark alone in the centre: push the lockup right by
       half of what the word and the gap occupy, so the mark sits on the axis */
    var room = (lockupEl.getBoundingClientRect().width - introMark.getBoundingClientRect().width) / 2;
    gsap.set(lockupEl, { x: room });
    /* alone, the mark is a poster, not an icon: 240px on a desktop, a quarter
       of the width on a phone, whatever the lockup's own em size works out to */
    var markW = introMark.getBoundingClientRect().width;
    var soloScale = gsap.utils.clamp(110, 240, window.innerWidth * .26) / markW;
    gsap.set(introMark, { scale: soloScale, transformOrigin: "50% 50%" });
    gsap.set("#introFrame", { strokeDasharray: frameLen, strokeDashoffset: frameLen });
    gsap.set("#introStone", { transformOrigin: "100% 0%", scale: 0 });
    gsap.set("#introInner", { xPercent: -104 });
    introTl = gsap.timeline()
      /* act 1: the frame draws, the stone lands */
      .to("#introFrame", { strokeDashoffset: 0, duration: .8, ease: "power2.inOut" }, .1)
      .to("#introStone", { scale: 1, duration: .45, ease: "expo.out" }, .78)
      /* act 2: the mark makes room; the word emerges from behind it */
      .to(lockupEl, { x: 0, duration: .8, ease: "power3.inOut" }, 1.05)
      .to(introMark, { scale: 1, duration: .8, ease: "power3.inOut" }, 1.05)
      .to("#introInner", { xPercent: 0, duration: .85, ease: "expo.out" }, 1.15)
      /* act 3 */
      .add(function () { finishIntro(false); }, 1.9);
    ["wheel","touchstart","pointerdown","keydown"].forEach(function (ev) { window.addEventListener(ev, skipIntro, { passive: true }); });
  } else {
    finishIntro(true);
  }

  /* ═══ THE WIPE. The page's transition language, lifted from the intro.
     At every tone flip, two full-bleed fields hang from the boundary and
     retract upward under your hand: the previous ground first, so the
     boundary only appears once you are committed, then the violet. The
     new section's headline rises through its clip inside the wake, and
     the rest of its head slides up the last few pixels as the edge passes.
     Hard edges, one axis, no opacity. */
  $$("[data-flip]").forEach(function (sec) {
    var la = $(".wipe .la", sec), lb = $(".wipe .lb", sec);
    var mask = $$("[data-mask]", sec).filter(function (m) { return m.closest("[data-flip]") === sec; });
    var wake = $$("[data-wake]", sec);
    var tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: "top bottom", end: "top 28%", scrub: .6 } });
    tl.fromTo(la, { scaleY: 1 }, { scaleY: 0, ease: "none", duration: .5 }, 0)
      .fromTo(lb, { scaleY: 1 }, { scaleY: 0, ease: "power1.in", duration: .78 }, .2);
    if (mask.length) tl.from(mask, { yPercent: 108, ease: "expo.out", duration: .5 }, .5);
    if (wake.length) tl.from(wake, { y: 48, ease: "power2.out", duration: .55, stagger: .05 }, .45);
  });
  /* headlines in sections that do not flip still rise through their clip */
  $$("h2 [data-mask]").forEach(function (m) {
    if (m.closest("[data-flip]")) return;
    gsap.from(m, { yPercent: 108, duration: .9, ease: "expo.out",
      scrollTrigger: { trigger: m.closest("h2"), start: "top 82%", once: true } });
  });
  $$("[data-wake]").forEach(function (w) {
    if (w.closest("[data-flip]")) return;
    gsap.from(w, { y: 28, autoAlpha: 0, duration: .6, scrollTrigger: { trigger: w, start: "top 85%", once: true } });
  });

  /* hero recedes as you leave it: the draft drops back and the type drifts */
  gsap.to("#draft", { y: 140, scale: .94, rotateX: 6, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 1 } });
  gsap.to(".hero-copy", { y: -70, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 1 } });

  /* ═══ THE BEFORE. Two giant lines counter-slide under your hand;
     the bio's only link gets struck through as the problems arrive. */
  gsap.fromTo("#slideL1", { x: "6vw" }, { x: "-10vw", ease: "none",
    scrollTrigger: { trigger: ".before", start: "top bottom", end: "bottom top", scrub: 1 } });
  gsap.fromTo("#slideL2", { x: "-4vw" }, { x: "12vw", ease: "none",
    scrollTrigger: { trigger: ".before", start: "top bottom", end: "bottom top", scrub: 1 } });
  gsap.from("#bio", { xPercent: -20, rotate: -6, autoAlpha: 0, duration: .9, ease: "expo.out",
    scrollTrigger: { trigger: "#bio", start: "top 80%", once: true } });
  gsap.to("#bio .link i", { scaleX: 1, duration: .5, ease: "power2.inOut",
    scrollTrigger: { trigger: "#bio", start: "top 55%", once: true } });
  gsap.from("#bio .none", { scale: 0, rotate: 12, duration: .6, ease: "back.out(2)",
    scrollTrigger: { trigger: "#bio", start: "top 50%", once: true } });
  $$("[data-prob]").forEach(function (el) {
    gsap.timeline({ scrollTrigger: { trigger: el, start: "top 88%", once: true } })
      .from(el, { scaleX: 0, transformOrigin: "left center", duration: .5, ease: "power2.inOut" })
      .from(el.children, { x: -18, autoAlpha: 0, duration: .55, stagger: .07 }, "-=.2");
  });

  /* ═══ HOW. A rail draws across (or down, on a phone) and each step
     lights up as the line reaches it. Scrubbed, so it belongs to the hand. */
  var rail = $("#railFill"), steps = $$("[data-step]");
  var railTl = gsap.timeline({ scrollTrigger: { trigger: "#steps", start: "top 75%", end: "bottom 60%", scrub: 1 } });
  var horizontal = window.matchMedia("(min-width: 821px)").matches;
  railTl.to(rail, horizontal ? { scaleX: 1, ease: "none", duration: 1 } : { scaleY: 1, ease: "none", duration: 1 }, 0);
  steps.forEach(function (s, i) {
    var at = i / steps.length + .04;
    railTl.from($(".dot", s), { scale: 0, duration: .12, ease: "back.out(3)" }, at)
          .from(s.querySelectorAll(".n, h3, p"), { y: 24, autoAlpha: 0, duration: .22, stagger: .04 }, at);
  });

  /* ═══ THE WORK. The one pin. Eleven parts of the cup fly in from where
     they were thrown and land in order while the counter climbs. */
  var parts = $$("#cup [data-part]");
  var throwFrom = [
    { x: -170, y: -60, rotate: -28 }, { x: 190, y: -20, rotate: 24 }, { x: -200, y: 40, rotate: 18 }, { x: 180, y: 90, rotate: -22 },
    { x: -120, y: -220, rotate: 40 }, { x: 140, y: -240, rotate: -35 }, { x: 0, y: 260, rotate: 8, scale: .4 },
    { x: 60, y: -300, rotate: 55 }, { x: -60, y: -190, rotate: -14 }, { x: 230, y: -160, rotate: 120 }, { x: 250, y: -120, rotate: 200 }
  ];
  gsap.set(parts, { transformOrigin: "50% 50%" });
  var cupTl = gsap.timeline({
    scrollTrigger: { trigger: "#workPin", start: "top top", end: "+=1400", pin: true, scrub: 1, anticipatePin: 1,
      onUpdate: function (s) { $("#cupN").textContent = Math.round(s.progress * 11); } }
  });
  parts.forEach(function (p, i) {
    var f = throwFrom[i]; f.autoAlpha = 0;
    cupTl.from(p, Object.assign({ duration: 1, ease: "power2.inOut" }, f), i * .55);
  });
  cupTl.to("#cup", { y: -10, duration: .6, ease: "power2.inOut" }, "-=.4");
  gsap.from(".work-copy > .label, .work-copy > .lede", { x: -30, autoAlpha: 0, duration: .8, stagger: .1,
    scrollTrigger: { trigger: "#workPin", start: "top 70%", once: true } });

  /* ═══ INCLUDED. Numbers count up; the checklist ticks itself off in batches. */
  $$("[data-count]").forEach(function (el) {
    var target = +el.getAttribute("data-count"), o = { v: target === 0 ? 27 : 0 };
    gsap.to(o, { v: target, duration: 1.4, ease: "power3.out", snap: { v: 1 },
      onUpdate: function () { el.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: el, start: "top 80%", once: true } });
  });
  gsap.set(".tickpath", { strokeDasharray: 30, strokeDashoffset: 30 });
  ScrollTrigger.batch(".incl > div", { start: "top 88%", once: true, batchMax: 4,
    onEnter: function (b) {
      gsap.from(b, { x: 40, autoAlpha: 0, duration: .6, stagger: .07, overwrite: true });
      gsap.to(b.map(function (el) { return el.querySelector(".tickpath"); }), { strokeDashoffset: 0, duration: .5, stagger: .07, delay: .25, ease: "power2.inOut" });
    } });
  gsap.from(".stat", { yPercent: 30, autoAlpha: 0, duration: .7, stagger: .07,
    scrollTrigger: { trigger: ".stats", start: "top 80%", once: true } });

  /* ═══ PRICING. The three tiers are dealt from one stack, the big one first. */
  var tiers = $$("[data-tier]");
  ScrollTrigger.create({ trigger: "#tiers", start: "top 78%", once: true, onEnter: function () {
    var base = tiers[0].getBoundingClientRect();
    tiers.forEach(function (t, i) {
      var r = t.getBoundingClientRect();
      gsap.from(t, { x: base.left - r.left, y: base.top - r.top, rotate: i === 0 ? 0 : (i === 1 ? -6 : 6), autoAlpha: i === 0 ? 0 : 1,
        duration: .9, delay: i * .12, ease: "expo.out" });
    });
  } });

  /* ═══ APPLY. A violet curtain sweeps off the form, the same field as the
     wipes, on the horizontal axis; the FAQ rows slide in with a slight skew. */
  var curtain = $("#curtain");
  ScrollTrigger.create({ trigger: "#formWrap", start: "top 80%", once: true, onEnter: function () {
    gsap.set(curtain, { autoAlpha: 1 });
    gsap.timeline()
      .from("#applyForm", { autoAlpha: 0, duration: .01 })
      .to(curtain, { xPercent: 101, duration: .8, ease: "expo.inOut" })
      .from("#applyForm .field, #applyForm .form-foot", { y: 14, autoAlpha: 0, duration: .5, stagger: .05 }, "-=.45");
  } });
  gsap.from(".apply-side > *", { y: 20, autoAlpha: 0, duration: .6, stagger: .07,
    scrollTrigger: { trigger: ".apply-side", start: "top 85%", once: true } });
  ScrollTrigger.batch(".faq details", { start: "top 92%", once: true,
    onEnter: function (b) { gsap.from(b, { xPercent: -3, skewX: 3, autoAlpha: 0, duration: .55, stagger: .06, overwrite: true }); } });
  gsap.from(".work-after dl > div", { y: 20, autoAlpha: 0, duration: .6, stagger: .07,
    scrollTrigger: { trigger: ".work-after", start: "top 85%", once: true } });

  /* ═══ FOOTER. A marquee that never stops, and a wordmark that slides up
     under everything as you reach the end. */
  gsap.to("#marqueeTrack", { xPercent: -50, duration: 22, ease: "none", repeat: -1 });
  gsap.from("#fBig", { yPercent: 40, ease: "none",
    scrollTrigger: { trigger: "footer", start: "top bottom", end: "bottom bottom", scrub: 1 } });

  /* ═══ ANCHORS. Jump, never travel, then force every scrub to its resting
     state so the destination is settled instead of catching up in view,
     and the nav takes the destination's tone without a sweep. */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      skipIntro();
      var navH = header.offsetHeight;
      var y = id === "#top" ? 0 : t.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo(0, y);
      ScrollTrigger.update();
      ScrollTrigger.getAll().forEach(function (st) { var tw = st.getTween && st.getTween(); if (tw) tw.progress(1); });
      if (navTl) navTl.kill();
      gsap.set(navWipe, { autoAlpha: 0 });
      setNavTone(toneUnderNav(), false);
      history.replaceState(null, "", id);
    });
  });

  /* ═══ REFRESH. A reload or bfcache return lands at the top, re-armed. */
  function reset() { window.scrollTo(0, 0); ScrollTrigger.refresh(); setNavTone(toneUnderNav(), false); }
  window.addEventListener("pageshow", reset);
  window.addEventListener("load", reset);

  /* THE ONE CHANGE FROM THE STATIC VERSION, and it is here because it would
     otherwise fail in silence.

     In index.html this file was inline at the end of <body>, so it always ran
     BEFORE the load event and the listener above always fired. Loaded as an
     external script from a Next layout it can run AFTER load has already
     fired, in which case the listener never fires, ScrollTrigger is never
     refreshed against final layout, and the nav tone is never set for the
     section under it. The page looks built and the pinned scenes are measured
     against the wrong height.

     So: if load has already happened by the time we get here, do the reset now.
     Guarded on readyState rather than called unconditionally, because calling
     it twice would scroll the visitor to the top a second time. */
  if (document.readyState === "complete") reset();
})();
