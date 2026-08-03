import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../../lib/db.js";
import { normalizeKey } from "../../lib/text.js";
import { exportBinderDocument, importBinderDocument, previewBinderDocument } from "./nativeBinder.js";

test("native Binder export/import remaps lore relationships and stable mentions", () => {
  const db = openDb(":memory:");
  try {
    db.prepare(`
      INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at)
      VALUES ('owner', 'owner', 'hash', 'Owner', 0, 1, 1)
    `).run();
    db.prepare(`
      INSERT INTO binders (id, owner_user_id, name, name_key, color, description, current_date_text, current_date_sort, created_at, updated_at)
      VALUES ('source', 'owner', 'Tarentha', 'tarentha', '#38b6ff', 'Setting', '2438', 2438, 1, 1)
    `).run();
    const addRecord = db.prepare(`
      INSERT INTO binder_records (id, binder_id, record_type, name, name_key, visibility, created_at, updated_at)
      VALUES (?, 'source', ?, ?, ?, 'dm', 1, 1)
    `);
    addRecord.run("race", "race", "Elf", "elf");
    addRecord.run("mortal", "mortal", "Aela", "aela");
    addRecord.run("org", "organization", "Silver Talon", "silver talon");
    db.prepare("INSERT INTO binder_races VALUES ('race', NULL, 1, 1)").run();
    db.prepare(`
      INSERT INTO mortals (
        id, race_id, gender, life_status, birth_date_text, birth_date_sort,
        death_date_text, death_date_sort, description, backstory, dm_notes,
        image_url, image_updated_at, residence_record_id, position_id,
        class_name, mortal_type, created_at, updated_at
      ) VALUES (
        'mortal', 'race', 'female', 'alive', '2400', 2400, NULL, NULL,
        '<p>Member of <span data-binder-record-id="org">Silver Talon</span>.</p>',
        NULL, 'Private', NULL, NULL, NULL, NULL, 'Ranger', 'npc', 1, 1
      )
    `).run();
    db.prepare("INSERT INTO binder_npcs (mortal_id, monster_id, created_at, updated_at) VALUES ('mortal', NULL, 1, 1)").run();
    db.prepare(`UPDATE binder_npcs SET hp_max=100,hp_current=73,hp_details='20d8+10',ac=18,ac_details='plate',attack_overrides_json='{"Rapier":{"toHit":9}}' WHERE mortal_id='mortal'`).run();
    db.prepare(`
      INSERT INTO binder_organizations (id, description, dm_notes, leader_mortal_id, headquarters_record_id, created_at, updated_at, icon)
      VALUES ('org', NULL, NULL, 'mortal', NULL, 1, 1, NULL)
    `).run();
    db.prepare(`
      INSERT INTO organization_memberships
        (id, organization_id, mortal_id, position_id, is_primary, created_at, updated_at)
      VALUES ('membership', 'org', 'mortal', NULL, 1, 1, 1)
    `).run();
    db.prepare(`
      INSERT INTO binder_record_mentions
        (id, source_record_id, source_field, target_record_id, label, occurrence_key, created_at)
      VALUES ('mention', 'mortal', 'description', 'org', 'Silver Talon', 'one', 1)
    `).run();

    const exported = exportBinderDocument(db, "source");
    assert.ok(exported);
    const binderCountBeforePreview = db.prepare("SELECT COUNT(*) FROM binders").pluck().get();
    const preview = previewBinderDocument(db, exported);
    assert.equal(preview.recordCount, 3);
    assert.deepEqual(preview.counts, [{ type: "mortal", count: 1 }, { type: "organization", count: 1 }, { type: "race", count: 1 }]);
    assert.equal(db.prepare("SELECT COUNT(*) FROM binders").pluck().get(), binderCountBeforePreview);
    let sequence = 0;
    const imported = importBinderDocument(db, exported, "owner", {
      uid: () => `new-${++sequence}`,
      now: () => 2,
      normalizeKey,
    });

    assert.notEqual(imported.binderId, "source");
    assert.equal(imported.recordCount, 3);
    const importedMortal = db.prepare(`
      SELECT m.id, m.race_id, m.description, m.class_name
      FROM mortals m JOIN binder_records r ON r.id = m.id
      WHERE r.binder_id = ? AND r.name = 'Aela'
    `).get(imported.binderId) as { id: string; race_id: string; description: string; class_name: string };
    const importedOrg = db.prepare(`
      SELECT o.id, o.leader_mortal_id
      FROM binder_organizations o JOIN binder_records r ON r.id = o.id
      WHERE r.binder_id = ? AND r.name = 'Silver Talon'
    `).get(imported.binderId) as { id: string; leader_mortal_id: string };
    assert.notEqual(importedMortal.id, "mortal");
    assert.notEqual(importedMortal.race_id, "race");
    assert.equal(importedOrg.leader_mortal_id, importedMortal.id);
    assert.equal(importedMortal.class_name, "Ranger");
    assert.deepEqual(
      db.prepare("SELECT hp_max,hp_current,ac,attack_overrides_json FROM binder_npcs WHERE mortal_id=?").get(importedMortal.id),
      { hp_max: 100, hp_current: 73, ac: 18, attack_overrides_json: '{"Rapier":{"toHit":9}}' },
    );
    assert.match(importedMortal.description, new RegExp(importedOrg.id));
    assert.doesNotMatch(importedMortal.description, /data-binder-record-id="org"/);
    assert.equal(
      db.prepare("SELECT COUNT(*) FROM organization_memberships WHERE organization_id = ? AND mortal_id = ?")
        .pluck().get(importedOrg.id, importedMortal.id),
      1,
    );
    assert.equal(
      db.prepare("SELECT target_record_id FROM binder_record_mentions WHERE source_record_id = ?").pluck().get(importedMortal.id),
      importedOrg.id,
    );
  } finally {
    db.close();
  }
});
