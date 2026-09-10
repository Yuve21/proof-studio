/**
 * Tests for the surfaces around the billing core: robots, the sitemap, the legal
 * pages, the apply form, and the mail path.
 *
 * These are mostly about things that must be PRESENT. That is a weaker kind of
 * test than a behavioural one, and it earns its place for one reason: every item
 * here is something that was absent on a live site, or a placeholder pointing
 * nowhere, and a page or a disclosure is the easiest thing in a repository to
 * delete by accident while tidying.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { SITE, INDEXABLE, DISALLOWED } from "./site.mjs";
import { sendMail, renewalMessage } from "./mail/send.mjs";
import { PLANS } from "./billing/catalog.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("the site URL is not the domain somebody else owns", () => {
  /*
   * MEASURED, NOT HYPOTHETICAL. `proof-studio.vercel.app` is claimed by an
   * unrelated Vercel account and serves an app titled "Portfolio". It was the
   * canonical link, the og:image host and the JSON-LD url, so all three told
   * search engines this page's content belongs to a stranger's domain.
   */
  assert.ok(!SITE.includes("//proof-studio.vercel.app"), `SITE must not be the stranger's domain, got ${SITE}`);
  assert.match(SITE, /^https:\/\//, "it must be absolute and https, or a canonical is meaningless");
  assert.ok(!SITE.endsWith("/"), "no trailing slash, or every generated URL doubles it");
});

test("the sitemap lists the public pages and EXCLUDES the receipt page", () => {
  const paths = INDEXABLE.map((p) => p.path);
  for (const required of ["/", "/rulebook", "/terms", "/privacy"]) {
    assert.ok(paths.includes(required), `${required} must be in the sitemap`);
  }
  /*
   * /welcome carries a checkout session id in its URL, so listing it would invite
   * a crawler to fetch somebody's receipt. Asserted rather than assumed, because
   * "we left it out on purpose" is exactly the intention that evaporates when the
   * next route is added.
   */
  assert.ok(!paths.includes("/welcome"), "/welcome must never be in the sitemap");
  assert.ok(
    DISALLOWED.some((d) => d.path === "/welcome"),
    "/welcome must be disallowed in robots.txt as well as absent from the sitemap",
  );
  // Every disallow carries a reason, so nobody deletes one they cannot explain.
  for (const d of DISALLOWED) assert.ok(d.why && d.why.length > 10, `${d.path} needs a stated reason`);
});

test("robots and the sitemap read the SAME list, so they cannot disagree", () => {
  const robots = read("../app/robots.ts");
  const sitemap = read("../app/sitemap.ts");
  for (const f of [robots, sitemap]) {
    assert.match(f, /from "\.\.\/lib\/site\.mjs"/, "both must import the shared list rather than restating it");
  }
  assert.match(robots, /DISALLOWED/);
  assert.match(sitemap, /INDEXABLE/);
});

test("the terms page exists and scopes what an unlimited edit is", () => {
  /*
   * The marketing page promises "Edits, unlimited" and "same day" against a
   * fixed monthly fee. Uncapped labour for a fixed price feels free at three
   * clients and is impossible at thirty. The fix is not to withdraw the promise,
   * it is to say what an edit IS, so this asserts the scope is actually written
   * down rather than merely intended.
   */
  const terms = read("../app/terms/page.tsx");
  assert.match(terms, /An edit is a change to the content of a page that already exists/);
  assert.match(terms, /A new page, a new feature, or a redesign is a new piece of work/);
  // And the cancellation terms, which is what the auto-renewal disclosure promises.
  assert.match(terms, /Cancel at any time/);
  assert.match(terms, /renews automatically each month until you cancel/i);
  // And the claim it must NOT make.
  assert.match(terms, /It is not a prediction about search results/);
});

test("the terms READ the plans from the catalog rather than restating them", () => {
  /*
   * The first version of this test asserted the terms CONTAINED the literal
   * strings "Kept online" and "$40", and it failed, because the page interpolates
   * both from the billing catalog. The page was more correct than the test.
   *
   * That is the assertion worth keeping anyway, just inverted: what matters is
   * not that the terms happen to agree with Stripe today, it is that they CANNOT
   * disagree. A hard-coded price or plan name here is the defect, because terms
   * quoting a different number from the charge is what ends in a chargeback
   * rather than a bug report. So this asserts the mechanism.
   */
  const terms = read("../app/terms/page.tsx");
  assert.match(terms, /from "\.\.\/\.\.\/lib\/billing\/catalog\.mjs"/, "terms must import the catalog");
  assert.match(terms, /PLANS\["kept-online"\]/);
  assert.match(terms, /PLANS\["kept-sharp"\]/);
  assert.match(terms, /\{online\.name\}/, "the plan name must be interpolated, not typed");
  assert.match(terms, /\{sharp\.name\}/);
  assert.match(terms, /\{online\.monthlyFrom\}/, "the price must be interpolated, not typed");
  assert.match(terms, /\{sharp\.monthlyFrom\}/);

  // And no literal price anywhere in the terms, which is what would drift.
  for (const plan of Object.values(PLANS)) {
    assert.ok(
      !terms.includes(`$${plan.monthlyFrom} a month`),
      `terms must not hard-code $${plan.monthlyFrom}; interpolate it from the catalog`,
    );
  }
});

