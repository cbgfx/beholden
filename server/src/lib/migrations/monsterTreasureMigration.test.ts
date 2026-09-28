import assert from "node:assert/strict";
import test from "node:test";
import { MonsterSchema } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { computeContentHashSync } from "@beholden/shared/domain/compendium/computeContentHashSync";
import { openDb } from "../db.js";
import { extractMonsterTreasureTraits } from "./monsterTreasureMigration.js";

const DMG_TEXT = "Relics: The monster's treasure hoard features magic items with the noted theme.";

test("the monster schema rejects a Treasure trait and accepts the treasure field", () => {
  const withTrait = MonsterSchema.safeParse({
    id: "m_x", ruleset: "5.5e", name: "X",
    traits: [{ id: "trait_1", name: "Treasure", description: DMG_TEXT }],
  });
  assert.equal(withTrait.success, false);
  assert.match(withTrait.error?.issues[0]?.message ?? "", /"treasure" field/);

  assert.equal(MonsterSchema.safeParse({ id: "m_x", ruleset: "5.5e", name: "X", treasure: "Relics" }).success, true);
});

test("stored monsters move a Treasure trait to the treasure field, with a fresh content hash", () => {
  const db = openDb(":memory:");
  try {
    const insert = db.prepare("INSERT INTO compendium_monsters (id, ruleset, name, data_json, content_hash) VALUES (?, ?, ?, ?, ?)");
    const old = {
      id: "m_lich", ruleset: "5.5e", name: "Lich",
      traits: [{ id: "trait_1", name: "Legendary Resistance", description: "Three times a day." }, { id: "trait_2", name: "Treasure", description: DMG_TEXT }],
    };
    insert.run("m_lich", "5.5e", "Lich", JSON.stringify(old), computeContentHashSync(old));
    // The same id in the other ruleset must be left alone (monsters are keyed by id and ruleset).
    const other = { id: "m_lich", ruleset: "5e", name: "Lich", traits: [{ id: "trait_1", name: "Treasure hoard notes", description: "Kept." }] };
    insert.run("m_lich", "5e", "Lich", JSON.stringify(other), computeContentHashSync(other));
    // Converted by an earlier version, which left the hash describing the pre-conversion entry.
    const converted = { id: "m_mummy", ruleset: "5.5e", name: "Mummy", treasure: "Relics" };
    insert.run("m_mummy", "5.5e", "Mummy", JSON.stringify(converted), "stale-hash");

    assert.equal(extractMonsterTreasureTraits(db), true);

    const row = (id: string, ruleset: string) => db.prepare("SELECT data_json, content_hash FROM compendium_monsters WHERE id = ? AND ruleset = ?")
      .get(id, ruleset) as { data_json: string; content_hash: string };

    const lich = row("m_lich", "5.5e");
    assert.deepEqual(JSON.parse(lich.data_json), {
      id: "m_lich", ruleset: "5.5e", name: "Lich",
      traits: [{ id: "trait_1", name: "Legendary Resistance", description: "Three times a day." }],
      treasure: "Relics",
    });
    assert.equal(lich.content_hash, computeContentHashSync(JSON.parse(lich.data_json)));
    assert.equal(MonsterSchema.safeParse(JSON.parse(lich.data_json)).success, true);

    assert.equal(row("m_lich", "5e").data_json, JSON.stringify(other), "the other ruleset's row is untouched");

    const mummy = row("m_mummy", "5.5e");
    assert.equal(mummy.data_json, JSON.stringify(converted));
    assert.equal(mummy.content_hash, computeContentHashSync(converted), "stale hash refreshed");
  } finally {
    db.close();
  }
});

test("a monster whose only trait is Treasure loses the traits list entirely", () => {
  const db = openDb(":memory:");
  try {
    const old = { id: "m_x", ruleset: "5.5e", name: "X", traits: [{ id: "trait_1", name: "Treasure", description: DMG_TEXT }] };
    db.prepare("INSERT INTO compendium_monsters (id, ruleset, name, data_json) VALUES ('m_x', '5.5e', 'X', ?)").run(JSON.stringify(old));
    extractMonsterTreasureTraits(db);
    const stored = JSON.parse(db.prepare("SELECT data_json FROM compendium_monsters").pluck().get() as string);
    assert.deepEqual(stored, { id: "m_x", ruleset: "5.5e", name: "X", treasure: "Relics" });
  } finally {
    db.close();
  }
});
