# The seat card: what a roster entry has to declare before it is a seat

Status: SPEC, 2026-09-11. Written against `docs/AGENT-ROSTER-PLAN.md`, which argues the COUNT.
This argues the SHAPE. Sources are two published systems, read frame by frame rather than from
their captions, and named here so a reader can go and disagree with them:

- **SkillTree** (`skilltree.altari.ai/map`, via `instagram.com/reels/DbYh2P-MQnj`) — 137 agents
  drawn as one radial map, seven departments, every node opening a card with a fixed schema.
- **Structure Networks, "the one-person marketing team"**
  (`instagram.com/reels/DdAjeQKMC4o`) — the same idea drawn as a LAYERED diagram rather than a
  radial one, with a panel of interrupts beside it.

Neither is being copied. Both are doing one thing this roster does not do yet, and it is the same
thing: **they make a seat declare its edges and its stopping condition, in the artifact itself.**

---

## Why this exists: the loop problem is a missing field

An audit seat with no declared stopping condition does not stop. It returns findings, the findings
become work, the work produces a surface to audit, and the next run finds more. That is not the
agent misbehaving. It is the brief never saying what "done" is, so "more" is always the correct
answer.

The house already has the evidence: a sibling repo's daily auditor is instructed that a run
"NEVER comes back empty", and improvements are declared "legitimately unlimited". Given that
instruction, an infinite backlog is the *correct* output. The fix is not to tell an agent to find
less. It is to give the seat a field where the end is written down.

Both sources solve it, differently and compatibly:

- SkillTree writes **THE LADDER** and **THE HUMAN** on every card: three named autonomy rungs, and
  the sentence naming what a person still owns.
- Structure draws **WHAT INTERRUPTS THE LOOP** as its own panel, beside the departments, with the
  interrupts enumerated as tiles rather than buried in prose.

So: three new required fields, below.

---

## The seat card

Every roster entry carries these. A seat missing a required field is a prompt with a job title on
it, which is the failure this company sells the detection of.

### Identity

| Field | Required | Notes |
|---|---|---|
| `name` | yes | the seat, e.g. `seo-technical` |
| `department` | yes | one of the eight |
| `kind` | yes | `[D]` deterministic or `[A]` advisory. Already in the plan. Keep it. |
| `at a glance` | yes | ONE sentence. SkillTree leads every card with this and nothing else. |
| `status` | yes | `idea` / `in development` / `live`. A seat is `live` when its CORPUS exists, per the plan's own rule, not when its brief is written. |

### Edges — the part the roster is missing entirely

| Field | Required | Notes |
|---|---|---|
| `builds on` | yes | upstream seats whose output this one READS. SkillTree's `BUILDS ON`. |
| `breaks into` | no | the sub-skills this decomposes into, if it does. SkillTree's `BREAKS INTO`. |
| `reuses` | yes | the concrete path it checks for existing upstream work before redoing it. SkillTree's cards do this literally: the LinkedIn seat checks `outputs/` for a report from the Prospect Research Analyst before it researches anything. **A seat that cannot say what it reuses will re-derive its inputs on every run, and re-derivation is half of what looks like looping.** |

Sixty seats with no declared edges is sixty seats each re-crawling the same site.

### The autonomy contract

| Field | Required | Notes |
|---|---|---|
| `the ladder` | yes | three rungs, each ONE line of concrete behaviour: `human-led`, `human-assisted`, `fully autonomous`. |
| `the human` | yes | what a person approves and owns, in a sentence. |
| `interrupts` | yes | **the conditions under which this seat stops and hands back.** New, and the point of the document. |

`kind` and `the ladder` are different axes and the plan currently conflates them. A seat can be
deterministic and still require approval before anything ships; a seat can be advisory and still run
unattended because its output is only ever a draft. Mark both.

For the ladder, copy the specificity, not the words. The Structure card for cold email reads:

> **human-led** — One template, first-name token, pray.
> **human-assisted** — The agent writes the full sequence per segment from your offer doc and
> dossiers; a human approves before launch.
> **fully autonomous** — Sequences generate per campaign, A/B variants included, with reply data
> feeding the next round's angles.

Three lines, and you know exactly what you are buying at each rung. Compare that to "advisory".

### `interrupts`, in detail

At least one of each kind, written as a condition a machine could evaluate:

