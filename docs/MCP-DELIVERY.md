# How the team gets delivered: one MCP server, any LLM seat

Status: the licence layer is BUILT and tested. The MCP server itself is not written yet. Every
number below is measured, and the two places this is still a plan say so.

The customer buys, gets a licence token and an install line, pastes the line into whichever LLM seat
they already use, and their model gains the team as tools it can call. Nothing about their business
leaves their machine to make that work, and that is verifiable rather than promised.

---

## 1. Why sixty agents are not sixty tools

An MCP host loads every TOOL definition into the model's context at connect time, before the
customer has asked for anything. So the roster's shape is a fixed tax on every conversation in the
seat we plug into.

The sibling product already paid for this lesson: an MCP tool that returned the whole corpus cost
roughly 15,800 tokens per call and, in the words of the commit that fixed it, "priced the prevention
half of this product out of the loop it exists for". The fix was measured, not argued.

Measured here by `npm run mcp:shape`, which parses the real roster out
of `AGENT-ROSTER-PLAN.md` rather than using a made-up list:

| Shape | Cost at connect | When it is paid |
|---|---|---|
| A. 60 tools, one per agent | **~8,617 tokens** | every conversation, before any request |
| B. 60 prompt listings + fixed tools | ~3,319 tokens | every conversation |
| C. fixed tools only, agents as prompts, index on request | **~735 tokens** | every conversation |

**Shape C, and it is 11.7x cheaper than the obvious one.** Estimated at 4 characters per token; the
divisor is approximate and the ratio is not.

So the server exposes:

- **A small fixed tool set** (7 tools: `run_agent`, `list_agents`, `get_brief`, `propose_fixes`,
  `verify_fix`, `licence_status`, `describe_corpus`). This is the whole connect-time cost.
- **Sixty MCP prompts**, one per agent. Hosts fetch a prompt body only when somebody invokes it, and
  they surface as slash commands, which is exactly the interaction the founder described: "run the
  improvement agent over this product".
- **Resources** for the corpora and for the client's own accumulating learnings file.

Nothing is hidden by this. `list_agents` returns the complete membership list, one line per agent,
and every tool response carries a `retrieval` field saying what is one call away. That property is
inherited deliberately from the sibling fix, whose commit message insists on it: nothing is lost, it
moved.

A budget gate holds the line at 1,200 tokens. If the connect cost ever crosses it the roster has
started taxing the seat it lives in, and that is a finding rather than a slow decline nobody notices.

---

## 2. Why the licence is verified offline, and why that is the pitch

The deterministic foundation forbids network egress as a code invariant. Its gate enumerates every
call site with a written reason across 273 files, fails closed, and bans "update checks" by name.
A licence that phones home would break a privacy guarantee that is a PRODUCT claim, on the one
package that runs inside somebody else's repository.

So a licence is a signed token, verified locally against a public key compiled into the server:

```
proof1.<base64url payload>.<base64url Ed25519 signature>
```

`node:crypto` does Ed25519 natively, so this adds no dependency and makes no request. The server a
customer installs performs **zero** network calls, and they can confirm that themselves by reading
it, which is a better sentence than any promise about privacy.

**The honest cost of offline, stated rather than discovered:** revocation is not immediate. A valid
token stays valid until it expires. That is priced in with a short window and renewal, and the
renewal is a token the billing system delivers, not a call the server makes.

### The five ways this could have reported success without doing its job

All five are real defects that have shipped in real products. `licence/verify.mjs` names each one at
the line that prevents it.

1. **Verifying a re-serialised payload** instead of the bytes that arrived. If you parse, re-encode,
   then check the signature over the re-encoding, the attacker owns the difference between what was
   verified and what gets read. The signature is checked over the exact received bytes, before
   anything parses them. **The test that proves it is the one that matters most:** a payload
   re-encoded with two spaces of indentation, same signature, semantically identical, must be
   refused. No other test in the suite tells a correct verifier from a broken one.
2. **Reading the algorithm from the token.** The classic JWT break. There is no algorithm field;
   Ed25519 is implied by the key type and a token claiming otherwise is not expressible.
