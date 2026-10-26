import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import type { Server } from "node:http";
import { openDb, type Db } from "./db.js";
import { assertMortalHasExactlyOneSubtype, convertMortalSubtype, createMortal } from "../services/binders/mortals.js";
import { ensureBinderColumns, ensureCanonicalMortalPositions } from "./migrations/binderCampaignMigration.js";

let db: Db | null = null;

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
  db?.close();
  db = null;
});

function seedUser(database: Db, id: string, isAdmin = false) {
  database.prepare(`
    INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at)
    VALUES (?, ?, 'hash', ?, ?, 1, 1)
  `).run(id, id, id, isAdmin ? 1 : 0);
}



describe("Binder schema", () => {
  test("opens fresh, adds nullable Campaign fields, and remains idempotent", () => {
    db = openDb(":memory:");
    const columns = db.prepare("PRAGMA table_info(campaigns)").all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    assert.equal(names.has("binder_id"), true);
    assert.equal(names.has("current_date_text"), true);
    assert.equal(names.has("current_date_sort"), true);
    const binderColumns = db.prepare("PRAGMA table_info(binders)").all() as Array<{ name: string }>;
    assert.equal(new Set(binderColumns.map((column) => column.name)).has("color"), true);
    assert.equal(
      db.prepare("SELECT dflt_value FROM pragma_table_info('binders') WHERE name = 'color'").pluck().get(),
      "'#38b6ff'",
    );
    assert.deepEqual(
      db.prepare(`
        SELECT "notnull", dflt_value
        FROM pragma_table_info('binders')
        WHERE name = 'description'
      `).get(),
      { notnull: 0, dflt_value: null },
    );
    assert.deepEqual(
      db.prepare(`
        SELECT "notnull"
        FROM pragma_table_info('binder_player_characters')
        WHERE name = 'character_id'
      `).get(),
      { notnull: 0 },
    );
    assert.equal(
      db.prepare(`
        SELECT on_delete
        FROM pragma_foreign_key_list('binder_player_characters')
        WHERE "from" = 'character_id'
      `).pluck().get(),
      "SET NULL",
    );
    assert.equal(
      db.prepare("SELECT 1 FROM pragma_table_info('mortals') WHERE name = 'image_url'").pluck().get(),
      1,
    );
    assert.equal(
      db.prepare("SELECT 1 FROM pragma_table_info('binder_player_characters') WHERE name = 'player_id'").pluck().get(),
      1,
    );
    assert.deepEqual(
      db.prepare(`
        SELECT "notnull", dflt_value
        FROM pragma_table_info('binder_organizations')
        WHERE name = 'leader_mortal_id'
      `).get(),
      { notnull: 0, dflt_value: null },
    );
    assert.equal(
      db.prepare(`
        SELECT on_delete
        FROM pragma_foreign_key_list('binder_organizations')
        WHERE "from" = 'leader_mortal_id'
      `).pluck().get(),
      "SET NULL",
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  });

  test("adds the Organization leader column before creating its index on an upgraded database", () => {
    db = openDb(":memory:");
    db.exec(`
      DROP INDEX idx_binder_organizations_leader;
      ALTER TABLE binder_organizations DROP COLUMN leader_mortal_id;
    `);

    assert.equal(
      db.prepare(`
        SELECT 1
        FROM pragma_table_info('binder_organizations')
        WHERE name = 'leader_mortal_id'
      `).get(),
      undefined,
    );

    ensureBinderColumns(db);

    assert.deepEqual(
      db.prepare(`
        SELECT "notnull", dflt_value
        FROM pragma_table_info('binder_organizations')
        WHERE name = 'leader_mortal_id'
      `).get(),
      { notnull: 0, dflt_value: null },
    );
    assert.equal(
      db.prepare(`
        SELECT 1
        FROM sqlite_master
        WHERE type = 'index' AND name = 'idx_binder_organizations_leader'
      `).pluck().get(),
      1,
    );
  });

  test("promotes a legacy Position and removes the duplicate membership column", () => {
    db = openDb(":memory:");
    seedUser(db, "owner");
    db.exec(`
      ALTER TABLE organization_memberships ADD COLUMN position_id TEXT;
      INSERT INTO binders (id, owner_user_id, name, name_key, created_at, updated_at)
      VALUES ('binder', 'owner', 'Binder', 'binder', 1, 1);
      INSERT INTO binder_records (id, binder_id, record_type, name, name_key, visibility, created_at, updated_at)
      VALUES
        ('mortal', 'binder', 'mortal', 'Merchant', 'merchant', 'dm', 1, 1),
        ('position', 'binder', 'position', 'Merchant', 'merchant-position', 'dm', 1, 1),
        ('organization', 'binder', 'organization', 'Guild', 'guild', 'dm', 1, 1);
      INSERT INTO mortals (id, life_status, mortal_type, created_at, updated_at)
      VALUES ('mortal', 'alive', 'npc', 1, 1);
      INSERT INTO binder_positions (id, created_at, updated_at) VALUES ('position', 1, 1);
      INSERT INTO binder_organizations (id, created_at, updated_at) VALUES ('organization', 1, 1);
      INSERT INTO organization_memberships (
        id, organization_id, mortal_id, position_id, is_primary, created_at, updated_at
      ) VALUES ('membership', 'organization', 'mortal', 'position', 0, 1, 1);
    `);

    ensureCanonicalMortalPositions(db);

    assert.equal(db.prepare("SELECT position_id FROM mortals WHERE id = 'mortal'").pluck().get(), "position");
    assert.equal(
      db.prepare("SELECT 1 FROM pragma_table_info('organization_memberships') WHERE name = 'position_id'").get(),
      undefined,
    );
  });

  test("restores a blank live Position from the guarded export recovery map", () => {
    db = openDb(":memory:");
    seedUser(db, "owner");
    db.exec(`
      INSERT INTO binders (id, owner_user_id, name, name_key, created_at, updated_at)
      VALUES ('binder', 'owner', 'Binder', 'binder', 1, 1);
      INSERT INTO binder_records (id, binder_id, record_type, name, name_key, visibility, created_at, updated_at)
      VALUES
        ('010caf3f-78f6-431a-9dba-b93f474c1af3', 'binder', 'mortal', 'Mortal', 'mortal', 'dm', 1, 1),
        ('af328059-9977-4058-a2d5-3a5a7312d581', 'binder', 'position', 'Ruler', 'ruler', 'dm', 1, 1);
      INSERT INTO mortals (id, life_status, mortal_type, created_at, updated_at)
      VALUES ('010caf3f-78f6-431a-9dba-b93f474c1af3', 'alive', 'npc', 1, 1);
      INSERT INTO binder_positions (id, created_at, updated_at)
      VALUES ('af328059-9977-4058-a2d5-3a5a7312d581', 1, 1);
    `);

    ensureCanonicalMortalPositions(db);

    assert.equal(
      db.prepare("SELECT position_id FROM mortals WHERE id = '010caf3f-78f6-431a-9dba-b93f474c1af3'").pluck().get(),
      "af328059-9977-4058-a2d5-3a5a7312d581",
    );
  });

  test("creates every Mortal with one explicit subtype and converts atomically", () => {
    db = openDb(":memory:");
    seedUser(db, "owner");
    db.prepare(`
      INSERT INTO binders (
        id, owner_user_id, name, name_key, description, created_at, updated_at
      ) VALUES ('binder', 'owner', 'Tarentha', 'tarentha', '', 1, 1)
    `).run();
    db.prepare(`
      INSERT INTO user_characters (
        id, user_id, name, player_name, ruleset, class_name, species, level,
        hp_max, hp_current, ac, speed, created_at, updated_at
      ) VALUES ('character', 'owner', 'Torin', '', '5.5e', '', '', 1, 10, 10, 10, 30, 1, 1)
    `).run();

    createMortal(db, {
      binderId: "binder",
      name: "Shopkeeper",
      nameKey: "shopkeeper",
      subtype: { type: "npc", monsterId: null },
    }, { recordId: "mortal" }, 2);

    assertMortalHasExactlyOneSubtype(db, "mortal");
    assert.deepEqual(
      db.prepare(`
        SELECT description, backstory, dm_notes
        FROM mortals
        WHERE id = 'mortal'
      `).get(),
      { description: null, backstory: null, dm_notes: null },
    );
    assert.deepEqual(
      db.prepare("SELECT mortal_id, monster_id FROM binder_npcs WHERE mortal_id = 'mortal'").get(),
      { mortal_id: "mortal", monster_id: null },
    );

    convertMortalSubtype(db, "mortal", {
      type: "player_character",
      characterId: "character",
    }, 3);
    assertMortalHasExactlyOneSubtype(db, "mortal");
    assert.equal(db.prepare("SELECT 1 FROM binder_npcs WHERE mortal_id = 'mortal'").get(), undefined);
    assert.deepEqual(
      db.prepare(`
        SELECT mortal_id, character_id
        FROM binder_player_characters
        WHERE mortal_id = 'mortal'
      `).get(),
      { mortal_id: "mortal", character_id: "character" },
    );

    db.prepare("DELETE FROM user_characters WHERE id = 'character'").run();
    assert.deepEqual(
      db.prepare(`
        SELECT mortal_id, character_id
        FROM binder_player_characters
        WHERE mortal_id = 'mortal'
      `).get(),
      { mortal_id: "mortal", character_id: null },
    );
    assertMortalHasExactlyOneSubtype(db, "mortal");

    createMortal(db, {
      binderId: "binder",
      name: "External-sheet hero",
      nameKey: "external sheet hero",
      subtype: { type: "player_character", characterId: null },
    }, { recordId: "unlinked-pc" }, 4);
    assertMortalHasExactlyOneSubtype(db, "unlinked-pc");
    assert.equal(
      db.prepare(`
        SELECT character_id
        FROM binder_player_characters
        WHERE mortal_id = 'unlinked-pc'
      `).pluck().get(),
      null,
    );
  });
});
