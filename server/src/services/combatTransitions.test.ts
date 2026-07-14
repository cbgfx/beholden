import assert from "node:assert/strict";
import test from "node:test";
import type { StoredEncounterActor } from "../server/userData.js";
import { applyCombatantTransition, expireConditionsAtRound, shouldBreakConcentration, shouldClearTrackedConcentration } from "./combatTransitions.js";

function actor(patch: Partial<StoredEncounterActor> = {}): StoredEncounterActor {
  return {
    id: "combatant-1",
    encounterId: "encounter-1",
    baseType: "player",
    baseId: "player-1",
    name: "Test",
    label: "Test",
    initiative: 10,
    friendly: true,
    color: "#fff",
    overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
    hpCurrent: 10,
    hpMax: 10,
    hpDetails: null,
    ac: 10,
    acDetails: null,
    attackOverrides: null,
    conditions: [],
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

test("tracked concentration is cleared whenever the authoritative condition list omits it", () => {
  assert.equal(shouldClearTrackedConcentration([{ key: "rage" }]), true);
  assert.equal(shouldClearTrackedConcentration([{ key: "rage" }, { key: "concentration" }]), false);
});

test("zero HP removes concentration while preserving unrelated conditions", () => {
  const next = applyCombatantTransition(actor({
    hpCurrent: 0,
    conditions: [{ key: "concentration" }, { key: "prone" }],
  }));
  assert.deepEqual(next.conditions, [{ key: "prone" }]);
});

for (const key of ["incapacitated", "paralyzed", "petrified", "stunned", "unconscious"]) {
  test(`${key} removes concentration`, () => {
    const next = applyCombatantTransition(actor({
      conditions: [{ key: "concentration" }, { key }],
    }));
    assert.deepEqual(next.conditions, key === "unconscious" ? [{ key }, { key: "prone" }] : [{ key }]);
  });
}

test("rage removes concentration", () => {
  const next = applyCombatantTransition(actor({
    conditions: [{ key: "concentration" }, { key: "rage" }],
  }));
  assert.deepEqual(next.conditions, [{ key: "rage" }]);
});

test("non-incapacitating conditions preserve concentration", () => {
  const current = actor({ conditions: [{ key: "concentration" }, { key: "prone" }] });
  const next = applyCombatantTransition(current);
  assert.equal(next, current);
  assert.equal(shouldBreakConcentration(next), false);
});

test("transition is idempotent", () => {
  const once = applyCombatantTransition(actor({
    hpCurrent: 0,
    conditions: [{ key: "concentration" }, { key: "unconscious" }],
  }));
  assert.deepEqual(applyCombatantTransition(once), once);
});

test("unconscious applies prone and makes the reaction unavailable", () => {
  const next = applyCombatantTransition(actor({ conditions: [{ key: "unconscious" }], usedReaction: false }));
  assert.deepEqual(next.conditions, [{ key: "unconscious" }, { key: "prone" }]);
  assert.equal(next.usedReaction, true);
});

test("healing above zero removes unconscious but preserves prone", () => {
  const previous = actor({ hpCurrent: 0, conditions: [{ key: "unconscious" }, { key: "prone" }] });
  const next = applyCombatantTransition(actor({
    hpCurrent: 5,
    conditions: [{ key: "unconscious" }, { key: "prone" }],
  }), previous);
  assert.deepEqual(next.conditions, [{ key: "prone" }]);
});

test("incapacitating conditions make the reaction unavailable", () => {
  const next = applyCombatantTransition(actor({ conditions: [{ key: "stunned" }], usedReaction: false }));
  assert.equal(next.usedReaction, true);
});

test("timed conditions expire when their round is reached", () => {
  const conditions = [
    { key: "blinded", expiresAtRound: 3 },
    { key: "prone", expiresAtRound: 4 },
    { key: "marked", expiresAtRound: null },
  ];
  assert.deepEqual(expireConditionsAtRound(conditions, 3), [conditions[1], conditions[2]]);
});
