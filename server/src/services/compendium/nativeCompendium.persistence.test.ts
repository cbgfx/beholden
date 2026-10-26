import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { NATIVE_COMPENDIUM_CATEGORIES, NATIVE_COMPENDIUM_MANIFEST_VERSION, exportNativeCompendiumBatch, exportNativeCompendiumBundle, importNativeCompendiumBatch, importNativeCompendiumDocument, iterateNativeCompendiumEntries, parseNativeCompendiumBatch, previewNativeCompendiumDocument, resolveNativeCompendiumManifest, resolveNativeContentHashes } from "./nativeCompendium.js";
import { nativeEntryKey } from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import { computeContentHashSync } from "@beholden/shared/domain/compendium/computeContentHashSync";
import { collectGrandMonsterSpellIds } from "./grandCompendium.js";
import { samples, batch } from './nativeCompendium.fixtures.js';

test("native compendium round-trips every category", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    for (const category of NATIVE_COMPENDIUM_CATEGORIES) {
      const result = importNativeCompendiumBatch(db, batch(category));
      const exported = exportNativeCompendiumBatch(db, category);
      assert.equal(result.imported, samples[category].length);
      assert.equal(exported.entries.length, samples[category].length);
      assert.equal(exported.format, "beholden.compendium");
      assert.equal(exported.schema, "grand");
      assert.equal(exported.version, 2);
      assert.equal(exported.category, category);
      assert.deepEqual(Array.from(iterateNativeCompendiumEntries(db, category)), exported.entries);
    }

    const monster = exportNativeCompendiumBatch(db, "monsters").entries[0];
    assert.equal(monster?.name, "Test Guardian");
    assert.equal(monster?.ruleset, "5.5e");
    assert.equal((db.prepare("SELECT ruleset FROM compendium_monsters WHERE id = ?").get("m_test_guardian") as { ruleset: string }).ruleset, "5.5e");
    assert.ok(Array.isArray(monster?.actions));
    assert.equal(
      exportNativeCompendiumBatch(db, "monsters", ["m_test_guardian"]).entries.length,
      1,
    );
    assert.equal(
      exportNativeCompendiumBatch(db, "monsters", ["m_missing"]).entries.length,
      0,
    );
  } finally {
    db.close();
  }
});


test("native imports replace matching IDs", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("items"));
    importNativeCompendiumBatch(db, batch("items", [{
  "id": "i_test_blade",
  "ruleset": "5.5e",
  "name": "Test Blade, Revised",
  "type": "Melee Weapon",
  "rarity": "legendary",
  "magical": true,
  "attunement": true,
  "equippable": true,
  "weight": 3,
  "value": 1000,
  "proficiency": "Martial Weapons",
  "weapon": {
    "damage": "1d8",
    "twoHandedDamage": "1d10",
    "damageType": "S",
    "properties": [
      "V"
    ]
  },
  "description": "Replacement rules."
}]));

    const exported = exportNativeCompendiumBatch(db, "items");
    assert.equal(exported.entries.length, 1);
    assert.equal(exported.entries[0]?.name, "Test Blade, Revised");
    assert.equal(exported.entries[0]?.rarity, "legendary");
    assert.equal(exported.entries[0]?.description, "Replacement rules.");
  } finally {
    db.close();
  }
});


test("native import skips writing rows that are byte-identical to what's already stored", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const first = importNativeCompendiumBatch(db, batch("items"));
    assert.equal(first.imported, 1);

    // Re-importing the exact same file should be a no-op write, not a rewrite.
    const noop = importNativeCompendiumBatch(db, batch("items"));
    assert.equal(noop.imported, 0);
    assert.equal(noop.total, 1);

    // A real edit alongside a genuinely new entry: only those two get written.
    const revised = importNativeCompendiumBatch(db, batch("items", [
      {
  "id": "i_test_blade",
  "ruleset": "5.5e",
  "name": "Test Blade, Revised",
  "type": "Melee Weapon",
  "rarity": "legendary",
  "magical": true,
  "attunement": true,
  "equippable": true,
  "weight": 3,
  "value": 1000,
  "proficiency": "Martial Weapons",
  "weapon": {
    "damage": "1d8",
    "twoHandedDamage": "1d10",
    "damageType": "S",
    "properties": [
      "V"
    ]
  },
  "description": "Replacement rules."
},
      {
  "id": "i_new_blade",
  "ruleset": "5.5e",
  "name": "New Blade",
  "type": "Melee Weapon",
  "rarity": "common",
  "equippable": true,
  "weight": 3,
  "value": 10,
  "proficiency": "Martial Weapons",
  "weapon": {
    "damage": "1d8",
    "twoHandedDamage": "1d10",
    "damageType": "S",
    "properties": [
      "V"
    ]
  },
  "description": "Brand new."
},
    ]));
    assert.equal(revised.imported, 2);
    assert.equal(revised.total, 2);
  } finally {
    db.close();
  }
});


