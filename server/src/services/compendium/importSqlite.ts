// server/src/services/compendium/importSqlite.ts
// Imports compendium data from a Beholden SQLite database file.

import type Database from "better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backfillMonsterSpellRefs } from "./normalizeMonsterSpellRefs.js";

export function importCompendiumSqlite(args: {
  buffer: Buffer;
  db: Database.Database;
}): {
  imported: number;
  total: number;
  spells: number;
  items: number;
  classes: number;
  races: number;
  backgrounds: number;
  feats: number;
  decks: number;
} {
  const { buffer, db } = args;

  const tmpPath = path.join(os.tmpdir(), `beholden_import_${Date.now()}.sqlite`);

  try {
    fs.writeFileSync(tmpPath, buffer);
    const src = new BetterSqlite3(tmpPath, { readonly: true });

    const tableNames = new Set(
      (src.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
        .map((r) => r.name)
    );

    let monsters = 0, spells = 0, items = 0, classes = 0, races = 0, backgrounds = 0, feats = 0, decks = 0;

    db.transaction(() => {
      if (tableNames.has("compendium_monsters")) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_monsters (id, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const r of src.prepare("SELECT id, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json FROM compendium_monsters").all() as any[]) {
          stmt.run(r.id, r.name, r.name_key, r.cr, r.cr_numeric, r.type_key, r.type_full, r.size, r.environment, r.data_json);
          monsters++;
        }
      }

      if (tableNames.has("compendium_spells")) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_spells (id, name, name_key, level, school, ritual, concentration, components, classes, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const r of src.prepare("SELECT id, name, name_key, level, school, ritual, concentration, components, classes, data_json FROM compendium_spells").all() as any[]) {
          stmt.run(r.id, r.name, r.name_key, r.level, r.school, r.ritual, r.concentration, r.components, r.classes, r.data_json);
          spells++;
        }
      }

      if (tableNames.has("compendium_items")) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_items (id, name, name_key, rarity, type, type_key, attunement, magic, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const r of src.prepare("SELECT id, name, name_key, rarity, type, type_key, attunement, magic, data_json FROM compendium_items").all() as any[]) {
          stmt.run(r.id, r.name, r.name_key, r.rarity, r.type, r.type_key, r.attunement, r.magic, r.data_json);
          items++;
        }
      }

      if (tableNames.has("compendium_classes")) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_classes (id, name, name_key, hd, data_json) VALUES (?, ?, ?, ?, ?)"
        );
        for (const r of src.prepare("SELECT id, name, name_key, hd, data_json FROM compendium_classes").all() as any[]) {
          stmt.run(r.id, r.name, r.name_key, r.hd, r.data_json);
          classes++;
        }
      }

      if (tableNames.has("compendium_races")) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_races (id, name, name_key, size, speed, data_json) VALUES (?, ?, ?, ?, ?, ?)"
        );
        for (const r of src.prepare("SELECT id, name, name_key, size, speed, data_json FROM compendium_races").all() as any[]) {
          stmt.run(r.id, r.name, r.name_key, r.size, r.speed, r.data_json);
          races++;
        }
      }

      if (tableNames.has("compendium_backgrounds")) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_backgrounds (id, name, name_key, data_json) VALUES (?, ?, ?, ?)"
        );
        for (const r of src.prepare("SELECT id, name, name_key, data_json FROM compendium_backgrounds").all() as any[]) {
          stmt.run(r.id, r.name, r.name_key, r.data_json);
          backgrounds++;
        }
      }

      if (tableNames.has("compendium_feats")) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_feats (id, name, name_key, data_json) VALUES (?, ?, ?, ?)"
        );
        for (const r of src.prepare("SELECT id, name, name_key, data_json FROM compendium_feats").all() as any[]) {
          stmt.run(r.id, r.name, r.name_key, r.data_json);
          feats++;
        }
      }

      if (tableNames.has("compendium_deck_cards")) {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_deck_cards (id, deck_name, deck_key, card_name, card_key, card_text, sort_index) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        for (const r of src.prepare("SELECT id, deck_name, deck_key, card_name, card_key, card_text, sort_index FROM compendium_deck_cards").all() as any[]) {
          stmt.run(r.id, r.deck_name, r.deck_key, r.card_name, r.card_key, r.card_text, r.sort_index);
          decks++;
        }
      }

      backfillMonsterSpellRefs(db);
    })();

    src.close();

    const total = (db.prepare("SELECT count(*) AS n FROM compendium_monsters").get() as { n: number }).n;

    return { imported: monsters, total, spells, items, classes, races, backgrounds, feats, decks };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
  }
}
