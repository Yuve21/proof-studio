/**
 * The tool implementations, kept out of the server so they can be tested without
 * a transport.
 *
 * THE TOKEN BUDGET IS A DESIGN CONSTRAINT HERE, not a nicety. An MCP host loads
 * every tool definition into the model's context at connect, before the customer
 * has asked for anything, so the roster's shape is a permanent tax on whatever
 * seat this is plugged into. Measured: one tool per agent costs about 9,015
 * tokens at connect, against 735 for this shape. The sibling product learned the
 * same lesson expensively when a single tool returned a whole corpus and cost
 * ~15,800 tokens per call, which "priced the prevention half of this product out
 * of the loop it exists for".
 *
 * So there are seven tools, the agents are PROMPTS that a host fetches only when
 * invoked, and `list_agents` returns one line per agent on request. Nothing is
 * hidden by that: the full membership list is one call away and every response
 * says so.
 */
import { loadCorpus } from "../corpus/load.mjs";
import * as seoOnpage from "../corpus/seo-onpage.mjs";
import * as accessibility from "../corpus/accessibility.mjs";
import * as formsAndCapture from "../corpus/forms-and-capture.mjs";
import * as claimsOfficer from "../corpus/claims-officer.mjs";
import { assess } from "../report/run.mjs";
import { factsFromFile, TargetError } from "./dom.mjs";
import { TIERS } from "../licence/roster.mjs";

/**
 * Corpora this server can run. Three of tier-1's twelve today.
 *
 * The map is agent id to corpus module, and both sides are named so a mismatch
 * is visible rather than implied. A department NOT in here is registered as a
 * prompt and reported as brief-only, which is the honest state: it can advise
 * and it cannot produce a citation.
 */
const CORPORA = {
  "seo-onpage": seoOnpage,
  accessibility,
  "forms-and-capture": formsAndCapture,
  "claims-officer": claimsOfficer,
};

/**
 * Which agents are backed by a corpus that exists right now.
 *
 * Derived from CORPORA rather than written out, because two hand-maintained
 * lists of the same fact is the defect this house names most often, and there
 * would be nothing comparing them.
 */
export const AGENTS_WITH_CORPUS = Object.fromEntries(Object.keys(CORPORA).map((id) => [id, id]));

/**
 * One line per agent. Text rather than JSON objects on purpose: the sibling
 * product measured 5,176 tokens for ninety small objects against 2,753 for the
 * same list as lines, because objects spend two thirds of their bytes repeating
 * key names.
 */
export function listAgents(agents) {
  if (agents.length === 0) {
    return {
      count: 0,
      note:
        "No departments are available on this licence. That is either an expired licence or a " +
        "mistake on our side; run licence_status, which says which.",
      index: "",
    };
  }
  const lines = agents.map((a) => {
    const backed = AGENTS_WITH_CORPUS[a.id] ? "ready" : "brief-only";
    return `${a.id}\t${a.kind}\t${backed}\t${a.blurb}`;
  });
  return {
    count: agents.length,
    indexFormat: "id \\t kind (D deterministic, A advisory) \\t state \\t what it covers",
    index: lines.join("\n"),
    /*
     * NOTHING IS LOST, IT MOVED. Every response says what is one call away, so a
     * model that read only the index knows the rest is retrievable rather than
     * absent. Inherited verbatim as a principle from the sibling fix.
     */
    retrieval:
      "get_brief with an id returns that department's full brief. run_check with an id and a file " +
      "runs it. describe_rulebook returns every rule with the case where it is wrong.",
    honest:
      "A department marked brief-only has no rulebook behind it yet, so it can advise but it cannot " +
      "produce a citation. Only the ones marked ready can.",
  };
}

/** The brief for one agent, fetched on demand rather than loaded at connect. */
export function getBrief(agents, id) {
  const agent = agents.find((a) => a.id === id);
  if (!agent) {
    return {
      error: `no department called "${id}" on this licence`,
      available: agents.map((a) => a.id),
    };
  }
  const backed = Boolean(AGENTS_WITH_CORPUS[agent.id]);
  return {
    id: agent.id,
    kind: agent.kind === "D" ? "deterministic" : "advisory",
    covers: agent.blurb,
    state: backed ? "ready" : "brief-only",
    howToRun: backed
      ? `run_check with { agent: "${agent.id}", file: "<path to a built .html file>" }`
      : "This department has no rulebook yet, so there is nothing to run. It can still advise.",
    contract: backed
      ? "Every finding cites the element it looked at and carries the condition under which the " +
        "rule is WRONG. When too little of the page can be read, the result is withheld rather " +
        "than reported as clean."
      : "Advisory only. Nothing it says is a measurement, and it will not produce a citation.",
  };
}

/**
 * Run a department's rulebook against a local file.
 *
 * NO NETWORK, and that is the promise on the privacy page rather than a
 * preference: this reads a file on the customer's machine and makes no request
 * of any kind.
 */