3. **A catch that swallows the failure.** Found by mutation, and it was the only survivor of five:
   replacing the catch's refusal with a pass left all fourteen tests green, because none of them
   reached the try block. A sixteenth test now drives a corrupt issuer key into it. **A misconfigured
   deploy is a far more likely way to reach that line than an attacker is**, and failing open there
   hands out free licences.
4. **Checking the signature but not the expiry,** or the reverse. Both, in that order, because a
   forged token should report forgery rather than inviting a renewal.
5. **Being a function nobody calls.** The worst and least visible. There is deliberately no
   `checkLicence()` for a tool handler to remember. `licence/roster.mjs` returns the agents that
   EXIST for this token and the server registers exactly those, so an unentitled agent is absent
   rather than present and refused. There is no per-call check to forget.

An unconfigured build, with no issuer key pasted in, entitles nobody and says which line to fix.

### The signing path cannot reach the customer

`licence/issue.mjs` holds the private-key path. `npm run licence:boundary` fails the build if any
file outside a named allowlist imports it, and will walk the MCP server's import graph once that
entry point exists. It also fails on a STALE allowlist entry, because a stale exemption is a hole
waiting for a filename to be reused.

This is a gate rather than a comment because the sibling product's published bundle once contained
its entire private pipeline: three hops deep through a barrel, absent from the manifest, visible only
in the bundler's graph. A boundary expressed only in a dependency list is not enforced.

Today the check reports honestly that `SHIPPING_ENTRIES` is empty, because the MCP package does not
exist yet. It prints that rather than a green tick, because a graph check over zero entry points is
the shape of a gate that scans nothing and reports success.

---

## 3. What the customer does, in full

Written out because "we grant the steps on installation" is the moment the purchase either works or
generates a support thread.

**After checkout they get one screen and one email**, both carrying the same two things: their
licence token, and the block below with their token already substituted in.

### Claude Code

```sh
claude mcp add proof --env PROOF_LICENCE=<token> -- npx -y github:Yuve21/proof-team-mcp
```

### Cursor, Windsurf, Codex, and anything else speaking MCP

`~/.cursor/mcp.json`, or the equivalent for the seat:

```json
{
  "mcpServers": {
    "proof": {
      "command": "npx",
      "args": ["-y", "github:Yuve21/proof-team-mcp"],
      "env": { "PROOF_LICENCE": "proof1...." }
    }
  }
}
```

### Then, to confirm it worked

Ask the seat to run `licence_status`. It answers with the customer id, the expiry date, the number of
agents registered, and the sentence "verified offline, no network request was made". If the token is
missing or expired it says which, in those words, because "it does not work" is the least useful
error a paying customer can receive.

**Three properties of this install worth keeping:**

- **The token goes in an env var, never in a file we ask them to edit by hand.** A token pasted into
  a tracked config file ends up in their git history.
- **`npx -y` means no global install and no version pinning problem.** Same shape as the sibling
  product's public install, which is already proven to work as a one-liner.
- **An unlicensed install is a legible state, not a broken one.** The server starts, registers no
  agents, and exposes exactly one tool that explains why and how to fix it.

---

## 4. The decision this raises, and it is a real one

The sibling detector publishes its entire corpus, deliberately and permanently, because a detector
nobody can audit is a detector nobody should believe. Auditability beats evasion resistance there.

**That argument does not transfer cleanly to a marketing playbook.** For the detector, the corpus IS
the credibility. For the SEO and Reach departments, the corpus is closer to the inventory. Publishing
104 detection rules invites scrutiny that makes the product better; publishing 31 domain corpora
hands a competitor the thing they would otherwise have to write.

The likely split, and it is a founder decision rather than an engineering one:

- **`template-tells` keeps publishing everything**, because it is the sibling corpus and its whole
  value is that a stranger can check it.
- **The deterministic seats publish their RULE LIST and their false-positive notes**, because a
  finding a customer cannot audit is a finding they should not act on, and because the false-positive
  note is what makes the agent read as senior.
- **The advisory playbooks stay private.** They are judgement, not measurement, and nothing about
  them is verifiable by a reader anyway.

Not settled. Written down so it gets decided once, on purpose, rather than by whoever writes the
first corpus.