test("native import persists content_hash for content-comparable categories", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("items"));
    const row = db.prepare(
      "SELECT content_hash, data_json FROM compendium_items WHERE id = ?",
    ).get("i_test_blade") as { content_hash: string | null; data_json: string };
    assert.ok(row.content_hash);
    assert.equal(row.content_hash, computeContentHashSync(JSON.parse(row.data_json)));
  } finally {
    db.close();
  }
});


test("resolveNativeContentHashes backfills content_hash for rows written before the column existed", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("items"));
    // Simulate a pre-migration row: content_hash is NULL even though data_json is populated.
    db.prepare("UPDATE compendium_items SET content_hash = NULL WHERE id = ?").run("i_test_blade");
    assert.equal(
      (db.prepare("SELECT content_hash FROM compendium_items WHERE id = ?").get("i_test_blade") as { content_hash: string | null }).content_hash,
      null,
    );

    const resolved = resolveNativeContentHashes(db, "items");
    const key = nativeEntryKey("items", { id: "i_test_blade", ruleset: "5.5e" });
    assert.ok(resolved.get(key));

    // The computed hash is persisted, not just returned -- a second call sees it already set.
    const persisted = (db.prepare("SELECT content_hash FROM compendium_items WHERE id = ?").get("i_test_blade") as { content_hash: string | null }).content_hash;
    assert.equal(persisted, resolved.get(key));
  } finally {
    db.close();
  }
});


test("resolveNativeCompendiumManifest reports only new and changed entries for upload", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("items"));
    const existingKey = nativeEntryKey("items", { id: "i_test_blade", ruleset: "5.5e" });
    const newKey = nativeEntryKey("items", { id: "i_brand_new", ruleset: "5.5e" });

    const result = resolveNativeCompendiumManifest(db, {
      version: NATIVE_COMPENDIUM_MANIFEST_VERSION,
      category: "items",
      hashes: {
        [existingKey]: computeContentHashSync(samples.items[0]),
        [newKey]: "does-not-matter-its-new",
      },
    });

    assert.deepEqual(result.upload, [newKey]);

    // A genuinely different hash for the already-stored entry also needs upload.
    const changedResult = resolveNativeCompendiumManifest(db, {
      version: NATIVE_COMPENDIUM_MANIFEST_VERSION,
      category: "items",
      hashes: { [existingKey]: "a-different-hash" },
    });
    assert.deepEqual(changedResult.upload, [existingKey]);
  } finally {
    db.close();
  }
});


test("resolveNativeCompendiumManifest rejects unsupported versions and categories", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    assert.throws(
      () => resolveNativeCompendiumManifest(db, { version: 999, category: "items", hashes: {} }),
      /Unsupported compendium manifest version/,
    );
    assert.throws(
      () => resolveNativeCompendiumManifest(db, {
        version: NATIVE_COMPENDIUM_MANIFEST_VERSION,
        category: "decks",
        hashes: {},
      }),
      /does not support manifest diffing/,
    );
  } finally {
    db.close();
  }
});


