/**
 * Turns a verified licence into the registry the MCP server actually builds from.
 *
 * THIS IS THE FILE THAT MAKES THE LICENCE UNBYPASSABLE, and it does it by
 * construction rather than by checking.
 *
 * The sibling product's oldest open defect is a function carrying fourteen
 * guards that no shipping path calls: every guarantee downstream of it holds by
 * the good behaviour of its callers instead of by construction. A licence check
 * written the same way, as `if (!isEntitled(agent)) throw`, has the same fate the
 * moment somebody adds a tool and forgets the line.
 *
 * So there is no per-call check here. `registrable()` returns the agents that
 * exist for this customer, the server registers exactly those, and an unentitled
 * agent is never registered. Forgetting to check is not possible because there is
 * nothing to check: the agent is absent.
 *
 * The failure mode this leaves is the honest one. An unlicensed customer connects
 * and sees a server with no agents on it and one tool that explains why, which is
 * a legible state rather than sixty tools that all refuse.
 */
import { readFileSync } from "node:fs";
import { entitlement } from "./verify.mjs";

/**
 * Tiers from docs/AGENT-ROSTER-PLAN.md. A licence may name a tier or explicit ids.
 *
 * ALL FIVE ARE DEFINED HERE, and the reason is a defect found by execution rather
 * than by reading. With only tier-1 defined, a perfectly valid tier-2 licence
 * returned `licence.valid: true` and registered ZERO agents. A customer who paid
 * would have had a working licence and an empty server, and the licence layer
 * would have reported success. That is the failure class this house exists to
 * catch, sitting in the thing that decides whether a customer got what they paid
 * for.
 *
 * The membership is asserted against the plan by a test that requires the five
 * tiers to PARTITION the roster exactly: every seat in exactly one tier, no
 * overlaps, no omissions. Two independently written lists compared in both
 * directions, rather than one derived from the other, which would make the check
 * a mirror.
 */
export const TIERS = {
  // Ships with the first paying site. Every one deterministic.
  "tier-1": [
    "template-tells", "seo-technical", "seo-onpage", "seo-structured-data", "accessibility",
    "performance-engineer", "mobile-experience", "broken-things", "forms-and-capture",
    "claims-officer", "release-verifier",
  ],
  // By the first monthly renewals. Includes the governance seats, because the
  // moment a corpus starts growing it needs a steward and an adversary.
  "tier-2": [
    "seo-local", "seo-content", "seo-performance", "seo-reporting", "web-craft", "copy-reviewer",
    "conversion-auditor", "brand-voice-keeper", "email-deliverability", "seasonal-calendar",
    "privacy-steward", "improvement-agent", "false-positive-hunter", "corpus-steward",
  ],
  // Commerce clients, when the first one buys the ecommerce tier.
  "tier-3": [
    "checkout-auditor", "pricing-analyst", "product-catalog", "inventory-and-fulfilment",
    "payments-and-fees", "subscription-and-retention", "refunds-and-disputes",
  ],
  // The monthly licence for larger organisations, where somebody on staff can act
  // on the output.
  "tier-4": [
    "content-strategist", "content-writer", "social-media-manager", "social-publisher",
    "email-lifecycle", "paid-ads-auditor", "review-and-reputation", "photography-director",
    "video-and-reels", "newsletter", "partnerships-and-local",
    "support-agent", "inbox-triage", "booking-and-reservations", "feedback-analyst",
    "loyalty-and-repeat",
  ],
  // Last, because these need real financial and legal data, and therefore real
  // consent and real care.
  "tier-5": [
    "bookkeeping-reviewer", "margin-analyst", "cashflow", "supplier-and-cost", "hiring-and-roles",
    "compliance-calendar", "insurance-and-risk",
    "terms-and-policies", "accessibility-legal", "contracts-reviewer",
    "seo-competitive", "vacuous-check-hunter",
  ],
};

/**
 * Parse the roster out of the plan document, so the plan is the single source of
 * truth for which agents exist at all. A licence naming an agent the roster does
 * not define is a licence for nothing, and that is reported rather than ignored.
 *
 * @param {string} planPath
 * @returns {Map<string, {id: string, kind: "D"|"A", blurb: string}>}
 */
export function loadRoster(planPath = "docs/AGENT-ROSTER-PLAN.md") {
  const text = readFileSync(planPath, "utf8");
  const seats = [...text.matchAll(/^\d+\. \*\*([a-z-]+)\*\* \[([DA])\]\s*(.+)$/gm)];
  if (seats.length === 0) {
    throw new Error(
      `no seats parsed from ${planPath}. Refusing to build an empty roster: a server that ` +
      `registers nothing and reports success is indistinguishable from a broken one.`,
    );
  }
  return new Map(seats.map((m) => [m[1], { id: m[1], kind: m[2], blurb: m[3].trim() }]));
}

/**
 * The agents to register for this token. Everything else does not exist.
 *
 * @param {string} token
 * @param {object} [opts] passed through to entitlement(), plus `roster` and `planPath`
 * @returns {{agents: Array<{id: string, kind: string, blurb: string}>, licence: object, unknown: string[]}}
 */
export function registrable(token, opts = {}) {
  const licence = entitlement(token, opts);
  if (!licence.valid) return { agents: [], licence, unknown: [], status: "unlicensed" };

  const roster = opts.roster ?? loadRoster(opts.planPath);

  // A tier name expands to its members. An explicit id stays itself.
  const requested = new Set();
  for (const entry of licence.agents) {
    if (TIERS[entry]) for (const id of TIERS[entry]) requested.add(id);
    else requested.add(entry);
  }

  // An entitled id the roster does not define is REPORTED, not silently dropped.
  // A licence that quietly entitles nothing would otherwise look like a licence
  // that works, which is the direction that produces a support ticket instead of
  // a bug report.
  const unknown = [...requested].filter((id) => !roster.has(id));
  const agents = [...requested].filter((id) => roster.has(id)).sort().map((id) => roster.get(id));

  /*
   * THE STATUS FIELD EXISTS BECAUSE OF A MEASURED DEFECT.
   *
   * A valid tier-2 licence used to come back as `licence.valid: true` with zero
   * agents, because `TIERS` defined only tier-1. Nothing in the shape of that
   * answer said anything was wrong: a caller reading `licence.valid` would render
   * a healthy server with no tools on it.
   *
   * "Licensed, and entitles nothing" is a THIRD state, not a variety of working,
   * and it is always a mistake on our side rather than the customer's: a tier we
   * have not defined, or a seat we have not built. So it gets its own name, and
   * the server is expected to surface it as a fault and tell the customer to
   * contact us rather than to check their token.
   */
  const status = agents.length === 0 ? "entitles-nothing" : "ok";

  return { agents, licence, unknown, status };
}
