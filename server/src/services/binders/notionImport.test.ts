import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { zipSync, strToU8 } from "fflate";
import { openDb } from "../../lib/db.js";
import { importNotionZip } from "./notionImport.js";

const racePageId = "11111111111111111111111111111111";
const mortalPageId = "22222222222222222222222222222222";

function fixtureZip() {
  return Buffer.from(zipSync({
    [`Back Up/Human ${racePageId}.md`]: strToU8("# Human\nA common ancestry."),
    [`Back Up/Aela ${mortalPageId}.md`]: strToU8("# Aela\nA shopkeeper."),
    "Back Up/Races aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_all.csv": strToU8(
      "Race Name,Mortals,Player Characters\nHuman,,\n",
    ),
    "Back Up/Positions bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb_all.csv": strToU8(
      "Position Name,Mortals,Related to Player Characters\nNone,,\n",
    ),
    "Back Up/Mortals cccccccccccccccccccccccccccccccc_all.csv": strToU8(
      `Name,DoB,DoD,Gender,Race,Location,Organization,Position\nAela,"2,400",,Female,Human (https://www.notion.so/${racePageId}?pvs=21),,,\n`,
    ),
    "Back Up/Global Variables dddddddddddddddddddddddddddddddd_all.csv": strToU8(
      'Name,currDate\nCONST,"2,438"\n',
    ),
  }));
}

test("Notion Binder import previews safely, imports atomically, and prevents duplicates", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-notion-"));
  const db = openDb(path.join(directory, "test.db"));
  try {
    db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('owner', 'owner', 'x', 'Owner', 0, 1, 1)").run();
    db.prepare(`
      INSERT INTO binders (id, owner_user_id, name, name_key, current_date_text, current_date_sort, created_at, updated_at)
      VALUES ('binder', 'owner', 'Tarentha', 'tarentha', '2400', 2400, 1, 1)
    `).run();
    const zip = fixtureZip();
    const preview = importNotionZip(db, "binder", zip, false);
    assert.equal(preview.committed, false);
    assert.equal(preview.detectedCurrentDate, 2438);
    assert.equal(preview.records.race, 1);
    assert.equal(preview.records.position ?? 0, 0);
    assert.equal(db.prepare("SELECT COUNT(*) FROM binder_records").pluck().get(), 0);

    const imported = importNotionZip(db, "binder", zip, true);
    assert.equal(imported.committed, true);
    assert.equal(db.prepare("SELECT COUNT(*) FROM binder_records").pluck().get(), 2);
    assert.deepEqual(
      db.prepare(`
        SELECT br.name, m.mortal_type, m.gender, m.birth_date_sort, race.name AS race_name
        FROM mortals m
        JOIN binder_records br ON br.id = m.id
        LEFT JOIN binder_records race ON race.id = m.race_id
      `).get(),
      { name: "Aela", mortal_type: "npc", gender: "female", birth_date_sort: 2400, race_name: "Human" },
    );
    assert.equal(db.prepare("SELECT current_date_sort FROM binders WHERE id = 'binder'").pluck().get(), 2438);

    const repeated = importNotionZip(db, "binder", zip, true);
    assert.equal(repeated.alreadyImported, true);
    assert.equal(repeated.committed, false);
    assert.equal(db.prepare("SELECT COUNT(*) FROM binder_records").pluck().get(), 2);
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
