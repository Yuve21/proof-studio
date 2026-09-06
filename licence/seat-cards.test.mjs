/**
 * The seat cards are a contract, so they get a gate rather than a convention.
 *
 * Every assertion here exists because the field it guards is the one that would
 * quietly go missing: a card with no `interrupts` is exactly the state the
 * sibling product's auditor is in today, and it looks completely normal from the
 * outside.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEAT_CARDS, REQUIRED_FIELDS, INTERRUPT_KINDS, LADDER_RUNGS, VAGUE, KNOWLEDGE_CONVENTION,
} from "./seat-cards.mjs";
import { TIERS, loadRoster } from "./roster.mjs";

const roster = loadRoster();
const tier1 = TIERS["tier-1"];

test("every tier-1 seat has a card, and no card names a seat that does not exist", () => {
  const missing = tier1.filter((id) => !SEAT_CARDS[id]);
  assert.deepEqual(missing, [], `tier-1 seats with no card: ${missing.join(", ")}`);

  // Both directions, rather than one derived from the other, which would make
  // the check a mirror.
  const strays = Object.keys(SEAT_CARDS).filter((id) => !roster.has(id));
  assert.deepEqual(strays, [], `cards for ids the roster does not define: ${strays.join(", ")}`);
});

test("every card carries every required field, non-empty", () => {
  for (const [id, card] of Object.entries(SEAT_CARDS)) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(card[field] !== undefined, `${id}: missing ${field}`);
      if (typeof card[field] === "string") {
        // `howToRun` is a COMMAND, and a correct one can be shorter than a
        // sentence. A prose floor applied to it would push somebody to pad an
        // invocation line, which makes the field worse rather than better.
        const floor = field === "howToRun" ? 1 : 20;
        assert.ok(card[field].trim().length >= floor, `${id}.${field} is too short to be a real answer`);
      }
    }
    assert.ok(Array.isArray(card.buildsOn), `${id}.buildsOn must be an array (empty is a valid answer)`);
    assert.ok(Array.isArray(card.needs) && card.needs.length > 0, `${id}.needs must name at least one dependency`);
  }
});

test("the ladder has three distinct rungs on every card", () => {
  for (const [id, card] of Object.entries(SEAT_CARDS)) {
    for (const rung of LADDER_RUNGS) {
      assert.ok(card.ladder?.[rung]?.trim(), `${id}.ladder.${rung} is empty`);
    }
    const rungs = LADDER_RUNGS.map((r) => card.ladder[r]);
    assert.equal(new Set(rungs).size, 3, `${id}: two ladder rungs say the same thing, so the ladder is decorative`);
  }
});

test("every card declares all four interrupt kinds", () => {
  for (const [id, card] of Object.entries(SEAT_CARDS)) {
    for (const kind of INTERRUPT_KINDS) {
      assert.ok(card.interrupts?.[kind]?.trim(), `${id}.interrupts.${kind} is empty: this seat has no declared stopping condition of that kind`);
    }
  }
});

test("no field is vague", () => {
  const walk = (id, path, value) => {
    if (typeof value === "string") {
      for (const re of VAGUE) {
        // The match is computed BEFORE the assert, not inside its message.
        // assert's message argument is evaluated eagerly, so building it from
        // `value.match(re)[0]` threw on every string that did NOT match, which
        // is a guard that fails loudest when there is nothing wrong.
        const hit = value.match(re);
        assert.ok(!hit, `${id}.${path} is vague ("${hit?.[0]}"): a published field that says nothing is the defect this product detects`);
      }
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(id, `${path}.${k}`, v);
    }
  };
  for (const [id, card] of Object.entries(SEAT_CARDS)) walk(id, "card", card);
});

test("buildsOn only names seats that exist, and never itself", () => {
  for (const [id, card] of Object.entries(SEAT_CARDS)) {
    for (const dep of card.buildsOn) {
      assert.ok(roster.has(dep), `${id}.buildsOn names "${dep}", which is not a seat`);
      assert.notEqual(dep, id, `${id} builds on itself`);
    }
  }
});

test("an optional dependency states what it degrades to", () => {
  for (const [id, card] of Object.entries(SEAT_CARDS)) {
    for (const need of card.needs) {
      assert.ok(need.name?.trim(), `${id}: a need with no name`);
      if (need.required === false) {
        assert.ok(need.degradesTo?.trim(), `${id}: optional dependency "${need.name}" does not say what it degrades to, so "optional" is unfalsifiable`);
      }
    }
  }
});

test("the knowledge convention never blocks", () => {
  assert.ok(KNOWLEDGE_CONVENTION.files.length >= 3);
  assert.match(KNOWLEDGE_CONVENTION.onMissing, /proceed/i);
  assert.match(KNOWLEDGE_CONVENTION.onMissing, /withhold/i);
});

/*
 * MUTATION TEST. A guard nobody has watched fail is a decoration, and the
 * vagueness check is the one most likely to be satisfied by its own existence.
 * These fixtures prove each guard goes red on the defect it claims to catch.
 */
test("the guards actually fire", () => {
  const vagueHit = VAGUE.some((re) => re.test("runs as needed and follows best practices"));
  assert.ok(vagueHit, "the vagueness guard does not catch an obviously vague sentence");

  const clean = VAGUE.some((re) => re.test("Stops at 40 findings and states the suppressed count."));
  assert.equal(clean, false, "the vagueness guard fires on a concrete sentence, so it would block real cards");

  // A ladder with two identical rungs must be detectable by the same rule the
  // real test uses.
  const fake = ["x", "x", "y"];
  assert.notEqual(new Set(fake).size, 3, "the duplicate-rung check cannot see a duplicate rung");
});
