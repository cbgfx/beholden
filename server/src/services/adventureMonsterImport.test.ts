import assert from "node:assert/strict";
import test from "node:test";
import { planAdventureMonsterImports } from "./adventureMonsterImport.js";

test("adventure import reuses an existing monster by canonical name", () => {
  const result = planAdventureMonsterImports([{
    format: "beholden.compendium",
    schema: "grand",
    category: "monsters",
    entries: [
      { id: "ai_goblin", name: "  Goblin  ", classification: {} },
      { id: "ai_new", name: "Ash Drake", classification: {} },
    ],
  }], [{ id: "m_goblin", name_key: "goblin" }]);

  assert.equal(result.monsterIdMap.get("ai_goblin"), "m_goblin");
  assert.deepEqual((result.compendium[0] as { entries: unknown[] }).entries, [
    { id: "ai_new", name: "Ash Drake", classification: {} },
  ]);
});

test("adventure import never replaces an existing monster with the same id", () => {
  const result = planAdventureMonsterImports([{
    category: "monsters",
    entries: [{ id: "m_ogre", name: "Ogre" }],
  }], [{ id: "m_ogre", name_key: "ogre" }]);

  assert.equal(result.monsterIdMap.get("m_ogre"), "m_ogre");
  assert.deepEqual((result.compendium[0] as { entries: unknown[] }).entries, []);
});
