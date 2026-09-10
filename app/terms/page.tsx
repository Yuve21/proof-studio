import type { Metadata } from "next";
import { PLANS } from "../../lib/billing/catalog.mjs";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "What Proof agrees to do, what it costs, what unlimited edits actually means, and how to cancel.",
};

/**
 * Terms.
 *
 * THREE THINGS THIS PAGE EXISTS TO DO, and only the third is the usual reason.
 *
 * 1. SCOPE "UNLIMITED EDITS". The marketing page promises "Edits, unlimited"
 *    and "same day", against a monthly fee. Uncapped labour for a fixed price is
 *    a liability that feels free at three clients and is impossible at thirty, and
 *    the honest fix is not to withdraw the promise but to say what an edit IS.
 *    Content is unlimited; a new page or a new feature is quoted. That is what a
 *    reasonable client already assumes, so writing it down costs nothing and
 *    prevents the one argument that would otherwise happen.
 *
 * 2. MAKE THE AUTO-RENEWAL DISCLOSURE POINT SOMEWHERE. The subscribe button
 *    carries the disclosure several states require, and until now it linked to
 *    nothing.
 *
 * 3. Be the terms.
 *
 * Written in plain sentences on purpose. The customer is a food stand or a shop,
 * and terms nobody reads protect nobody. Prices are read from the billing catalog
 * so this page cannot quote a different number from the one Stripe charges.
 */
export default function Terms() {
  const online = PLANS["kept-online"];
  const sharp = PLANS["kept-sharp"];

  return (
    <main id="top">
      <section className="rb" data-tone="light">
        <div className="wrap">
          <p className="label acc">Terms</p>
          <h1 style={{ marginTop: "1rem", maxWidth: "20ch" }}>What we agree to.</h1>
          <p className="lede" style={{ marginTop: "1.2rem", maxWidth: "64ch" }}>
            In plain sentences, because terms nobody reads protect nobody. If anything below is
            unclear, ask before you agree to it and we will say it a different way.
          </p>

          <div className="tm">
            <h2>The free draft</h2>
            <p>
              You apply, we build a real working draft of your website, and you owe us nothing for it.
              You keep the files whether or not you go ahead. We may decline to build one, and we will
              say so quickly rather than leaving you waiting. Drafts are speculative work: we are not
              your contractor until you say yes and we agree a price.
            </p>

            <h2>The build, and its price</h2>
            <p>
              The figures on the pricing section are <b>starting minimums</b>, not quotes. The exact
              number is agreed with you in writing after you have seen your draft and before any work
              continues. If we ever cannot do it for the number we agreed, that is our problem, not a
              reason to change the number.
            </p>

            <h2>What you own</h2>
            <p>
              You own the design, the copy, the images we made for you, the domain and the files. If
              you leave, we hand everything over and help you move it. We do not hold your site or
              your domain to make leaving difficult. We keep the right to describe the work publicly
              and to show it as an example unless you ask us not to, and asking is enough.
            </p>

            <h2>Unlimited edits, and what an edit is</h2>
            <p>
              This is the part worth being precise about, because &quot;unlimited&quot; without a scope is a
              promise neither of us can rely on.
            </p>
            <p>
              <b>An edit is a change to the content of a page that already exists.</b> New prices, new
              hours, a new item on the menu, swapped photos, a closed weekend, a new paragraph, fixing
              something we got wrong. Those are unlimited, they are included, and we aim to make them
              the same working day.
            </p>
            <p>
              <b>A new page, a new feature, or a redesign is a new piece of work</b> and we quote it
              before starting. Adding online ordering, a booking system, a members area, or a second
              language are examples. We will always tell you which side of that line a request falls
              on before doing anything, and if it is genuinely borderline we will treat it as an edit.
            </p>

            <h2>The monthly plans</h2>
            <p>
              <b>{online.name}, from ${online.monthlyFrom} a month.</b> Hosting, your domain and its
              renewal, uptime, backups, and content edits as described above.
            </p>
            <p>
              <b>{sharp.name}, from ${sharp.monthlyFrom} a month.</b> Everything in {online.name},
              plus a monthly check of your site against our published rulebook, the fixes made, and a
              written record of what was found. The rulebook is at{" "}
              <a href="/rulebook">/rulebook</a> and every rule in it is published together with the
              case where that rule is wrong.
            </p>
            <p>
              <b>Billing renews automatically each month until you cancel.</b> You will be charged the
              agreed amount on the same date each month. We will tell you in writing before any price
              change, and a price change never applies to a month you have already paid for.
            </p>

            <h2>Cancelling</h2>
            <p>
              Cancel at any time from your billing page, which is one click from your receipt. No
              phone call, no notice period, no form. You keep the rest of the month you have paid for
              and you are not charged again. If your site is hosted with us, we will keep it online
              for thirty days after your last paid month so you have time to move it, and we will help
              you move it.
            </p>
            <p>
              Refunds: if we have not done the work, we refund it. If you cancel mid-month we do not
              pro-rate, because you keep the month. If something has gone wrong, tell us and we will
              make it right rather than pointing at this paragraph.
            </p>

            <h2>What the monthly check is and is not</h2>
            <p>
              It is a deterministic check against a published list of rules. Every finding names the
              exact thing it looked at so you can go and verify it, and every rule is published with
              the condition under which it gives the wrong answer.
            </p>
            <p>
              <b>It is not a prediction about search results, and we do not make one.</b> Nobody can
              promise a ranking, a position, an amount of traffic or a number of customers, and any
              agency that does is telling you something they cannot substantiate. What we promise is
              the check, the findings, the fixes, and the record.
            </p>
            <p>
              When a check cannot read enough of a page to judge it, it says so and withholds the
              result rather than reporting a clean one. You will see that in your record when it
              happens.
            </p>

            <h2>The licence for the team tools</h2>
            <p>
              If your plan includes the departments as tools you can use yourself, you receive a
              licence that works on your own machine and makes no outside requests. It is for your
              business, and sharing it outside your business ends it. It stops working shortly after
              the period you have paid for, and paying again issues a new one.
            </p>

            <h2>When we would stop working with you</h2>
            <p>
              If a payment fails and is not fixed, if the work is for something illegal, or if
              somebody is abusive to a person on our side. We will tell you which and give you the
              chance to fix it where fixing it is possible.
            </p>

            <h2>The boring necessary part</h2>
            <p>
              We are a small independent studio and we do not promise the site will never go down. We
              promise to fix it when it does, and to be the ones who notice. Our liability is limited
              to what you have paid us in the previous three months, which is the normal arrangement
              for work at this size. Nothing here removes a right you have by law.
            </p>

            <h2>Changes to these terms</h2>
            <p>
              If we change them we will tell you before the change applies to you, and the version you
              agreed to keeps applying until then. We will not change what you have already paid for.
            </p>

            <h2>Reaching a person</h2>
            <p>
              Email <a href="mailto:yuvraj.chandyok@gmail.com">yuvraj.chandyok@gmail.com</a>. A person
              reads it. Last updated 10 September 2026.
            </p>
          </div>

          <p className="rb-back">
            <a href="/">Back to Proof</a> &nbsp;·&nbsp; <a href="/privacy">Privacy</a>
          </p>
        </div>
      </section>
    </main>
  );
}
