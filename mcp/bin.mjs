#!/usr/bin/env node
/**
 * The Proof MCP server. This is the thing a customer installs.
 *
 * READ IT AS CODE A STRANGER WILL READ, because that is exactly what it is: it
 * runs inside somebody else's assistant, on their machine, against their files.
 *
 * THREE PROPERTIES, each of which is a published promise rather than a taste
 * decision, so each is enforced here rather than documented elsewhere.
 *
 * 1. NO NETWORK REQUESTS, AT ALL. The privacy page says the software a customer
 *    installs "makes no network requests of any kind", and the licence is
 *    verified offline precisely so that stays true. There is no fetch in this
 *    server, no telemetry, no update check and no licence call home. The one
 *    dependency that could have broken it, a browser to parse HTML, was rejected
 *    for a local parser. A stranger can confirm all of that by grepping this
 *    directory, which is the point of saying it here.
 *
 * 2. AN UNENTITLED DEPARTMENT IS ABSENT, NOT REFUSED. The server registers
 *    exactly the prompts the licence entitles. There is no per-call check to
 *    forget, because there is nothing to check: the agent does not exist. That is
 *    deliberate, and it is the answer to the oldest defect in the sibling
 *    product, a function carrying fourteen guards that no shipping path calls.
 *
 * 3. AN UNLICENSED INSTALL IS LEGIBLE, NOT BROKEN. With no licence the server
 *    still starts, registers no departments, and exposes one tool that explains
 *    why and what to do. A server that fails to boot tells the customer nothing
 *    except that we are unreliable.
 *
 * THE TOKEN BUDGET. Seven tools, and the departments are PROMPTS a host fetches
 * only on invoke. Measured at 735 tokens at connect against about 9,015 for one
 * tool per agent. That is not a micro-optimisation: it is a fixed tax on every
 * conversation in the seat this is plugged into.
 */
import { readFileSync, existsSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registrable } from "../licence/roster.mjs";
import {
  listAgents,
  getBrief,
  runCheck,
  describeRulebook,
  proposeFixes,
  licenceStatus,
  AGENTS_WITH_CORPUS,
} from "./tools.mjs";

/**
 * Read the licence from the environment, or from a FILE the environment points
 * at.
 *
 * The file form exists because of how renewal actually goes. A token baked into
 * a host config means renewing is "edit mcp.json or re-run claude mcp add" every
 * cycle, and a token in a tracked file ends up in the customer's git history.
 * With PROOF_LICENCE_FILE, renewing is "save the new token over the old file".
 */
function readLicence() {
  const file = process.env.PROOF_LICENCE_FILE;
  if (file) {
    if (!existsSync(file)) {
      return { token: "", note: `PROOF_LICENCE_FILE points at ${file}, which does not exist` };
    }
    try {
      return { token: readFileSync(file, "utf8").trim(), note: null };
    } catch (err) {
      return { token: "", note: `could not read ${file}: ${err.message}` };
    }
  }
  return { token: process.env.PROOF_LICENCE || "", note: null };
}

const json = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });

async function main() {
  const { token, note } = readLicence();

  /*
   * The registry is built FROM the licence. Everything below registers what this
   * returns and nothing else, which is what makes the entitlement unbypassable
   * by construction rather than by remembering to check.
   */
  const { agents, licence, unknown, status } = registrable(token, {
    planPath: new URL("../docs/AGENT-ROSTER-PLAN.md", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  });

  const server = new McpServer(
    { name: "proof", version: "0.1.0" },
    {
      instructions:
        agents.length > 0
          ? `Proof gives this seat ${agents.length} business departments, of which ` +
            `${agents.filter((a) => AGENTS_WITH_CORPUS[a.id]).length} can run a real check against a ` +
            `local file. Start with list_agents. Every finding cites the element it looked at and ` +
            `carries the case where the rule is wrong, so relay both. Nothing here predicts a search ` +
            `ranking and no claim of that kind may be made from its output. This server makes no ` +
            `network requests.`
          : `Proof is installed but no departments are licensed. Call licence_status, which says why ` +
            `in one sentence, and relay that sentence rather than guessing.`,
    },
  );

  // --- always available, because the unlicensed case has to be legible --------
  server.registerTool(
    "licence_status",
    {
      title: "Check the Proof licence",
      description:
        "What this licence entitles, when it expires, how many departments are available, and whether " +
        "anything is wrong with it. Answer this before concluding that a department is missing.",
      inputSchema: {},
    },
    async () => json({ ...licenceStatus({ licence, agents, status, unknown }), licenceSource: note ?? undefined }),
  );

  if (agents.length === 0) {
    /*
     * The legible-failure path. One tool, no departments, and a message that says
     * what to do. Registering the other six here would give a model six things to
     * try that all refuse, which is worse than one thing that explains.
     *
     * THE PROMPT BELOW IS NOT COSMETIC, and I claimed this path was legible
     * before it was. Measured with a real MCP client: with zero prompts
     * registered the SDK never advertises the prompts capability, so a host
     * calling `prompts/list` gets `-32601 Method not found`. A host showing that
     * to a customer reports a BROKEN server, which is the opposite of the
     * property this branch exists to provide. One prompt fixes the protocol
     * answer and, better, gives the customer a slash command that explains the
     * problem instead of a silence they have to interpret.
     */
    server.registerPrompt(
      "proof-not-licensed",
      {
        title: "Why Proof has no departments",
        description: "Explains what is wrong with this licence and what to do about it.",
        argsSchema: {},
      },
      () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "Proof is installed but no departments are licensed.",
                "",
                "Call the licence_status tool and relay its `problem` field VERBATIM. It says which",
                "of these it is, and they need different actions:",
                "",
                "  - no licence supplied: the PROOF_LICENCE environment variable is not set",
                "  - expired: it needs renewing, and the message says when it ran out",
                "  - not issued by us, or an untrusted key: the token is wrong or was mistyped",
                "  - licensed but entitles nothing: our mistake, and they should contact us",
                "",
                "Do not guess between them and do not suggest reinstalling. The tool already knows.",
              ].join(String.fromCharCode(10)),
            },
          },
        ],
      }),
    );
    await server.connect(new StdioServerTransport());
    return;
  }

  server.registerTool(
    "list_agents",
    {
      title: "List the available departments",
      description:
        "One line per department: its id, whether it is deterministic or advisory, whether it has a " +
        "rulebook behind it yet, and what it covers. Cheap on purpose. Call this first.",
      inputSchema: {},
    },
    async () => json(listAgents(agents)),
  );

  server.registerTool(
    "get_brief",
    {
      title: "Read one department's brief",
      description:
        "The full brief for one department, fetched on demand so the whole roster is not loaded into " +
        "context at connect.",
      inputSchema: { agent: z.string().describe("A department id from list_agents.") },
    },
    async ({ agent }) => json(getBrief(agents, agent)),
  );

  server.registerTool(
    "run_check",
    {
      title: "Run a department's rulebook against a local page",
      description:
        "Checks a LOCAL HTML file, usually the built output of a page. Returns findings that each name " +
        "the element they looked at, plus the condition under which that rule is wrong. Withholds the " +
        "result when too little of the page can be read, rather than reporting it as clean. Makes no " +
        "network request: it cannot check a URL, and that is deliberate.",
      inputSchema: {
        agent: z.string().describe("A department id that list_agents marks 'ready'."),
        file: z.string().describe("Path to an .html file on this machine."),
      },
    },
    async ({ agent, file }) => json(runCheck(agents, { agent, file })),
  );

  server.registerTool(
    "describe_rulebook",
    {
      title: "Read every rule a department checks",
      description:
        "The whole rulebook for one department, each rule with why it matters, what to change, and " +
        "the case where the rule gives the wrong answer. Also what the rulebook cannot see. Use it to " +
        "decide whether a finding applies before acting on it.",
      inputSchema: { agent: z.string().describe("A department id with a rulebook.") },
    },
    async ({ agent }) => json(describeRulebook(agents, agent)),
  );

  server.registerTool(
    "propose_fixes",
    {
      title: "Get the remedy for findings",
      description:
        "What to change for each rule, with the rebuttal attached. Every remedy is MANUAL: these rules " +
        "read a rendered page and cannot know which source file produced an element, so nothing here " +
        "is an automatic edit and none should be applied without reading the rebuttal.",
      inputSchema: {
        agent: z.string().describe("A department id with a rulebook."),
        ruleIds: z.array(z.string()).optional().describe("Rule ids from a run_check result. Omit for all."),
      },
    },
    async ({ agent, ruleIds }) => json(proposeFixes(agents, { agent, ruleIds })),
  );

  server.registerTool(
    "verify_fix",
    {
      title: "Re-run a check and report what changed",
      description:
        "Runs the same rulebook again and reports which findings went away and which APPEARED. A " +
        "finding that appears is stated first and marked a regression, because a fix that breaks " +
        "something else is not a fix.",
      inputSchema: {
        agent: z.string().describe("A department id with a rulebook."),
        file: z.string().describe("Path to the .html file, rebuilt after your change."),
        before: z.array(z.string()).describe("The rule ids from the run_check you are comparing against."),
      },
    },
    async ({ agent, file, before }) => {
      const after = runCheck(agents, { agent, file });
      if (after.error) return json(after);
      const nowFiring = (after.findings || []).map((f) => f.ruleId);
      const appeared = nowFiring.filter((id) => !before.includes(id));
      const resolved = before.filter((id) => !nowFiring.includes(id));
      return json({
        // Regressions first, always. A fix that breaks something else is not a fix.
        regression: appeared.length > 0,
        appeared,
        resolved,
        stillFiring: nowFiring.filter((id) => before.includes(id)),
        status: after.status,
        note:
          appeared.length > 0
            ? "Something new is firing that was not before. Look at that before celebrating the rest."
            : "Nothing new fired.",
      });
    },
  );

  // --- the departments, as PROMPTS ------------------------------------------
  /*
   * A prompt per entitled department. Hosts surface these as slash commands and
   * fetch the body only when somebody invokes one, which is why the roster costs
   * nothing at connect. This is the whole reason the shape was chosen.
   */
  for (const agent of agents) {
    const backed = Boolean(AGENTS_WITH_CORPUS[agent.id]);
    server.registerPrompt(
      agent.id,
      {
        title: `Run the ${agent.id} department`,
        description: agent.blurb,
        argsSchema: { target: z.string().optional().describe("A local .html file to check.") },
      },
      ({ target }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: backed
                ? [
                    `Act as the ${agent.id} department. It covers: ${agent.blurb}`,
                    "",
                    target
                      ? `Run run_check with agent "${agent.id}" and file "${target}".`
                      : `Ask which local .html file to check, then run run_check with agent "${agent.id}".`,
                    "",
                    "Then, for every finding: relay the element it named, what to change, AND the",
                    "condition under which that rule is wrong. Do not drop the last one. A finding",
                    "whose rebuttal describes this business is a finding to ignore, and the person",
                    "reading this is the only one who can tell.",
                    "",
                    "If the result is withheld, say so and say why. Do not summarise a withheld",
                    "result as a clean page. Never turn any of this into a claim about search",
                    "rankings or traffic: no rule here measures those.",
                  ].join("\n")
                : [
                    `Act as the ${agent.id} department. It covers: ${agent.blurb}`,
                    "",
                    "This department has NO rulebook behind it yet, so it cannot produce a citation",
                    "and nothing it says is a measurement. Say that once, plainly, before advising.",
                    "",
                    "Give concrete advice for this specific business rather than general best",
                    "practice, and where you are guessing, say you are guessing.",
                  ].join("\n"),
            },
          },
        ],
      }),
    );
  }

  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  // stderr, never stdout: stdout is the protocol channel and writing prose to it
  // corrupts the session rather than reporting an error.
  process.stderr.write(`proof mcp failed to start: ${err?.message}\n`);
  process.exit(1);
});