- **A budget.** "Stops at 40 findings" or "one pass per page, no second pass."
- **A ceiling.** "Reports the top N by severity and names the count it suppressed." A seat that
  returns everything it found has delegated triage to the reader.
- **A handback.** The named condition that ends the run and returns to a human: an ambiguity, a
  finding above a severity line, a rule that fired on a page it has already flagged.
- **An expiry.** How long a finding stays valid. Live-state claims (a status, a count, a
  "currently") go stale; the card says how fast.

Structure draws these as tiles: search intent shift, competitor alert, content calendar item,
ranking drop, ad spend, comment/DM load, email opens. Every one is an event that pulls a human in.
Ours are mostly the opposite shape — conditions that push the agent OUT — and both belong on the map.

### Economics and honesty

| Field | Required | Notes |
|---|---|---|
| `what it replaces` | yes | in money and role. SkillTree: "A $60-80k/year SDR's core output, or a $2-4k/month agency retainer that sends the same template to everyone." This is the sales sentence, and a seat that cannot write one is a seat that produces activity. |
| `needs` | yes | dependencies, each marked required or optional, and optional ones stating the degradation: SkillTree writes "Heyreach (optional, degrades gracefully)" and then a paragraph on exactly what still works with no key at all. The plan already does this informally for `broken-things` ("owns half a job rather than claiming the whole one"). Make it a field. |
| `build notes` | yes | the ONE trap that makes this seat produce confident garbage. SkillTree's cold-email card: "Voice is the whole game. The skill reads your offer and tone files before it writes a word, set those up first or you'll get competent generic." |
| `how to run` | yes | the literal invocation lines. |

---

## The knowledge convention, which answers the plan's own open question

`AGENT-ROSTER-PLAN.md` has a table with three rows, and the third — "knowledge of YOUR business" —
is marked **cannot ship on day one**. That is the correct and honest answer, and SkillTree ships a
mechanism for it rather than a claim:

Every seat looks for a `knowledge/` folder in the client's project, by convention:

    knowledge/company.md    company name, description, key differentiators
    knowledge/offer.md      what they sell, ICP, social proof
    knowledge/voice.md      tone, and the profile/brand URLs

**If those files do not exist, the seat asks two or three questions and proceeds. It never blocks on
missing files.** That single rule is what makes per-client knowledge an accumulating asset instead
of an onboarding wall, and it is directly portable: Proof already meets every client at a site it
did not build.

Adopt the convention, adopt the never-block rule, and add one of our own that the sources do not
have: **a seat states which of its findings depend on `knowledge/` and therefore abstain when it is
absent.** This house's whole position is that a detector that cannot read something says so.

---

## The layer stack: what sits above the departments

Structure's diagram is numbered, and the numbering is the argument. Ours has layer 05 and nothing
else:

| Layer | Structure's version | Ours today |
|---|---|---|
| 01 signals | search, competitor, trend, analytics feeds | the URL the client gives us |
| 02 system of record | where findings and state actually live | **missing** |
| 03 orchestrator | the thing that routes work between departments | **missing** |
| 04 knowledge layer + access | `knowledge/` files, plus an explicit ACCESS CONTROL PLANE naming what each seat may touch | **missing** |
| 05 departments | six, feeding each other, "one loop, live" | eight, defined, not yet wired |
| 06 observability | whether the numbers exist at all | partly — the plan's `measurement` seat owns this |

Two of those gaps are load-bearing for a licensed product and should be named as work, not
discovered later:

- **02, the system of record.** Sixty seats writing findings with no shared store is sixty
  reports. The plan's `seo-reporting` seat exists "to stop the department grading its own
  homework", which presumes a store it can read.
- **04, access.** Structure draws the control plane as its own box: what each agent may read,
  write and send. For a product installed on a client's machine with a no-egress promise, that
  box is a compliance artifact, not a diagram flourish.

---

## What to do with this

1. Add the fields above to the roster entries, tier 1 first, and refuse to promote a seat to `live`
   without `interrupts`, `the ladder`, `the human` and `reuses`.
2. Draw the edges. The moment `builds on` exists for all of tier 1, the re-derivation goes away.
3. Name layers 02, 03 and 04 as their own work items in the plan, with the access plane written as
   a table rather than prose.

Nothing here changes what the seats DO. It changes what they are allowed to leave unsaid.