test("the privacy page exists and does not claim more than the code does", () => {
  const privacy = read("../app/privacy/page.tsx");
  assert.match(privacy, /no accounts, no database of its own, no analytics and no cookies we set/);
  // The one thing it says that must stay true of the shipped software.
  assert.match(privacy, /makes no network requests of any kind/);
  // And the honest limit, because a page claiming total deletion while tax law
  // requires retention is a page that is wrong.
  assert.match(privacy, /cannot delete on request/);
});

test("the apply form no longer points at a placeholder address", () => {
  /*
   * THE WORST DEFECT THAT WAS LIVE. The handler sent every application to
   * hello@example.com and then told the visitor it had worked, so every
   * application was discarded by a mail server while the person applying saw a
   * confirmation. The free draft is the entire hook and this form is the only way
   * to ask for one.
   */
  const cho = read("../public/choreography.js");
  const to = cho.match(/var TO = "([^"]+)"/);
  assert.ok(to, "the fallback address must be present");
  assert.ok(!to[1].includes("example.com"), `the destination is still a placeholder: ${to[1]}`);
  assert.match(to[1], /^[^@\s]+@[^@\s]+\.[^@\s]+$/, "and it must look like an address");

  // It must try the server and fall back, rather than only doing one of them.
  assert.match(cho, /fetch\("\/api\/apply"/, "the form must post to the API");
  assert.match(cho, /mailto\(\);/, "and must fall back so an application is never lost");
  assert.ok(existsSync(new URL("../app/api/apply/route.ts", import.meta.url)), "the API route must exist");
});

test("the apply route refuses an incomplete application instead of accepting it", async () => {
  const { POST } = await import("../app/api/apply/route.ts").catch(() => ({ POST: null }));
  // The route is TypeScript and cannot be imported by node directly. Assert the
  // contract from the source instead, and say so rather than pretending this is
  // an integration test.
  if (!POST) {
    const src = read("../app/api/apply/route.ts");
    assert.match(src, /const REQUIRED = \["biz", "who", "email", "about"\]/);
    assert.match(src, /delivered: false/, "a refusal must say it did not deliver");
    assert.ok(
      !/delivered: true/.test(src.split("if (!key || !from)")[1]?.split("}")[0] ?? ""),
      "the unconfigured branch must never claim delivery",
    );
  }
});

test("sendMail reports NOT SENT when it is not configured, rather than claiming success", async () => {
  const saved = [process.env.RESEND_API_KEY, process.env.PROOF_MAIL_FROM];
  delete process.env.RESEND_API_KEY;
  delete process.env.PROOF_MAIL_FROM;
  try {
    const r = await sendMail({ to: "a@b.co", subject: "s", text: "t" });
    assert.equal(r.sent, false, "an unconfigured send must never report sent");
    assert.equal(r.reason, "not-configured", "and not-configured must be distinguishable from a refusal");
  } finally {
    if (saved[0] !== undefined) process.env.RESEND_API_KEY = saved[0];
    if (saved[1] !== undefined) process.env.PROOF_MAIL_FROM = saved[1];
  }
});

test("sendMail refuses an incomplete message without calling out", async () => {
  const r = await sendMail({ to: "", subject: "s", text: "t" });
  assert.equal(r.sent, false);
  // Either reason is correct depending on configuration; what matters is that it
  // is not "sent".
  assert.ok(["not-configured", "incomplete-message"].includes(r.reason));
});

test("the renewal email leads with the token and states the expiry", () => {
  /*
   * The customer has already paid, and receiving this token is the only thing
   * between them and a working product. So the token goes near the top, the
   * install line is included so they do not have to go and find it, and the
   * expiry is stated so a lapse is never a surprise.
   */
  const msg = renewalMessage({
    token: "proof1.k1.PAYLOAD.SIGNATURE",
    expires: new Date("2026-11-01T00:00:00Z"),
    planName: "Kept sharp",
  });
  assert.match(msg.subject, /licence/i);
  const tokenAt = msg.text.indexOf("proof1.k1.PAYLOAD.SIGNATURE");
  assert.ok(tokenAt > 0, "the token must be in the message");
  assert.ok(tokenAt < msg.text.length / 2, "and it must be in the first half, not buried");
  assert.match(msg.text, /runs until/, "the expiry must be stated");
  assert.match(msg.text, /claude mcp add proof/, "the install line saves them looking it up");
  assert.match(msg.text, /we strip the break/, "and the wrapped-token worry must be pre-answered");
});

test("the webhook reports an undelivered renewal instead of swallowing it", () => {
  const src = read("../app/api/stripe/webhook/route.ts");
  assert.match(src, /a renewal licence was minted but NOT delivered/);
  // The send must not fail the webhook, or Stripe retries a successful payment
  // handler and re-mints rather than re-sending.
  assert.match(src, /A failed send does NOT fail the webhook/);
  assert.match(src, /delivered: delivery\.sent/, "the response must state whether it was delivered");
});