test("ruleset-scoped classes with the same id survive independently", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const class55 = structuredClone(samples.classes[0]!);
    const class5 = { ...structuredClone(samples.classes[0]!), ruleset: "5e", name: "Test Class (2014)" };
    importNativeCompendiumBatch(db, batch("classes", [class55]));
    importNativeCompendiumBatch(db, batch("classes", [class5]));

    const rows = db.prepare(
      "SELECT id, ruleset, name FROM compendium_classes WHERE id = ? ORDER BY ruleset",
    ).all(String(class55.id)) as Array<{ id: string; ruleset: string; name: string }>;
    assert.deepEqual(rows, [
      { id: class55.id, ruleset: "5.5e", name: class55.name },
      { id: class55.id, ruleset: "5e", name: class5.name },
    ]);

    const preview5e = previewNativeCompendiumDocument(db, batch("classes", [{ ...class5, name: "Test Class (2014), Revised" }]));
    assert.equal(preview5e.replacements, 1);
    assert.equal(preview5e.additions, 0);

    importNativeCompendiumBatch(db, batch("classes", [{ ...class5, name: "Test Class (2014), Revised" }]));
    const untouched55 = db.prepare(
      "SELECT name FROM compendium_classes WHERE id = ? AND ruleset = ?",
    ).get(String(class55.id), "5.5e") as { name: string };
    assert.equal(untouched55.name, class55.name);
    assert.equal(exportNativeCompendiumBatch(db, "classes").entries.length, 2);
  } finally {
    db.close();
  }
});


test("ruleset-scoped spells with the same id survive independently", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const { access: _access55, ...spell55 } = structuredClone(samples.spells[0]!);
    const { access: _access5, ...spell5Base } = structuredClone(samples.spells[0]!);
    const spell5 = { ...spell5Base, ruleset: "5e", description: ["Legacy version of the test spell."] };
    importNativeCompendiumBatch(db, batch("spells", [spell55]));

    // Importing the SAME id under a different ruleset must be a new row, not a silent overwrite
    // of the 5.5e spell -- this is the exact bug a same-named-but-different-ruleset spell import
    // (e.g. a full 2014 spell catalog) would otherwise hit.
    const preview5e = previewNativeCompendiumDocument(db, batch("spells", [spell5]));
    assert.equal(preview5e.additions, 1);
    assert.equal(preview5e.replacements, 0);

    importNativeCompendiumBatch(db, batch("spells", [spell5]));

    const rows = db.prepare(
      "SELECT id, ruleset, data_json FROM compendium_spells WHERE id = ? ORDER BY ruleset",
    ).all(String(spell55.id)) as Array<{ id: string; ruleset: string; data_json: string }>;
    assert.deepEqual(rows.map((row) => row.ruleset), ["5.5e", "5e"]);
    const untouched55 = JSON.parse(rows[0]!.data_json) as Record<string, unknown>;
    assert.deepEqual(untouched55.description, spell55.description);

    // Re-importing the 5e version again is a replacement of just that row, not the 5.5e one.
    const preview5eAgain = previewNativeCompendiumDocument(db, batch("spells", [{ ...spell5, description: ["Revised legacy text."] }]));
    assert.equal(preview5eAgain.replacements, 1);
    assert.equal(preview5eAgain.additions, 0);
  } finally {
    db.close();
  }
});


test("ruleset-scoped class talents with the same id survive independently", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const talent55 = structuredClone(samples.classTalents[0]!);
    const talent5 = { ...structuredClone(talent55), ruleset: "5e", description: ["Legacy version of the test maneuver."] };
    importNativeCompendiumBatch(db, batch("classTalents", [talent55]));

    // Same bug class as spells: importing the SAME id under a different ruleset (e.g. the 2014
    // maneuver text for a talent that also exists in 2024) must be a new row, not a silent
    // overwrite of the other ruleset's talent.
    const preview5e = previewNativeCompendiumDocument(db, batch("classTalents", [talent5]));
    assert.equal(preview5e.additions, 1);
    assert.equal(preview5e.replacements, 0);

    importNativeCompendiumBatch(db, batch("classTalents", [talent5]));

    const rows = db.prepare(
      "SELECT id, ruleset, data_json FROM compendium_class_talents WHERE id = ? ORDER BY ruleset",
    ).all(String(talent55.id)) as Array<{ id: string; ruleset: string; data_json: string }>;
    assert.deepEqual(rows.map((row) => row.ruleset), ["5.5e", "5e"]);
    const untouched55 = JSON.parse(rows[0]!.data_json) as Record<string, unknown>;
    assert.deepEqual(untouched55.description, talent55.description);
  } finally {
    db.close();
  }
});


