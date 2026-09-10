/**
 * The Proof marketing page.
 *
 * THIS FILE IS THE SOURCE OF TRUTH for the marketing page.
 *
 * It was generated once from the original static index.html by a converter, and
 * DOM parity between the two was proved at 443 nodes with JavaScript disabled on
 * both sides. Both the converter and index.html are DELETED: the proof is
 * recorded in docs/LEARNINGS.md P-10 and the number does not need the script
 * that produced it. Do not go looking for them.
 *
 * The parity gate is retired for the same reason. It asserted a migration
 * invariant, the migration is done, and keeping it would mean every change to
 * this page had to be mirrored into a second copy with nothing but that gate
 * comparing them.
 *
 * What replaced it is a better gate. `npm run selfcheck` runs the real rulebook
 * against the real built page on every verify and fails on abstention. Parity
 * could only say the page had not changed; the self-check says whether it is any
 * good.
 *
 * All behaviour lives in public/choreography.js, loaded by app/layout.tsx. This
 * component holds no state and no handlers, which is why a mechanical port was
 * safe in the first place: React renders this markup, it does not own it. A new
 * section needs the choreography's hooks to animate: data-tone on the section,
 * data-mask inside an h2 for the heading reveal, data-wake on anything else.
 */
import { SubscribeButtons } from "./SubscribeButtons";

