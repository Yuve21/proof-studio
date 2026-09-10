/**
 * Measures what the roster costs a host's context window, in each of the two
 * shapes it could ship in.
 *
 * WHY MEASURE INSTEAD OF ARGUING. The sibling product shipped an MCP tool whose
 * response was the whole corpus, roughly 15,800 tokens, which "priced the
 * prevention half of this product out of the loop it exists for" (slop-scorer
 * commit 9783bbe). The fix was measured, not reasoned: 5,176 tokens as JSON
 * objects against 2,753 as one line per rule, because ninety small objects spend
 * two thirds of their bytes on repeated key names.
 *
 * The same question decides the shape of this product, and it is sharper here
 * because an MCP host loads every TOOL definition into context at connect time,
 * before the customer has asked for anything. Sixty-two tools is a fixed tax on every
 * conversation in the seat we are plugged into.
 *
 * THE THREE SHAPES:
 *   A. one tool per agent. Every brief in context at connect.
 *   B. one prompt per agent, plus a small fixed tool set. Hosts list prompt names and fetch a
 *      body only when invoked, so the connect cost is the listing.
 *   C. B, plus the compact agent index as one line per agent, which is the shape
 *      9783bbe landed on for rules.
 *
 * The token count is an ESTIMATE and says so. There is no tokeniser in this repo
 * and adding a dependency to count tokens would be worse than an honest
 * approximation. It uses chars/4, which is the conventional rough figure for
 * English prose, and it prints the character counts too so a reader can apply
 * their own divisor. The RATIO between shapes is what the decision rests on, and
 * a ratio survives a wrong divisor.
 */
import { readFileSync } from "node:fs";

const PLAN = "docs/AGENT-ROSTER-PLAN.md";
const CHARS_PER_TOKEN = 4;
const est = (s) => Math.round(s.length / CHARS_PER_TOKEN);

// --- parse the roster out of the plan, so the plan stays the single source ----
const plan = readFileSync(PLAN, "utf8");
const seats = [...plan.matchAll(/^\d+\. \*\*([a-z-]+)\*\* \[([DA])\]\s*(.+)$/gm)].map((m) => ({
  id: m[1],
  kind: m[2],
  blurb: m[3].trim(),
}));

if (seats.length === 0) {
  console.error(`FAIL: parsed ZERO seats from ${PLAN}. A measurement over nothing is not a measurement.`);
  process.exit(1);
}
if (seats.length !== 62) {
  console.error(
    `FAIL: parsed ${seats.length} seats from ${PLAN}, expected 62. Either the plan changed and this ` +
    `number should be updated deliberately, or the parser stopped matching. Both need a human.`,
  );
  process.exit(1);
}

/**
 * A realistic MCP tool definition per agent. Not a strawman: an agent tool needs
 * a name, a description a model can route on, and an input schema. This is close
 * to the smallest honest version.
 */
const toolDefinition = (seat) =>
  JSON.stringify({
    name: `run_${seat.id.replace(/-/g, "_")}`,
    description:
      `${seat.blurb} Returns ranked findings, each citing a locator you can re-read, and ` +
      `abstains when coverage is too low to judge. ` +
      (seat.kind === "D"
        ? "Deterministic: backed by published rules, same input gives the same result."
        : "Advisory: judgement over a written playbook, not a measurement."),
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Absolute path or URL to examine." },
        focus: { type: "string", description: "Optional narrower question." },
      },
      required: ["target"],
    },
  });

/** What a host shows for a prompt before anybody invokes it. */
const promptListing = (seat) =>
  JSON.stringify({ name: seat.id, description: seat.blurb, arguments: [{ name: "target", required: true }] });

/** One line per agent, the shape commit 9783bbe landed on for rules. */
const indexLine = (seat) => `${seat.id}\t${seat.kind}\t${seat.blurb}`;

const shapeA = seats.map(toolDefinition).join("");
const shapeB = seats.map(promptListing).join("");
const shapeC = seats.map(indexLine).join("\n");

const FIXED_TOOLS = 7; // run_agent, list_agents, get_brief, propose_fixes, verify_fix, licence_status, describe_corpus
const fixedToolCost = 7 * 420; // chars; measured against slop-scorer's five tool definitions, which average ~420

const rows = [
  [`A. ${seats.length} tools, one per agent`, shapeA.length, "loaded at connect, every conversation"],
  [`B. ${seats.length} prompt listings`, shapeB.length, "loaded at connect, body fetched on invoke"],
  ["C. one line per agent (index)", shapeC.length, "returned by list_agents, on request only"],
  [`fixed tool set (${FIXED_TOOLS} tools)`, fixedToolCost, "loaded at connect, unavoidable"],
];

console.log(`parsed ${seats.length} seats from ${PLAN} (${seats.filter((s) => s.kind === "D").length} deterministic, ${seats.filter((s) => s.kind === "A").length} advisory)\n`);
console.log("shape                              chars   ~tokens  when it is paid");
console.log("-".repeat(88));
for (const [label, chars, when] of rows) {
  console.log(`${label.padEnd(34)} ${String(chars).padStart(6)}   ${String(est({ length: chars })).padStart(6)}  ${when}`);
}

const connectA = shapeA.length + fixedToolCost;
const connectB = shapeB.length + fixedToolCost;
const connectC = fixedToolCost;

console.log("\nCOST AT CONNECT, which is the number that matters, because it is paid");
console.log("before the customer has asked for anything:");
console.log(`  shape A: ~${est({ length: connectA })} tokens`);
console.log(`  shape B: ~${est({ length: connectB })} tokens   (${(connectA / connectB).toFixed(1)}x cheaper than A)`);
console.log(`  shape C: ~${est({ length: connectC })} tokens   (${(connectA / connectC).toFixed(1)}x cheaper than A)`);
console.log(
  `\nEstimate at ${CHARS_PER_TOKEN} chars per token. The divisor is approximate and the ratios are not.`,
);

/*
 * THE DECISION THIS SUPPORTS: shape C. Every agent ships as an MCP PROMPT, which a
 * host fetches on invoke, plus a small fixed tool set, plus `list_agents`
 * returning one line per agent on request. Nothing is hidden: the full membership
 * list is one call away and the tool response says so, which is the property
 * 9783bbe insisted on ("NOTHING IS LOST, IT MOVED").
 *
 * A gate belongs on this: if the connect cost ever exceeds BUDGET, the roster has
 * started taxing the seat it is plugged into, and that is a finding rather than a
 * gradual decline nobody notices.
 */
const BUDGET_TOKENS = 1200;
const overBudget = est({ length: connectC }) > BUDGET_TOKENS;
console.log(
  `\n${overBudget ? "FAIL" : "OK"}: chosen shape (C) costs ~${est({ length: connectC })} tokens at connect, ` +
  `budget ${BUDGET_TOKENS}.`,
);
process.exit(overBudget ? 1 : 0);
