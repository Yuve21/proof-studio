"use client";

import { useState } from "react";

/**
 * The two subscribe buttons on the pricing tier.
 *
 * The ONLY client component on the site, and it is one because a checkout needs
 * a click handler. Everything else stays server-rendered, which is why the
 * choreography can keep owning the DOM.
 *
 * THE THREE STATES ARE ALL VISIBLE, because a payment button that does nothing
 * is the worst possible component:
 *   idle     the button
 *   working  disabled, and says so, so nobody clicks twice and starts two
 *            checkouts
 *   error    the reason, in plain words, in place. A 503 from an unconfigured
 *            deployment reads as "not switched on yet" rather than as a failure
 *            the customer caused.
 */
export function SubscribeButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (plan: string) => {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setError(data?.error || "Checkout could not be started. Nothing has been charged.");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Checkout could not be reached. Nothing has been charged.");
      setBusy(null);
    }
  };

  return (
    <div className="subs">
      <button className="btn sm" onClick={() => go("kept-online")} disabled={busy !== null}>
        {busy === "kept-online" ? "Opening checkout…" : "Start Kept online"}
      </button>
      <button className="btn sm alt" onClick={() => go("kept-sharp")} disabled={busy !== null}>
        {busy === "kept-sharp" ? "Opening checkout…" : "Start Kept sharp"}
      </button>
      {error ? <p className="subs-err">{error}</p> : null}
      {/*
        AUTO-RENEWAL DISCLOSURE. Not decoration and not legal throat-clearing:
        several states require that a recurring charge is disclosed clearly BEFORE
        the subscription starts and that cancelling is at least as easy as
        starting. So the terms sit next to the button that agrees to them, and the
        cancel route is a link rather than an email address.
      */}
      <p className="subs-terms">
        Billed monthly, automatically, until you cancel. Cancel any time from your billing page,
        which is one click from your receipt, and you keep the rest of the month you paid for.
        The number quoted is a starting figure and the exact amount is agreed with you before
        anything is charged. <a href="/terms">Terms</a>, including what an unlimited edit is.
      </p>
    </div>
  );
}