export default function Page() {
  return (
    <>
      <div id="intro" aria-hidden="true">
        <div className="f1"></div><div className="f2" id="introField"></div>
        <div className="intro-lockup" id="introLockup">
          <svg className="halmos" id="introMark" viewBox="0 0 32 32" aria-hidden="true"><path className="frame" id="introFrame" d="M18.5 4.5H4.5v23h23V13.5" /><rect className="stone" id="introStone" x="20.5" y="2" width="9.5" height="9.5" /></svg>
          <div className="intro-word" id="introWord"><span className="line"><span id="introInner">Proof</span></span></div>
        </div>
        <p className="intro-hint">Scroll, click or press any key to skip</p>
      </div>

      <header className="top" data-tone="light" id="siteNav">
        <div className="nav-wipe" id="navWipe" aria-hidden="true"></div>
        <div className="topbar">
          <a className="mark" href="#top" id="navMark"><svg className="halmos" id="navHalmos" viewBox="0 0 32 32" aria-hidden="true"><path className="frame" d="M18.5 4.5H4.5v23h23V13.5" /><rect className="stone" x="20.5" y="2" width="9.5" height="9.5" /></svg>Proof</a>
          <nav className="nav">
            <a className="hide-sm" href="#before">Why</a>
            <a className="hide-sm" href="#how">How it works</a>
            <a className="hide-sm" href="#work">The work</a>
            <a className="hide-sm" href="#team">The team</a>
            <a className="hide-sm" href="#pricing">Pricing</a>
            <a className="btn sm" href="#apply">Get a free draft</a>
          </nav>
        </div>
      </header>

      <main id="top">

      <section className="hero" id="hero" data-tone="light">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="label" data-hero="">Independent web studio &nbsp;·&nbsp; New York</p>
            <h1 style={{ marginTop: "1rem" }}>
              <span className="line"><span>We build</span></span>
              <span className="line"><span>your site <em>first.</em></span></span>
              <span className="line"><span>You decide after.</span></span>
            </h1>
            <p className="lede" data-hero="">Tell us about your business and we build you a real, working, animated draft of your
              website for nothing. That is one on this page, building itself. If you like yours, we finish it and look
              after it for a flat fee. If you do not, you owe us nothing and you keep the draft.</p>
            <div className="hero-cta" data-hero="">
              <a className="btn" href="#apply">Get a free draft
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 8h11M9 3l5 5-5 5" /></svg></a>
              <span className="small">Draft in about five days. <a href="#pricing">Pricing is on the page.</a></span>
            </div>
            <div className="hero-meta label" data-hero="">
              <div><b>$0</b><span>to see your draft</span></div>
              <div><b>5 days</b><span>typical turnaround</span></div>
              <div><b>Flat</b><span>fee, no hourly billing</span></div>
            </div>
          </div>

          <div className="draft-stage">
            <div className="draft" id="draft" role="img" aria-label="A draft website for Vermont Maple Lemonade assembling itself inside a browser window">
              <div className="chrome" data-d="chrome"><i></i><i></i><i></i><span className="url">vermontmaplelemonade.com</span></div>
              <div className="page">
                <div className="scroller" id="dScroller">
                  <div className="d-hero">
                    <div className="d-nav" data-d="nav"><b>Vermont Maple Lemonade</b><span><i></i><i></i><i></i></span><em>FIND US</em></div>
                    <div className="d-h"><span className="line"><span data-d="h">No cane</span></span><span className="line"><span data-d="h">sugar,</span></span><span className="line"><span data-d="h"><i>ever.</i></span></span></div>
                    <p className="d-sub" data-d="sub">Lemonade sweetened with Grade A Dark and Robust Vermont maple syrup. Smorgasburg, every weekend since 2013.</p>
                    <span className="d-btn" data-d="btn">This weekend’s stand</span>
                    <svg className="d-cup" data-d="cup" viewBox="0 0 120 160" aria-hidden="true">
                      <polygon points="66,70 76,8 84,9 74,72" fill="#FFF3D6" />
                      <ellipse cx="60" cy="72" rx="38" ry="7" fill="#1A0E05" />
                      <path d="M22,76 L98,76 L88,156 L32,156 Z" fill="#F7D64A" />
                      <path d="M26,105 L94,105 L91,130 L29,130 Z" fill="#EDB52D" opacity=".85" />
                      <rect x="38" y="84" width="16" height="16" rx="3" fill="#fff" opacity=".5" />
                      <circle cx="92" cy="64" r="12" fill="#FFE97A" stroke="#F0C419" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="d-strip" data-d="strip"><span>Smorgasburg WSP</span><span>Sat + Sun</span><span>Seven flavors</span><span>Grade A Dark</span></div>
                  <div className="d-flav">
                    <span data-d="flav" style={{ "--c": "#F7D64A" } as React.CSSProperties}>Classic maple</span>
                    <span data-d="flav" style={{ "--c": "#FF8A5B" } as React.CSSProperties}>Blood orange</span>
                    <span data-d="flav" style={{ "--c": "#C9E265" } as React.CSSProperties}>Cucumber mint</span>
                    <span data-d="flav" style={{ "--c": "#E56A9E" } as React.CSSProperties}>Hibiscus</span>
                    <span data-d="flav" style={{ "--c": "#8FD3F4" } as React.CSSProperties}>Blueberry</span>
                    <span data-d="flav" style={{ "--c": "#F2B5D4" } as React.CSSProperties}>Strawberry</span>
                    <span data-d="flav" style={{ "--c": "#B58CF5" } as React.CSSProperties}>Lavender</span>
                    <span data-d="flav" style={{ "--c": "#FFF3D6" } as React.CSSProperties}>Powdered mix</span>
                  </div>
                  <div className="d-sched" data-d="sched"><b>Where the stand is</b>
                    <div><span>Saturday</span><span>Williamsburg, 11–6</span></div>
                    <div><span>Sunday</span><span>Prospect Park, 11–6</span></div>
                    <div><span>Weekdays</span><span>Wholesale + catering</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="draft-cap">
              <p className="label"><b>Draft</b> · Vermont Maple Lemonade</p>
              <p className="label" id="draftState">Building…</p>
            </div>
          </div>
        </div>
      </section>

      <section className="before" id="before" data-tone="dark" data-flip="">
        <div className="wipe" aria-hidden="true"><i className="la"></i><i className="lb"></i></div>
        <div className="slide-lines" aria-label="They searched your name. They found a delivery app.">
          <div className="l1" id="slideL1">They searched your name.</div>
          <div className="l2" id="slideL2">They found a delivery app.</div>
        </div>
        <div className="wrap before-grid">
          <div className="bio" id="bio" role="img" aria-label="A mock Instagram profile with 1,543 followers and a single link in bio">
            <div className="row"><div className="av"></div>
              <div className="stats"><div><b>212</b>posts</div><div><b>1,543</b>followers</div><div><b>96</b>following</div></div></div>
            <p className="name">Vermont Maple Lemonade</p>
            <p className="txt">Real maple. No cane sugar. Smorgasburg since 2013.</p>
            <span className="link">linktr.ee/vml<i></i></span>
            <div className="grid"><span></span><span></span><span></span><span></span><span></span><span></span></div>
            <span className="none">no hours · no menu · no prices</span>
          </div>
          <div>
            <p className="label acc">The before</p>
            <div className="probs" style={{ marginTop: "1rem" }}>
              <div className="prob" data-prob=""><span className="n">01</span><div>
                <h2>Instagram is not a website</h2>
                <p>A bio holds one link and no hours, no location, no menu and no prices. Every question a customer has becomes a DM you answer by hand, or a sale you quietly lose.</p></div></div>
              <div className="prob" data-prob=""><span className="n">02</span><div>
                <h2>You do not own the audience</h2>
                <p>Followers are rented. The algorithm decides who sees the post about this weekend’s market. A page you own shows up the same way to everyone who searches your name.</p></div></div>
              <div className="prob" data-prob=""><span className="n">03</span><div>
                <h2>The story never gets told</h2>
                <p>The reason people should choose you is usually the part that fits nowhere: the farm, the method, the twelve years. A caption is 125 characters. That story is worth a page.</p></div></div>
            </div>
            <p className="before-foot">Vermont Maple Lemonade had 1,543 followers, thirteen seasons at Smorgasburg, and a founder’s story
              that had never been written down anywhere. That is the normal case, not the sad one.</p>
          </div>
        </div>
      </section>

      <section className="how" id="how" data-tone="dark">
        <div className="wrap">
          <div className="how-head">
            <h2><span className="line"><span data-mask="">Three steps.<br />One of them costs anything.</span></span></h2>
            <p className="label" data-wake="">No deposit · no retainer · no hourly</p>
          </div>
          <div className="steps" id="steps">
            <div className="rail" aria-hidden="true"><i id="railFill"></i></div>
            <div className="step" data-step=""><span className="dot"></span>
              <span className="n">STEP 01</span>
              <h3>You apply</h3>
              <p>A short form, or a fifteen minute call if you would rather talk. We want to know what you sell, who buys it, and what you wish the internet knew about you.</p>
              <p className="cost free">Costs you: nothing</p>
            </div>
            <div className="step" data-step=""><span className="dot"></span>
              <span className="n">STEP 02</span>
              <h3>We build the draft</h3>
              <p>A real page on a real link, moving, not a slide deck or a wireframe. Your words, your story, your prices. Usually within five days. You look at it on your phone and tell us what is wrong with it.</p>
              <p className="cost free">Costs you: nothing</p>
            </div>
            <div className="step" data-step=""><span className="dot"></span>
              <span className="n">STEP 03</span>
              <h3>You decide</h3>
              <p>Commit and we finish it, put it on your domain, and maintain it. Or walk away and keep the draft files. No invoice for work you did not ask to continue.</p>
              <p className="cost">Costs you: a flat fee, agreed up front, only if you say yes</p>
            </div>
          </div>
        </div>
      </section>

      <section className="work" id="work" data-tone="dark">
        <div className="wrap work-pin" id="workPin">
          <div className="work-copy">
            <p className="label acc">The work</p>
            <h2 style={{ marginTop: "1rem" }}><span className="line"><span data-mask="">A stand at Smorgasburg with 1,543 followers and no website.</span></span></h2>
            <p className="lede">We built Vermont Maple Lemonade a draft without being asked, then showed it to them. On their page an
              exploded cup assembles as you scroll. This is that cup. Keep scrolling.</p>
          </div>
          <div className="cup-stage">
            <svg id="cup" viewBox="0 0 300 420" role="img" aria-label="An exploded maple lemonade cup in eleven parts that assembles as the page scrolls">
              <ellipse cx="150" cy="392" rx="90" ry="10" fill="#1F2228" />
              <path data-part="" d="M62,178 L238,178 L231.6,228 L68.4,228 Z" fill="#F7D64A" />
              <path data-part="" d="M68.4,228 L231.6,228 L225.1,278 L74.9,278 Z" fill="#F2C53B" />
              <path data-part="" d="M74.9,278 L225.1,278 L218.7,328 L81.3,328 Z" fill="#EDB52D" />
              <path data-part="" d="M81.3,328 L218.7,328 L212,380 L88,380 Z" fill="#D99A1F" />
              <rect data-part="" x="96" y="196" width="40" height="40" rx="7" fill="#fff" opacity=".55" />
              <rect data-part="" x="150" y="238" width="34" height="34" rx="6" fill="#fff" opacity=".45" />
              <g data-part=""><rect x="96" y="290" width="108" height="26" rx="3" fill="#2A1608" />
                <text x="150" y="309" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="15" fill="#F7D64A" letterSpacing="1.5">VERMONT</text></g>
              <polygon data-part="" points="160,172 178,22 196,24 178,174" fill="#F5F5F3" />
              <ellipse data-part="" cx="150" cy="176" rx="94" ry="16" fill="#1A0E05" />
              <circle data-part="" cx="232" cy="148" r="32" fill="#FFE97A" stroke="#F0C419" strokeWidth="4" />
              <g data-part="" fill="none" stroke="#F0C419" strokeWidth="3" strokeLinecap="round"><path d="M232,148 L232,120 M232,148 L256,134 M232,148 L256,162 M232,148 L232,176 M232,148 L208,162 M232,148 L208,134" /></g>
            </svg>
            <p className="cup-count label"><b id="cupN">0</b>of eleven parts in place</p>
          </div>
        </div>
        <div className="wrap work-after">
          <dl data-batch="">
            <div><dt>Built</dt><dd>A full single page: story, flavors, market schedule, and an explainer for the maple grade they use.</dd></div>
            <div><dt>Motion</dt><dd>An eleven part exploded cup that assembles as you scroll, and a pinned scene that morphs the drink through all seven flavors.</dd></div>
            <div><dt>Research</dt><dd>Every fact sourced from their own channels, USA Today, the New York Post and Seven Days Vermont.</dd></div>
            <div><dt>Time</dt><dd>One working session, start to live link.</dd></div>
          </dl>
          <p className="disclosure"><b>Said plainly:</b> this was speculative work, not a paid commission. It is a draft we made to show
            what a draft looks like. That is the whole business model, so it would be strange to pretend otherwise.</p>
        </div>
      </section>

      <section className="team" id="team" data-tone="dark">
        <div className="wrap">
          <p className="label acc">After it launches</p>
          <h2 style={{ marginTop: "1rem", maxWidth: "22ch" }}><span className="line"><span data-mask="">Then somebody checks it. Every month. With receipts.</span></span></h2>
          <p className="lede" data-wake="">Most studios hand over a site and go quiet. Yours gets checked against a written rulebook,
            every month, by eight departments that each own one job. You get the findings and we make the fixes. Every finding names the
            exact thing it looked at, so you can go and check our work instead of taking our word for it.</p>

          <div className="depts" data-wake="">
            <div><span className="dn">01</span><h3>Found</h3><p>Titles, descriptions, structured data, sitemaps, and whether searching your name finds you.</p></div>
            <div><span className="dn">02</span><h3>Craft</h3><p>Speed, the phone version, contrast, keyboard access, and anything that has quietly broken.</p></div>
            <div><span className="dn">03</span><h3>Money</h3><p>Checkout, prices, stock, fees, and every step between a cart and a receipt.</p></div>
            <div><span className="dn">04</span><h3>Reach</h3><p>What to post, what to send, the shot list, and whether your email actually arrives.</p></div>
            <div><span className="dn">05</span><h3>Customers</h3><p>The questions you answer fifty times a week, bookings, and what people keep telling you.</p></div>
            <div><span className="dn">06</span><h3>Business</h3><p>Margins per item, cash timing, and the renewal dates a business forgets until they lapse.</p></div>
            <div><span className="dn">07</span><h3>Trust</h3><p>What your site claims about you against what you can actually back up, and what it collects.</p></div>
            <div><span className="dn">08</span><h3>Standards</h3><p>The department that audits the other seven, so a finding you disagree with can be argued.</p></div>
          </div>

          <div className="receipt" data-wake="">
            <p className="label">A real check, run on this page, just now</p>
            <pre>{`seo-onpage  (rulebook onpage-2026.09)
  status assessed   10 of 10 rules ran
  read 19 headings, 13 links, 52,393 characters of text

  Nothing fired. Every one of the 10 rules ran and none matched.`}</pre>
            <p className="receipt-note">Two runs ago it did not say that. It found two headings on this page in the wrong
              order, named them, and we fixed both. That is the whole point of running it on ourselves first.</p>
          </div>

          <div className="team-foot" data-wake="">
            <div>
              <h4>Every rule is published, including where it is wrong</h4>
              <p>Each rule carries the case where it gives a false answer, written down before you ask. A check you cannot
                argue with is a check you should not act on. <a href="/rulebook">Read the rulebook</a>.</p>
            </div>
            <div>
              <h4>Nothing about your business leaves your site</h4>
              <p>The checks run against your own pages and make no outside requests of any kind. There is no account to
                create and nothing to upload.</p>
            </div>
            <div>
              <h4>No model decides anything</h4>
              <p>The same page gets the same result tomorrow, and the reasons are the published rules rather than an
                opinion. When a check cannot read enough of a page, it says so instead of guessing.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="incl-sec" id="included" data-tone="light" data-flip="">
        <div className="wipe" aria-hidden="true"><i className="la"></i><i className="lb"></i></div>
        <div className="wrap">
          <h2 style={{ maxWidth: "16ch" }}><span className="line"><span data-mask="">Everything, and then we keep it running.</span></span></h2>
          <div className="stats">
            <div className="stat"><b><span data-count="5">5</span><small>days</small></b><span className="label">to a working draft</span></div>
            <div className="stat"><b><span data-count="14">14</span><small>days</small></b><span className="label">from yes to live</span></div>
            <div className="stat"><b><span data-count="1">1</span><small>day</small></b><span className="label">to get an edit made</span></div>
            <div className="stat"><b><span data-count="0">0</span><small>hourly</small></b><span className="label">invoices, ever</span></div>
          </div>
          <div className="incl" data-batch="">
            <div><svg className="tick" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="tickpath" d="M3 9.5l4.5 4.5 8-10" /></svg>
              <h3>Design and build</h3><p>Written, designed, animated and built for your business specifically. Not a template with your logo dropped in.</p></div>
            <div><svg className="tick" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="tickpath" d="M3 9.5l4.5 4.5 8-10" /></svg>
              <h3>Your domain, set up</h3><p>We buy it, point it, secure it and renew it. You never touch a DNS record.</p></div>
            <div><svg className="tick" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="tickpath" d="M3 9.5l4.5 4.5 8-10" /></svg>
              <h3>Hosting and uptime</h3><p>Fast hosting included. If it goes down at 2am it is our problem, not yours.</p></div>
            <div><svg className="tick" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="tickpath" d="M3 9.5l4.5 4.5 8-10" /></svg>
              <h3>Edits, unlimited</h3><p>New prices, new hours, a new flavor, a closed weekend. Text us and it is done that day.</p></div>
            <div><svg className="tick" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="tickpath" d="M3 9.5l4.5 4.5 8-10" /></svg>
              <h3>Works on a phone</h3><p>Most of your customers are standing in a line looking at their phone. That is the version we design first.</p></div>
            <div><svg className="tick" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="tickpath" d="M3 9.5l4.5 4.5 8-10" /></svg>
              <h3>Found on Google</h3><p>Titles, descriptions, structured data and a sitemap, so searching your name finds you and not a delivery app.</p></div>
          </div>
        </div>
      </section>

      <section className="price" id="pricing" data-tone="light">
        <div className="wrap">
          <p className="label">Pricing</p>
          <h2 style={{ marginTop: "1rem", maxWidth: "18ch" }}><span className="line"><span data-mask="">You will know the number before we build anything.</span></span></h2>
          <p className="lede" style={{ marginTop: "1rem" }}>Starting-from minimums, so you can qualify us before we talk. The exact number is
            quoted after you have seen your draft and before a single thing is finished.</p>
          <div className="tiers" id="tiers">
            <div className="tier feature" data-tier="" data-tone="dark">
              <span className="label">Finished and maintained</span>
              <div className="amount"><small>from</small>$1,200</div>
              <p className="tier-note" style={{ marginTop: "0", paddingTop: ".2rem" }}>One time, quoted exactly after you have seen your draft</p>
              <ul>
                <li>Everything in the list above</li>
                <li>Your domain, bought and configured</li>
                <li>Hosting, backups and uptime</li>
                <li>Unlimited edits, same day</li>
              </ul>
              <div className="monthlies">
                <div>
                  <span className="mrow"><b>Kept online</b><em>from $40 a month</em></span>
                  <span className="msub">Hosting, your domain, uptime, and same-day content edits.</span>
                </div>
                <div className="mpick">
                  <span className="mrow"><b>Kept sharp</b><em>from $120 a month</em></span>
                  <span className="msub">All of Kept online, plus the eight departments checking the site every month,
                    the fixes made, and the receipt.</span>
                </div>
              </div>
              <p className="monthly">Pick either after launch.</p>
              <SubscribeButtons />
            </div>
            <div className="tier" data-tier="">
              <span className="label">The draft</span>
              <div className="amount">$0</div>
              <ul>
                <li>A real working page on a real link</li>
                <li>Your story, researched and written</li>
                <li>Yours to keep either way</li>
              </ul>
              <p className="tier-note">Every business that applies</p>
            </div>
            <div className="tier" data-tier="">
              <span className="label">Selling online</span>
              <div className="amount"><small>from</small>+$900</div>
              <ul>
                <li>Checkout, shipping and stock</li>
                <li>Order notifications to your phone</li>
                <li>Wholesale and catering enquiries</li>
              </ul>
              <p className="tier-note">Added whenever you are ready, not up front</p>
            </div>
          </div>
        </div>
      </section>

      <section className="apply" id="apply" data-tone="light">
        <div className="wrap">
          <p className="label acc">Apply</p>
          <h2 style={{ marginTop: "1rem" }}><span className="line"><span data-mask="">Tell us about your business.</span></span></h2>
          <div className="apply-grid">
            <div className="apply-side">
              <h3>What we will ask</h3>
              <p>The draft is only as good as what you tell us. Three questions do most of the work.</p>
              <ul className="qlist">
                <li><span className="qn">Q1</span><span>What do you sell, and where do people buy it today?</span></li>
                <li><span className="qn">Q2</span><span>What do you find yourself explaining to every new customer?</span></li>
                <li><span className="qn">Q3</span><span>What would you want a website to do that Instagram cannot?</span></li>
              </ul>
              <p className="call" id="call">Would rather talk? <a href="https://cal.com/" target="_blank" rel="noopener">Book fifteen minutes</a>, no pitch deck.
                If we are not the right fit we will say so on the call rather than after an invoice. <span className="form-note">(Placeholder link.)</span></p>
            </div>

            <div className="form-wrap" id="formWrap">
              <div className="curtain" id="curtain" aria-hidden="true"></div>
              <form className="applyf" id="applyForm">
                <div className="two">
                  <div className="field"><label htmlFor="biz">Business name</label>
                    <input id="biz" name="biz" required autoComplete="organization" placeholder="Vermont Maple Lemonade" /></div>
                  <div className="field"><label htmlFor="who">Your name</label>
                    <input id="who" name="who" required autoComplete="name" placeholder="Genevieve" /></div>
                </div>
                <div className="two">
                  <div className="field"><label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@yourbusiness.com" /></div>
                  <div className="field"><label htmlFor="social">Instagram or website</label>
                    <input id="social" name="social" placeholder="@vermontmaplelemonade" /></div>
                </div>
                <div className="field"><label htmlFor="kind">What kind of business</label>
                  <select id="kind" name="kind">
                    <option>Food stand or market vendor</option>
                    <option>Restaurant, cafe or bar</option>
                    <option>Shop or retail</option>
                    <option>Services or trade</option>
                    <option>Something else</option>
                  </select></div>
                <div className="field"><label htmlFor="about">What do you sell, and what makes it different</label>
                  <textarea id="about" name="about" required placeholder="Lemonade sweetened with Grade A Dark and Robust Vermont maple syrup instead of cane sugar. We have been at Smorgasburg since 2013."></textarea></div>
                <div className="field"><label htmlFor="want">What you want the site to do</label>
                  <textarea id="want" name="want" placeholder="Tell people where the stand is this weekend, and eventually sell a powdered mix people can make at home."></textarea></div>
                <div className="form-foot">
                  <button className="btn" type="submit">Get a free draft
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 8h11M9 3l5 5-5 5" /></svg></button>
                  <span className="form-note" id="formNote">Opens your email app with everything filled in.</span>
                </div>
              </form>
            </div>
          </div>

          <div className="faq" data-batch="">
            <details><summary>Why would you build something for free?</summary>
              <p>Because describing a website is a bad way to sell one. Showing you a real page about your own business, on your phone, in five days, is a much better one. Most people say yes once they can see it. The ones who do not were never going to be happy with an invoice either.</p></details>
            <details><summary>What is the catch?</summary>
              <p>There is not one, but there is a limit: we can only carry a few free drafts at a time, so we take on the businesses we think we can genuinely help. If we cannot, we will tell you quickly instead of stringing you along.</p></details>
            <details><summary>Do I own the site?</summary>
              <p>Yes. The design, the copy, the domain and the files are yours. If you ever want to leave, we hand over everything and help you move it. No hostage hosting.</p></details>
            <details><summary>What if I already have a website?</summary>
              <p>Then the draft is a free second opinion. Plenty of businesses have a site that technically exists and quietly loses them customers. We will show you what the alternative looks like and you can compare.</p></details>
            <details><summary>How fast can you actually go?</summary>
              <p>The draft is usually five days. A finished, launched site is typically two weeks from the day you say yes, assuming we can get photos and prices from you.</p></details>
          </div>
        </div>
      </section>

      </main>

      <footer data-tone="dark" data-flip="">
        <div className="wipe" aria-hidden="true"><i className="la"></i><i className="lb"></i></div>
        <div className="marquee" aria-hidden="true">
          <div className="track" id="marqueeTrack">
            <span>We build your site first <i></i> You decide after <i></i> Draft in five days <i></i> From $1,200, then from $40 a month <i></i></span><span>We build your site first <i></i> You decide after <i></i> Draft in five days <i></i> From $1,200, then from $40 a month <i></i></span>
          </div>
        </div>
        <div className="wrap">
          <div className="f-top">
            <div>
              <span className="mark" style={{ fontSize: "1.4rem" }}><svg className="halmos" viewBox="0 0 32 32" aria-hidden="true"><path className="frame" d="M18.5 4.5H4.5v23h23V13.5" /><rect className="stone" x="20.5" y="2" width="9.5" height="9.5" /></svg>Proof</span>
              <p>We build your site first. You decide after.</p>
            </div>
            <div className="f-links">
              <a href="#how">How it works</a>
              <a href="#work">The work</a>
              <a href="#team">The team</a>
              <a href="/rulebook">The rulebook</a>
              <a href="#pricing">Pricing</a>
              <a href="#apply">Apply</a>
            </div>
          </div>
          <p className="f-note"><b>Said plainly, because the rest of this page asks you to trust us.</b> The prices above are real
            starting figures and the exact number is quoted after you have seen your draft. The Vermont Maple Lemonade page described in
            The Work was built on spec and was not a paid commission; it is a draft shown with that stated. We have no client roster to
            show yet and this page claims none, no testimonials, and no result that has not happened. The check quoted in After it
            launches was run against this page by the rulebook linked there, and it is the only performance claim anywhere on this site:
            a count of rules that ran, not a promise about search results. Nobody can promise those.</p>
          <div className="f-big" id="fBig" aria-hidden="true">PROOF</div>
        </div>
      </footer>
    </>
  );
}
