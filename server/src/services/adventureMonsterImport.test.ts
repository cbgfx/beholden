import assert from "node:assert/strict";
import test from "node:test";
import { adventureMonsterKey, planAdventureMonsterImports } from "./adventureMonsterImport.js";
import { AdventureImportBody } from "../routes/adventures.js";

const adventureWithCombatant = (combatant: Record<string, unknown>) => ({
  format: "beholden.adventure",
  version: 2,
  compendium: [],
  adventure: {
    name: "Test Adventure",
    encounters: [{ name: "Test Encounter", combatants: [combatant] }],
  },
});

test("adventure import rejects a statless tracker-only monster", () => {
  const parsed = AdventureImportBody.safeParse(adventureWithCombatant({
    baseType: "monster", baseId: "", name: "Broken", label: "Broken",
    hpMax: null, hpCurrent: null, ac: null,
  }));
  assert.equal(parsed.success, false);
});

test("adventure import accepts an explicitly statted tracker-only monster", () => {
  const parsed = AdventureImportBody.safeParse(adventureWithCombatant({
    baseType: "monster", baseId: "", name: "Manual", label: "Manual",
    hpMax: 20, hpCurrent: 20, ac: 14,
  }));
  assert.equal(parsed.success, true);
});

test("adventure import accepts a linked monster without duplicated HP or AC", () => {
  const parsed = AdventureImportBody.safeParse(adventureWithCombatant({
    baseType: "monster",
    baseId: "m_titivilus",
    baseRuleset: "5e",
    name: "Titivilus",
    label: "Titivilus",
    hpMax: null,
    hpCurrent: null,
    ac: null,
  }));
  assert.equal(parsed.success, true);
});

test("adventure import rejects campaign actors without destination IDs", () => {
  for (const baseType of ["player", "inpc"] as const) {
    const parsed = AdventureImportBody.safeParse(adventureWithCombatant({
      baseType, baseId: "", name: "Unlinked", label: "Unlinked",
    }));
    assert.equal(parsed.success, false);
  }
});

test("adventure import accepts a statless portable world action", () => {
  const parsed = AdventureImportBody.safeParse(adventureWithCombatant({
    baseType: "world",
    baseId: "",
    name: "Temple Pulse",
    label: "Temple Pulse",
    description: "On initiative count 20, the temple emits a pulse.",
    initiative: 20,
    hpMax: null,
    hpCurrent: null,
    ac: null,
  }));
  assert.equal(parsed.success, true);
});

test("adventure import reuses an existing monster by canonical name", () => {
  const result = planAdventureMonsterImports([{
    format: "beholden.compendium",
    schema: "grand",
    category: "monsters",
    entries: [
      { id: "ai_goblin", ruleset: "5.5e", name: "  Goblin  ", classification: {} },
      { id: "ai_new", ruleset: "5.5e", name: "Ash Drake", classification: {} },
    ],
  }], [{ id: "m_goblin", ruleset: "5.5e", name_key: "goblin" }]);

  assert.equal(result.monsterIdMap.get(adventureMonsterKey("ai_goblin", "5.5e")), "m_goblin");
  assert.deepEqual((result.compendium[0] as { entries: unknown[] }).entries, [
    { id: "ai_new", ruleset: "5.5e", name: "Ash Drake", classification: {} },
  ]);
});

test("adventure import never replaces an existing monster with the same id", () => {
  const result = planAdventureMonsterImports([{
    category: "monsters",
    entries: [{ id: "m_ogre", ruleset: "5.5e", name: "Ogre" }],
  }], [{ id: "m_ogre", ruleset: "5.5e", name_key: "ogre" }]);

  assert.equal(result.monsterIdMap.get(adventureMonsterKey("m_ogre", "5.5e")), "m_ogre");
  assert.deepEqual((result.compendium[0] as { entries: unknown[] }).entries, []);
});

test("adventure import does not deduplicate a monster against another ruleset", () => {
  const result = planAdventureMonsterImports([{
    category: "monsters",
    entries: [{ id: "m_titivilus", ruleset: "5.5e", name: "Titivilus" }],
  }], [{ id: "m_titivilus", ruleset: "5e", name_key: "titivilus" }]);

  assert.equal(result.monsterIdMap.size, 0);
  assert.equal((result.compendium[0] as { entries: unknown[] }).entries.length, 1);
});