test("class-talent cleanup is ruleset-scoped and unchanged imports do not mutate spells", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const talent = structuredClone(samples.classTalents[0]!);
    const conflictingSpell = {
      ...structuredClone(samples.spells[0]!),
      id: talent.id,
      name: "Legacy collision",
    };
    importNativeCompendiumBatch(db, batch("spells", [conflictingSpell, { ...conflictingSpell, ruleset: "5e", name: "5e collision" }]));
    importNativeCompendiumBatch(db, batch("classTalents", [talent]));
    assert.deepEqual(
      db.prepare("SELECT ruleset FROM compendium_spells WHERE id = ? ORDER BY ruleset").all(talent.id),
      [{ ruleset: "5e" }],
    );

    db.prepare("INSERT INTO compendium_spells (id, ruleset, name, name_key, data_json) VALUES (?, '5.5e', ?, ?, ?)")
      .run(talent.id, "Restored collision", "restored_collision", JSON.stringify({ ...conflictingSpell, ruleset: "5.5e" }));
    const result = importNativeCompendiumBatch(db, batch("classTalents", [talent]));
    assert.equal(result.imported, 0);
    assert.equal((db.prepare("SELECT COUNT(*) count FROM compendium_spells WHERE id = ?").get(talent.id) as { count: number }).count, 2);
  } finally {
    db.close();
  }
});


for (const category of ["decks", "bastions"] as const) {
  test(`${category} preview and re-import recognize unchanged exported entries`, () => {
    const db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    try {
      importNativeCompendiumBatch(db, batch(category));
      const exported = exportNativeCompendiumBatch(db, category);
      const preview = previewNativeCompendiumDocument(db, exported);
      assert.equal(preview.changed, 0);
      assert.equal(preview.unchanged, exported.entries.length);
      const second = importNativeCompendiumBatch(db, exported);
      assert.equal(second.imported, 0);
      assert.equal(second.total, exported.entries.length);
    } finally {
      db.close();
    }
  });
}


test("Bastion export uses the canonical stored document rather than mutable projections", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    importNativeCompendiumBatch(db, batch("bastions"));
    db.prepare("UPDATE compendium_bastion_spaces SET name = 'Diverged projection', squares = 999 WHERE id = 'bastion-space:test'").run();
    db.prepare("UPDATE compendium_bastion_orders SET order_name = 'Diverged projection' WHERE id = 'bastion-order:test'").run();
    db.prepare("UPDATE compendium_bastion_facilities SET description = 'Diverged projection' WHERE id = 'bastion-facility:test'").run();
    const entries = exportNativeCompendiumBatch(db, "bastions").entries;
    assert.equal(entries.find((entry) => entry.id === "bastion-space:test")?.name, "Test Space");
    assert.equal(entries.find((entry) => entry.id === "bastion-order:test")?.name, "Test Order");
    assert.equal(entries.find((entry) => entry.id === "bastion-facility:test")?.description, "Test facility.");
  } finally {
    db.close();
  }
});


test("Grand remains canonical in storage", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("monsters"));
    importNativeCompendiumBatch(db, batch("classes"));

    const monsterRow = db.prepare(
      "SELECT data_json FROM compendium_monsters WHERE id = ?",
    ).get("m_test_guardian") as { data_json: string };
    const classRow = db.prepare(
      "SELECT data_json FROM compendium_classes WHERE id = ?",
    ).get("c_test") as { data_json: string };
    const storedMonster = JSON.parse(monsterRow.data_json) as Record<string, unknown>;
    const storedClass = JSON.parse(classRow.data_json) as Record<string, unknown>;

    assert.ok(storedMonster.armorClass);
    assert.equal(storedMonster.ac, undefined);
    assert.ok(Array.isArray(storedClass.levels));
    assert.equal(storedClass.autolevels, undefined);

  } finally {
    db.close();
  }
});