export function runCheck(agents, { agent: agentId, file }) {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    return { error: `no department called "${agentId}" on this licence`, available: agents.map((a) => a.id) };
  }
  const corpusName = AGENTS_WITH_CORPUS[agentId];
  if (!corpusName) {
    return {
      error: `${agentId} has no rulebook yet, so there is nothing to run`,
      ready: Object.keys(AGENTS_WITH_CORPUS).filter((id) => agents.some((a) => a.id === id)),
    };
  }

  const corpus = loadCorpus(CORPORA[corpusName]);
  let facts;
  try {
    facts = factsFromFile(file, corpus.collect);
  } catch (err) {
    if (err instanceof TargetError) return { error: err.message };
    throw err;
  }

  const report = assess(corpus, facts);
  return {
    ...report,
    /*
     * Said on every response rather than in documentation, because the reader is
     * a model relaying to a person and this is the sentence that makes the result
     * actionable rather than authoritative.
     */
    howToRead:
      report.status === "assessed"
        ? "Every finding names the element it looked at, so it can be verified rather than trusted. " +
          "Each carries the condition under which that rule is WRONG: read it before acting."
        : "This result is WITHHELD. The abstention says why. Nothing here should be presented as a " +
          "clean page.",
    noNetwork: "This ran against a local file and made no network request.",
  };
}

/** The rulebook, published, so a finding can be argued with. */
export function describeRulebook(agents, id) {
  const corpusName = AGENTS_WITH_CORPUS[id];
  if (!corpusName || !agents.some((a) => a.id === id)) {
    return { error: `no rulebook for "${id}" on this licence`, withRulebooks: Object.keys(AGENTS_WITH_CORPUS) };
  }
  const corpus = loadCorpus(CORPORA[corpusName]);
  return {
    rulebook: corpus.id,
    version: corpus.version,
    count: corpus.rules.length,
    rules: corpus.rules.map((r) => ({
      id: r.id,
      title: r.title,
      family: r.family,
      severity: r.severity,
      weight: r.weight,
      why: r.rationale,
      fix: r.prevention,
      wrongWhen: r.falsePositiveNote,
    })),
    cannotSee: [
      "Anything needing a network request, because this makes none.",
      "Anything about search results. No rule claims a ranking effect and none may.",
      "Whether the writing is good. That is judgement, not measurement.",
      "Content rendered after the page settles, which is why a thin page is withheld.",
    ],
  };
}

/**
 * Manual remedies for a set of findings.
 *
 * IT PROPOSES NOTHING APPLICABLE, and that is a rule rather than a limitation of
 * effort. The sibling product's contract: only a deterministic read may propose
 * an applicable patch, and where a detector abstains from certainty its fix may
 * only be manual. These rules read a parsed document and cannot know which of
 * several files produced an element, so an automatic edit would be a guess
 * applied to somebody's site.
 */
export function proposeFixes(agents, { agent: agentId, ruleIds }) {
  const corpusName = AGENTS_WITH_CORPUS[agentId];
  if (!corpusName || !agents.some((a) => a.id === agentId)) {
    return { error: `no rulebook for "${agentId}" on this licence` };
  }
  const corpus = loadCorpus(CORPORA[corpusName]);
  const wanted = Array.isArray(ruleIds) && ruleIds.length ? ruleIds : null;
  const rules = wanted ? corpus.rules.filter((r) => wanted.includes(r.id)) : corpus.rules;
  const unknown = wanted ? wanted.filter((id) => !corpus.rules.some((r) => r.id === id)) : [];

  return {
    kind: "manual",
    why:
      "Every remedy here is manual on purpose. These rules read a rendered document and cannot know " +
      "which source file produced an element, so an automatic edit would be a guess applied to your " +
      "site. You or your assistant makes the change.",
    unknownRuleIds: unknown,
    remedies: rules.map((r) => ({
      ruleId: r.id,
      change: r.prevention,
      // The rebuttal travels attached to the fix, so nobody edits their site on
      // the strength of a rule that was wrong about them.
      doNotIfThisIsYou: r.falsePositiveNote,
    })),
  };
}

/**
 * What the licence says, in the words a customer needs.
 *
 * PROMISED ON THE WELCOME PAGE, which tells a paying customer to run this and
 * says it answers with the plan, the expiry, the department count and the words
 * "verified offline, no network request was made". So this is a published
 * contract and the wording matters.
 */
export function licenceStatus({ licence, agents, status, unknown }) {
  if (!licence.valid) {
    return {
      ok: false,
      problem: licence.reason,
      departments: 0,
      whatToDo:
        "This licence is not usable. The reason above says which: an expired one needs renewing, " +
        "and anything else is worth sending to us because it is probably our mistake.",
      verifiedOffline: true,
    };
  }
  const tierNames = Object.entries(TIERS)
    .filter(([, ids]) => ids.some((id) => agents.some((a) => a.id === id)))
    .map(([tier]) => tier);

  return {
    ok: true,
    customer: licence.customer,
    expires: licence.expires,
    departments: agents.length,
    ready: agents.filter((a) => AGENTS_WITH_CORPUS[a.id]).map((a) => a.id),
    briefOnly: agents.filter((a) => !AGENTS_WITH_CORPUS[a.id]).length,
    tiers: tierNames,
    // Both of these are the honest states and both are visible rather than
    // silent, because slash commands disappearing at midnight is the worst
    // possible way to learn a card expired.
    grace: licence.grace
      ? `EXPIRED ${licence.grace.daysPastExpiry} day(s) ago and running on grace until ` +
        `${licence.grace.endsAt}. Renew to keep it working.`
      : null,
    expiringSoon: licence.expiringSoon ? `${licence.expiringSoon.daysLeft} day(s) left.` : null,
    entitlesNothing:
      status === "entitles-nothing"
        ? `This licence names ${unknown.join(", ")}, which this build does not provide. That is our ` +
          `mistake rather than yours: send this to us.`
        : null,
    message: "verified offline, no network request was made",
  };
}
