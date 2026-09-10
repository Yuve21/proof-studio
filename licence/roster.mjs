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

/** Tiers from docs/AGENT-ROSTER-PLAN.md. A licence may name a tier or explicit ids. */
export const TIERS = {
  "tier-1": [
    "template-tells", "seo-technical", "seo-onpage", "seo-structured-data", "accessibility",
    "performance-engineer", "mobile-experience", "broken-things", "forms-and-capture",
    "claims-officer", "release-verifier",
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
  if (!licence.valid) return { agents: [], licence, unknown: [] };

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

  return { agents, licence, unknown };
}