test("native importer accepts a multi-category bundle atomically", () => {
  const source = new Database(":memory:");
  const destination = new Database(":memory:");
  source.exec(SCHEMA_SQL);
  destination.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(source, batch("monsters"));
    importNativeCompendiumBatch(source, batch("items"));
    const bundle = exportNativeCompendiumBundle(source);
    const serialized = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
    assert.equal(serialized.batches, undefined);
    assert.ok(Array.isArray(serialized.monsters));
    assert.ok(Array.isArray(serialized.items));

    const result = importNativeCompendiumDocument(destination, bundle);
    assert.equal(result.imported, 2);
    assert.deepEqual(
      result.batches.map((entry) => entry.category),
      ["monsters", "items"],
    );
    assert.equal(exportNativeCompendiumBatch(destination, "monsters").entries.length, 1);
    assert.equal(exportNativeCompendiumBatch(destination, "items").entries.length, 1);
  } finally {
    source.close();
    destination.close();
  }
});


test("native preview validates without writing and counts replacements", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("items"));
    // samples.items[0] re-uploaded byte-identical -- a no-op "replacement" -- alongside one
    // genuinely new item.
    const preview = previewNativeCompendiumDocument(db, batch("items", [
      samples.items[0]!,
      {
        ...samples.items[0]!,
        id: "i_new_blade",
        name: "New Blade",
      },
    ]));

    assert.deepEqual(preview, {
      entries: 2,
      additions: 1,
      replacements: 1,
      changed: 0,
      unchanged: 1,
      batches: [{
        category: "items",
        entries: 2,
        additions: 1,
        replacements: 1,
        changed: 0,
        unchanged: 1,
      }],
    });
    assert.equal(exportNativeCompendiumBatch(db, "items").entries.length, 1);
  } finally {
    db.close();
  }
});


test("native preview distinguishes a real content change from a no-op re-upload", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("items"));
    // Same id as an already-imported item, but with a changed field -- a real edit, not a no-op.
    const preview = previewNativeCompendiumDocument(db, batch("items", [
      { ...samples.items[0]!, name: `${samples.items[0]!.name} (Revised)` },
    ]));

    assert.equal(preview.additions, 0);
    assert.equal(preview.replacements, 1);
    assert.equal(preview.changed, 1);
    assert.equal(preview.unchanged, 0);
  } finally {
    db.close();
  }
});


test("items with the same id coexist in 5e and 5.5e", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const current = samples.items[0]!;
    importNativeCompendiumBatch(db, batch("items", [current]));
    importNativeCompendiumBatch(db, batch("items", [{ ...current, ruleset: "5e", name: "Test Blade (2014)" }]));

    const rows = db.prepare("SELECT id, ruleset, name FROM compendium_items WHERE id = ? ORDER BY ruleset").all(current.id);
    assert.deepEqual(rows, [
      { id: current.id, ruleset: "5.5e", name: current.name },
      { id: current.id, ruleset: "5e", name: "Test Blade (2014)" },
    ]);
    assert.equal(exportNativeCompendiumBatch(db, "items").entries.length, 2);
  } finally {
    db.close();
  }
});


test("native documents reject duplicate IDs before preview or import", () => {
  assert.throws(
    () => parseNativeCompendiumBatch(batch("items", [
      samples.items[0]!,
      samples.items[0]!,
    ])),
      /duplicates id "i_test_blade" in ruleset "5\.5e"/u,
  );
});


test("invalid native bundles make no partial writes", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const document = {
      format: "beholden.compendium",
      schema: "grand",
      exportedAt: "2026-06-28T00:00:00.000Z",
      items: samples.items,
      spells: [{ ...samples.spells[0], level: 10 }],
    };
    assert.throws(
      () => importNativeCompendiumDocument(db, document),
      /spells entry 1 is invalid/u,
    );
    assert.equal(exportNativeCompendiumBatch(db, "items").entries.length, 0);
    assert.equal(exportNativeCompendiumBatch(db, "spells").entries.length, 0);
  } finally {
    db.close();
  }
});


test("Grand monster spell references use id for adventure dependencies", () => {
  const ids = collectGrandMonsterSpellIds([{
    spells: [
      { id: "s_fire_bolt", name: "Fire Bolt" },
      { id: "s_shield", name: "Shield" },
      { spellId: "s_legacy_wrong_key", name: "Legacy Shape" },
    ],
  }]);
  assert.deepEqual(Array.from(ids), ["s_fire_bolt", "s_shield"]);
});
