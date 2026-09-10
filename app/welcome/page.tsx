import type { Metadata } from "next";
import Stripe from "stripe";
import { PLANS } from "../../lib/billing/catalog.mjs";

export const metadata: Metadata = {
  title: "Your licence and how to install it",
  robots: { index: false, follow: false },
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a paying customer collects their licence and the install line.
 *
 * NOINDEX, deliberately, because the URL carries a session id.
 *
 * WHY THE TOKEN IS READ FROM STRIPE RATHER THAN MINTED HERE. The webhook is the
 * only thing that mints, on the strength of a verified event, and this page only
 * DISPLAYS what the webhook stored. If minting also happened here, a customer
 * reloading the page would produce a second valid licence, and there would be two
 * places that decide who is entitled. One place decides; this one reads.
 *
 * THE CONSEQUENCE, and it is visible to the customer rather than hidden: a
 * webhook that has not arrived yet means no token to show. So the empty state
 * says exactly that and asks them to refresh, instead of showing a blank box or,
 * worse, minting one to fill the space.
 */
export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const key = process.env.STRIPE_SECRET_KEY;

  let state: "no-session" | "not-configured" | "unpaid" | "pending" | "ready" | "error" = "no-session";
  let token: string | null = null;
  let planName: string | null = null;
  let expires: string | null = null;

  if (!sessionId) {
    state = "no-session";
  } else if (!key) {
    state = "not-configured";
  } else {
    try {
      const stripe = new Stripe(key, { timeout: 10_000, maxNetworkRetries: 2 });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
      if (!paid) {
        state = "unpaid";
      } else {
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const customer = customerId ? await stripe.customers.retrieve(customerId) : null;
        const meta = customer && !("deleted" in customer) ? customer.metadata : null;
        token = meta?.proof_licence || null;
        expires = meta?.proof_licence_expires || null;
        const planId = meta?.proof_plan || null;
        planName = planId && PLANS[planId as keyof typeof PLANS]?.name ? PLANS[planId as keyof typeof PLANS].name : null;
        state = token ? "ready" : "pending";
      }
    } catch {
      state = "error";
    }
  }

  const install = token
    ? `claude mcp add proof --env PROOF_LICENCE=${token} -- npx -y github:Yuve21/proof-team-mcp`
    : null;

  return (
    <main id="top">
      <section className="wl" data-tone="light">
        <div className="wrap">
          <p className="label acc">{state === "ready" ? "You are set up" : "Setting you up"}</p>
          <h1 style={{ marginTop: "1rem", maxWidth: "22ch" }}>
            {state === "ready" ? "Here is your licence." : "One moment."}
          </h1>

          {state === "ready" && (
            <>
              <p className="lede" style={{ marginTop: "1.2rem", maxWidth: "62ch" }}>
                {planName ? `${planName} is active.` : "Your plan is active."} Paste the line below into
                whichever assistant you already use and the team becomes available to it. Nothing about
                your business leaves your machine to make that work.
              </p>

              <div className="wl-box">
                <p className="label">Your licence</p>
                <pre className="wl-token">{token}</pre>
                <p className="wl-note">
                  Keep this somewhere you can find it. If your email client wraps it across two lines
                  that is fine, we strip the line break.
                  {expires ? ` It runs until ${new Date(expires).toLocaleDateString("en-US", { dateStyle: "long" })}.` : ""}
                </p>
              </div>

              <div className="wl-box">
                <p className="label">Claude Code</p>
                <pre className="wl-token">{install}</pre>
              </div>

              <div className="wl-box">
                <p className="label">Cursor, Codex, or anything else speaking MCP</p>
                <pre className="wl-token">{`{
  "mcpServers": {
    "proof": {
      "command": "npx",
      "args": ["-y", "github:Yuve21/proof-team-mcp"],
      "env": { "PROOF_LICENCE": "${token?.slice(0, 24)}..." }
    }
  }
}`}</pre>
                <p className="wl-note">
                  Put the full licence in place of the shortened one above. It goes in the env block
                  rather than in a file you commit, so it never lands in your version history.
                </p>
              </div>

              <div className="wl-box">
                <p className="label">To check it worked</p>
                <p className="wl-note">
                  Ask your assistant to run <code>licence_status</code>. It answers with your plan, the
                  expiry date, how many departments are available, and the words &quot;verified offline, no
                  network request was made&quot;. If something is wrong it says which thing, because
                  &quot;it does not work&quot; is the least useful thing we could tell you.
                </p>
              </div>
            </>
          )}

          {state === "pending" && (
            <p className="lede" style={{ marginTop: "1.2rem", maxWidth: "60ch" }}>
              Your payment went through and your licence is being issued. This usually takes a few
              seconds. Refresh this page and it will be here. If it is still not here in a minute,
              email us and we will hand it over directly, because at that point it is our problem
              rather than yours.
            </p>
          )}

          {state === "unpaid" && (
            <p className="lede" style={{ marginTop: "1.2rem", maxWidth: "60ch" }}>
              Your payment has not settled yet, which is normal for some payment methods and can take
              a few minutes. Nothing is wrong. Come back to this page and your licence will be here.
            </p>
          )}

          {state === "no-session" && (
            <p className="lede" style={{ marginTop: "1.2rem", maxWidth: "60ch" }}>
              This page needs the link from your receipt. If you have just paid, use the link Stripe
              sent you. If you are looking at pricing, that is <a href="/#pricing">back on the main page</a>.
            </p>
          )}

          {(state === "not-configured" || state === "error") && (
            <p className="lede" style={{ marginTop: "1.2rem", maxWidth: "60ch" }}>
              We could not look your order up just now. That is on us, not on you. Email us with the
              link you are on and we will sort it out by hand.
            </p>
          )}

          <p className="rb-back" style={{ marginTop: "3rem" }}>
            <a href="/">Back to Proof</a>
            {state === "ready" ? <span> &nbsp;·&nbsp; <a href="/rulebook">The rulebook</a></span> : null}
          </p>
        </div>
      </section>
    </main>
  );
}
