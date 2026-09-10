import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Proof collects, what it does not, who else sees it, and how to get it deleted. Short, because there is not much.",
};

/**
 * Privacy.
 *
 * SHORT BECAUSE THE ANSWER IS SHORT, and that is worth being explicit about
 * rather than padding to look thorough. Proof has no accounts, no database, no
 * analytics and no cookies of its own. The honest version of this page is mostly
 * a list of things that do not happen, and a list of gaps a reader can check is
 * worth more than a page of reassurance they cannot.
 *
 * IT MUST AGREE WITH WHAT THE SITE ACTUALLY DOES. The sibling product's rule is
 * that a change to what a thing writes, reads or records changes its published
 * description in the SAME commit. So every claim below is one somebody could
 * verify by reading the repository, which is public.
 */
export default function Privacy() {
  return (
    <main id="top">
      <section className="rb" data-tone="light">
        <div className="wrap">
          <p className="label acc">Privacy</p>
          <h1 style={{ marginTop: "1rem", maxWidth: "22ch" }}>Short, because there is not much.</h1>
          <p className="lede" style={{ marginTop: "1.2rem", maxWidth: "64ch" }}>
            This site has no accounts, no database of its own, no analytics and no cookies we set.
            Most of what follows is a list of things that do not happen. The code is public, so you
            can check rather than take our word for it.
          </p>

          <div className="tm">
            <h2>When you apply for a draft</h2>
            <p>
              The form sends us your business name, your name, your email, optionally a social or
              website link, and what you tell us about your business. It goes to an email inbox. That
              is the whole path. It is not stored in a database, not added to a mailing list, and not
              used for anything except replying to you and building your draft.
            </p>
            <p>
              If our email sending is not switched on, the form opens your own mail app with
              everything filled in and you press send. In that case nothing reaches us until you do.
            </p>

            <h2>When you pay</h2>
            <p>
              Payments are handled entirely by <b>Stripe</b>. Your card details go to them and never
              to us: we never see or hold a card number. Stripe tells us that a payment succeeded,
              your email, and the country for tax purposes. Stripe is the record of your subscription
              and their privacy policy applies to what they hold.
            </p>
            <p>
              We store one thing against your Stripe customer record: your licence and its expiry
              date. That is so your receipt page and your billing page can hand it back to you without
              us running a database. Cancelling clears it.
            </p>

            <h2>The monthly check on your site</h2>
            <p>
              It reads your own public web pages, the same pages anybody visiting your site reads. It
              makes no outside requests while doing so and sends nothing anywhere. The findings go to
              you.
            </p>
            <p>
              If your plan includes the tools to run checks yourself, that software runs on your own
              machine and <b>makes no network requests of any kind</b>. Nothing about your business
              reaches us or anybody else through it. That is not a policy, it is how it is built, and
              it is why your licence is verified offline rather than by asking a server.
            </p>

            <h2>What we do not do</h2>
            <ul>
              <li>No analytics, no tracking pixels, no session recording, no heatmaps.</li>
              <li>No cookies set by us. Stripe sets its own during checkout, on its own pages.</li>
              <li>No advertising, no retargeting, and nothing sold or shared with a data broker.</li>
              <li>No mailing list. If we email you it is because you wrote to us or you are a client.</li>
              <li>No account to create, so no password of yours to lose.</li>
            </ul>

            <h2>Who else sees anything</h2>
            <p>
              Three companies, each doing one job: <b>Vercel</b> hosts the site and keeps ordinary
              server logs, <b>Stripe</b> processes payments, and an email provider delivers mail. That
              is the complete list. If it changes we will change this page in the same week, and the
              repository history will show when.
            </p>

            <h2>How long anything is kept</h2>
            <p>
              Application emails are kept while we are talking and for a year after, so we can pick a
              conversation back up. Billing records are kept as long as tax law requires, which is
              seven years, and that is Stripe&apos;s copy rather than ours. Your licence record is
              cleared when you cancel.
            </p>

            <h2>Getting it deleted</h2>
            <p>
              Email us and ask. We will delete the application email and anything else we hold, and
              tell you what we deleted. There is no form and no verification hoop, because there is no
              account to verify against. Billing records we have to keep for tax are the one thing we
              cannot delete on request, and we will say so plainly rather than pretending.
            </p>
            <p>
              If you are in the UK or EU, the rights you have under GDPR apply and the above is how you
              exercise them. If you are in California, the same: we do not sell personal information,
              so there is nothing to opt out of.
            </p>

            <h2>Children</h2>
            <p>This is a service for businesses. It is not for anybody under 18 and we do not knowingly collect anything from them.</p>

            <h2>Reaching a person</h2>
            <p>
              Email <a href="mailto:yuvraj.chandyok@gmail.com">yuvraj.chandyok@gmail.com</a>. A person
              reads it. Last updated 10 September 2026.
            </p>
          </div>

          <p className="rb-back">
            <a href="/">Back to Proof</a> &nbsp;·&nbsp; <a href="/terms">Terms</a>
          </p>
        </div>
      </section>
    </main>
  );
}
