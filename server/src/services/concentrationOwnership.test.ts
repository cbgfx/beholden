import assert from "node:assert/strict";
import test from "node:test";
import type { StoredConditionInstance, StoredEncounterActor } from "../server/userData.js";
import {
  applyCombatantTransition,
  detectEndedConcentration,
  ensureConcentrationId,
  removeConditionsOwnedBy,
} from "./combatTransitions.js";

function actor(patch: Partial<StoredEncounterActor> = {}): StoredEncounterActor {
  return {
    id: "combatant-1",
    encounterId: "encounter-1",
    baseType: "monster",
    baseId: "monster-1",
    name: "Test",
    label: "Test",
    initiative: 10,
    friendly: false,
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

test("ensureConcentrationId stamps a fresh id onto a bare concentration condition", () => {
  const next = ensureConcentrationId([{ key: "concentration" }, { key: "prone" }]);
  const concentration = next.find((c) => c.key === "concentration");
  assert.ok(typeof concentration?.concentrationId === "string" && concentration.concentrationId.length > 0);
  assert.deepEqual(next.find((c) => c.key === "prone"), { key: "prone" });
});

test("ensureConcentrationId is idempotent — an existing id is preserved, not replaced", () => {
  const next = ensureConcentrationId([{ key: "concentration", concentrationId: "abc" }]);
  assert.equal(next[0]!.concentrationId, "abc");
});

test("ensureConcentrationId leaves conditions with no concentration entry untouched", () => {
  const conditions: StoredConditionInstance[] = [{ key: "prone" }];
  assert.equal(ensureConcentrationId(conditions), conditions);
});

test("applyCombatantTransition stamps a concentrationId when concentration is newly added this transition", () => {
  const previous = actor({ conditions: [] });
  const next = applyCombatantTransition(actor({ conditions: [{ key: "concentration" }] }), previous);
  const concentration = next.conditions.find((c) => c.key === "concentration");
  assert.ok(typeof concentration?.concentrationId === "string");
});

test("applyCombatantTransition does NOT retroactively stamp an already-established concentration condition", () => {
  // No `previous` at all (unknown context) — matches Codex's combatTransitions.test.ts contract
  // that a patch changing nothing must return the exact same reference.
  const current = actor({ conditions: [{ key: "concentration" }, { key: "prone" }] });
  const next = applyCombatantTransition(current);
  assert.equal(next, current);
});

test("applyCombatantTransition does NOT stamp when concentration was already active in the previous state", () => {
  const previous = actor({ conditions: [{ key: "concentration" }] });
  const next = applyCombatantTransition(actor({ conditions: [{ key: "concentration" }], hpCurrent: 5 }), previous);
  const concentration = next.conditions.find((c) => c.key === "concentration");
  assert.equal(concentration?.concentrationId, undefined, "an already-active legacy concentration condition is left untouched, not backfilled");
});

test("detectEndedConcentration returns null when concentration was never present", () => {
  assert.equal(detectEndedConcentration("caster-1", [{ key: "prone" }], []), null);
});

test("detectEndedConcentration returns null when concentration is still active", () => {
  const conditions = [{ key: "concentration", concentrationId: "abc" }];
  assert.equal(detectEndedConcentration("caster-1", conditions, conditions), null);
});

test("detectEndedConcentration reports the ended session's id when concentration is removed", () => {
  const ended = detectEndedConcentration(
    "caster-1",
    [{ key: "concentration", concentrationId: "abc" }],
    [],
  );
  assert.deepEqual(ended, { casterId: "caster-1", concentrationId: "abc" });
});

test("detectEndedConcentration reports a null concentrationId for legacy/untagged concentration", () => {
  const ended = detectEndedConcentration("caster-1", [{ key: "concentration" }], []);
  assert.deepEqual(ended, { casterId: "caster-1", concentrationId: null });
});

test("removeConditionsOwnedBy strips a dependent condition owned by the ended caster", () => {
  const conditions: StoredConditionInstance[] = [
    { key: "hexed", casterId: "caster-1", hexAbility: "wis" },
    { key: "prone" },
  ];
  const next = removeConditionsOwnedBy(conditions, { casterId: "caster-1", concentrationId: null });
  assert.deepEqual(next, [{ key: "prone" }]);
});

test("removeConditionsOwnedBy preserves a dependent condition owned by a DIFFERENT caster", () => {
  const conditions: StoredConditionInstance[] = [{ key: "hexed", casterId: "caster-2", hexAbility: "wis" }];
  const next = removeConditionsOwnedBy(conditions, { casterId: "caster-1", concentrationId: null });
  assert.deepEqual(next, conditions);
});

test("removeConditionsOwnedBy never touches a condition with no casterId at all (legacy data)", () => {
  const conditions: StoredConditionInstance[] = [{ key: "marked" }, { key: "poisoned" }];
  const next = removeConditionsOwnedBy(conditions, { casterId: "caster-1", concentrationId: "abc" });
  assert.deepEqual(next, conditions);
});

test("removeConditionsOwnedBy preserves a same-caster dependent from a DIFFERENT concentration session", () => {
  const conditions: StoredConditionInstance[] = [
    { key: "hexed", casterId: "caster-1", concentrationId: "session-2", hexAbility: "wis" },
  ];
  const next = removeConditionsOwnedBy(conditions, { casterId: "caster-1", concentrationId: "session-1" });
  assert.deepEqual(next, conditions, "a later, unrelated concentration session must not sweep an older one's stale dependent");
});

test("removeConditionsOwnedBy removes a same-caster dependent when the ended session has no id but the dependent does", () => {
  // Legacy caster-only ownership: the ended session predates concentrationId tagging, so there's
  // nothing to disambiguate against — the smallest backward-compatible default is to still remove it.
  const conditions: StoredConditionInstance[] = [
    { key: "hexed", casterId: "caster-1", concentrationId: "session-1", hexAbility: "wis" },
  ];
  const next = removeConditionsOwnedBy(conditions, { casterId: "caster-1", concentrationId: null });
  assert.deepEqual(next, []);
});

test("removeConditionsOwnedBy never removes the caster's own \"concentration\" condition via this path", () => {
  // A different combatant's own, unrelated "concentration" condition normally has no casterId at
  // all, so the first (no-casterId) guard already protects it; this pins that down explicitly.
  const conditions: StoredConditionInstance[] = [{ key: "concentration", concentrationId: "own-session" }];
  const next = removeConditionsOwnedBy(conditions, { casterId: "caster-1", concentrationId: null });
  assert.deepEqual(next, conditions);
});
