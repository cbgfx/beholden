import type { Db } from "../../lib/db.js";

export type MortalSubtype =
  | { type: "npc"; monsterId?: string | null }
  | { type: "player_character"; characterId?: string | null };

export interface CreateMortalInput {
  binderId: string;
  name: string;
  nameKey: string;
  subtype: MortalSubtype;
  raceId?: string | null;
  gender?: string | null;
  lifeStatus?: string | null;
  description?: string | null;
  backstory?: string | null;
  dmNotes?: string | null;
}

/**
 * Creates the registry row, Mortal row, and exactly one explicit subtype in a
 * single transaction. Callers never create a bare Mortal.
 */
export function createMortal(
  db: Db,
  input: CreateMortalInput,
  ids: { recordId: string },
  now: number,
): string {
  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO binder_records (
        id, binder_id, record_type, name, name_key, visibility, created_at, updated_at
      ) VALUES (?, ?, 'mortal', ?, ?, 'dm', ?, ?)
    `).run(ids.recordId, input.binderId, input.name, input.nameKey, now, now);

    db.prepare(`
      INSERT INTO mortals (
        id, race_id, gender, life_status, description, backstory, dm_notes,
        mortal_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ids.recordId,
      input.raceId ?? null,
      input.gender ?? null,
      input.lifeStatus ?? null,
      input.description ?? null,
      input.backstory ?? null,
      input.dmNotes ?? null,
      input.subtype.type,
      now,
      now,
    );

    if (input.subtype.type === "npc") {
      db.prepare(`
        INSERT INTO binder_npcs (mortal_id, monster_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(ids.recordId, input.subtype.monsterId ?? null, now, now);
    } else {
      db.prepare(`
        INSERT INTO binder_player_characters (mortal_id, character_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(ids.recordId, input.subtype.characterId ?? null, now, now);
    }

    assertMortalHasExactlyOneSubtype(db, ids.recordId);
  });

  create();
  return ids.recordId;
}

/**
 * Converts a Mortal atomically. Mechanical links are optional and never
 * determine the explicit lore subtype.
 */
export function convertMortalSubtype(
  db: Db,
  mortalId: string,
  subtype: MortalSubtype,
  now: number,
): void {
  db.transaction(() => {
    if (subtype.type === "npc") {
      db.prepare("DELETE FROM binder_player_characters WHERE mortal_id = ?").run(mortalId);
      db.prepare("UPDATE mortals SET mortal_type = 'npc', updated_at = ? WHERE id = ?").run(now, mortalId);
      db.prepare(`
        INSERT INTO binder_npcs (mortal_id, monster_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(mortalId, subtype.monsterId ?? null, now, now);
    } else {
      db.prepare("DELETE FROM binder_npcs WHERE mortal_id = ?").run(mortalId);
      db.prepare("UPDATE mortals SET mortal_type = 'player_character', updated_at = ? WHERE id = ?").run(now, mortalId);
      db.prepare(`
        INSERT INTO binder_player_characters (mortal_id, character_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(mortalId, subtype.characterId ?? null, now, now);
    }
    assertMortalHasExactlyOneSubtype(db, mortalId);
  })();
}

export function assertMortalHasExactlyOneSubtype(db: Db, mortalId: string): void {
  const row = db.prepare(`
    SELECT m.mortal_type,
           EXISTS(SELECT 1 FROM binder_npcs n WHERE n.mortal_id = m.id) AS has_npc,
           EXISTS(
             SELECT 1 FROM binder_player_characters pc WHERE pc.mortal_id = m.id
           ) AS has_player_character
    FROM mortals m
    WHERE m.id = ?
  `).get(mortalId) as {
    mortal_type: "npc" | "player_character";
    has_npc: number;
    has_player_character: number;
  } | undefined;

  if (!row) throw new Error("Binder Mortal not found");
  const hasNpc = row.has_npc === 1;
  const hasPlayerCharacter = row.has_player_character === 1;
  if (
    hasNpc === hasPlayerCharacter
    || (row.mortal_type === "npc" && !hasNpc)
    || (row.mortal_type === "player_character" && !hasPlayerCharacter)
  ) {
    throw new Error("Binder Mortal must have exactly one matching subtype");
  }
}
