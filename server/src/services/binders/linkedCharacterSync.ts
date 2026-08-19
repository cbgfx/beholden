import type { Db } from "../../lib/db.js";

type LinkedRow = {
  mortal_id: string;
  character_id: string;
  reference_year: number | null;
};

function linkedRowsForCharacter(db: Db, characterId: string): LinkedRow[] {
  return db.prepare(`
    SELECT bpc.mortal_id, bpc.character_id,
           COALESCE(c.current_date_sort, b.current_date_sort) AS reference_year
    FROM binder_player_characters bpc
    JOIN mortals m ON m.id = bpc.mortal_id
    JOIN binder_records br ON br.id = m.id
    JOIN binders b ON b.id = br.binder_id
    LEFT JOIN players p ON p.id = bpc.player_id
    LEFT JOIN campaigns c ON c.id = p.campaign_id
    WHERE bpc.character_id = ?
  `).all(characterId) as LinkedRow[];
}

function linkedRowForMortal(db: Db, mortalId: string): LinkedRow | null {
  return (db.prepare(`
    SELECT bpc.mortal_id, bpc.character_id,
           COALESCE(c.current_date_sort, b.current_date_sort) AS reference_year
    FROM binder_player_characters bpc
    JOIN binder_records br ON br.id = bpc.mortal_id
    JOIN binders b ON b.id = br.binder_id
    LEFT JOIN players p ON p.id = bpc.player_id
    LEFT JOIN campaigns c ON c.id = p.campaign_id
    WHERE bpc.mortal_id = ? AND bpc.character_id IS NOT NULL
  `).get(mortalId) as LinkedRow | undefined) ?? null;
}

function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/** Character age is a projection onto the linked Mortal's historical date. */

// MARK: - Sync Linked Mortal Age From Character
export function syncLinkedMortalAgeFromCharacter(
  db: Db,
  characterId: string,
  characterData: Record<string, unknown> | null,
  updatedAt: number,
): void {
  const age = numeric(characterData?.age);
  for (const linked of linkedRowsForCharacter(db, characterId)) {
    if (linked.reference_year === null) continue;
    const birth = age === null ? null : linked.reference_year - age;
    db.prepare(`
      UPDATE mortals
      SET birth_date_text = ?, birth_date_sort = ?, updated_at = ?
      WHERE id = ?
    `).run(birth === null ? null : String(birth), birth, updatedAt, linked.mortal_id);
  }
}

/** Binder date of birth is projected back to the canonical character age. */

// MARK: - Sync Linked Character Age From Mortal
export function syncLinkedCharacterAgeFromMortal(db: Db, mortalId: string, updatedAt: number): void {
  const linked = linkedRowForMortal(db, mortalId);
  if (!linked || linked.reference_year === null) return;
  const mortal = db.prepare("SELECT birth_date_text FROM mortals WHERE id = ?").get(mortalId) as {
    birth_date_text: string | null;
  } | undefined;
  if (!mortal) return;
  const birth = numeric(mortal.birth_date_text);
  const character = db.prepare("SELECT character_data_json FROM user_characters WHERE id = ?").get(linked.character_id) as {
    character_data_json: string | null;
  } | undefined;
  if (!character) return;
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(character.character_data_json ?? "{}") as Record<string, unknown>; }
  catch { /* replace malformed optional character data with a valid object */ }
  if (birth === null) delete data.age;
  else data.age = Math.max(0, linked.reference_year - birth);
  db.prepare("UPDATE user_characters SET character_data_json = ?, updated_at = ? WHERE id = ?")
    .run(Object.keys(data).length ? JSON.stringify(data) : null, updatedAt, linked.character_id);
}

// MARK: - Sync Linked Mortal Portrait From Character
export function syncLinkedMortalPortraitFromCharacter(
  db: Db,
  characterId: string,
  imageUrl: string | null,
  imageUpdatedAt: number,
): void {
  db.prepare(`
    UPDATE mortals
    SET image_url = ?, image_updated_at = ?, updated_at = ?
    WHERE id IN (
      SELECT mortal_id FROM binder_player_characters WHERE character_id = ?
    )
  `).run(imageUrl, imageUpdatedAt, imageUpdatedAt, characterId);
}

/** Character name is shared by the sheet, its campaign projections, and every linked Binder Mortal. */

// MARK: - Sync Linked Mortal Name From Character
export function syncLinkedMortalNameFromCharacter(
  db: Db,
  characterId: string,
  name: string,
  nameKey: string,
  updatedAt: number,
): void {
  db.prepare(`
    UPDATE binder_records
    SET name = ?, name_key = ?, updated_at = ?
    WHERE id IN (
      SELECT mortal_id FROM binder_player_characters WHERE character_id = ?
    )
  `).run(name, nameKey, updatedAt, characterId);
}

/** A Binder rename of a linked PC updates the canonical sheet and all campaign projections. */

// MARK: - Sync Linked Character Name From Mortal
export function syncLinkedCharacterNameFromMortal(
  db: Db,
  mortalId: string,
  name: string,
  updatedAt: number,
): void {
  const linked = linkedRowForMortal(db, mortalId);
  if (!linked) return;
  db.prepare("UPDATE user_characters SET name = ?, updated_at = ? WHERE id = ?")
    .run(name, updatedAt, linked.character_id);
  db.prepare("UPDATE players SET character_name = ?, updated_at = ? WHERE character_id = ?")
    .run(name, updatedAt, linked.character_id);
}

// MARK: - Sync Linked Character Portrait From Mortal
export function syncLinkedCharacterPortraitFromMortal(
  db: Db,
  mortalId: string,
  imageUrl: string | null,
  imageUpdatedAt: number,
): void {
  const linked = linkedRowForMortal(db, mortalId);
  if (!linked) return;
  db.prepare("UPDATE user_characters SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?")
    .run(imageUrl, imageUpdatedAt, imageUpdatedAt, linked.character_id);
  db.prepare("UPDATE players SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE character_id = ?")
    .run(imageUrl, imageUpdatedAt, imageUpdatedAt, linked.character_id);
}

/** Apply all canonical character identity fields immediately after linking. */

// MARK: - Hydrate Linked Mortal From Character
export function hydrateLinkedMortalFromCharacter(db: Db, mortalId: string, updatedAt: number): void {
  const linked = linkedRowForMortal(db, mortalId);
  if (!linked) return;
  const character = db.prepare(`
    SELECT character_data_json, image_url, image_updated_at
    FROM user_characters WHERE id = ?
  `).get(linked.character_id) as {
    character_data_json: string | null;
    image_url: string | null;
    image_updated_at: number | null;
  } | undefined;
  if (!character) return;
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(character.character_data_json ?? "{}") as Record<string, unknown>; }
  catch { /* malformed optional data contributes no age */ }
  syncLinkedMortalAgeFromCharacter(db, linked.character_id, data, updatedAt);
  db.prepare("UPDATE mortals SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?")
    .run(character.image_url, character.image_updated_at ?? updatedAt, updatedAt, mortalId);
}

/** Reconcile links created before live two-way synchronization existed. */

// MARK: - Reconcile Linked Character Identities
export function reconcileLinkedCharacterIdentities(db: Db): void {
  const rows = db.prepare(`
    SELECT bpc.mortal_id, bpc.character_id, m.updated_at AS mortal_updated_at,
           m.image_url AS mortal_image_url, m.image_updated_at AS mortal_image_updated_at,
           uc.updated_at AS character_updated_at, uc.image_url AS character_image_url,
           uc.image_updated_at AS character_image_updated_at, uc.character_data_json
    FROM binder_player_characters bpc
    JOIN mortals m ON m.id = bpc.mortal_id
    JOIN user_characters uc ON uc.id = bpc.character_id
    WHERE bpc.character_id IS NOT NULL
  `).all() as Array<{
    mortal_id: string; character_id: string;
    mortal_updated_at: number; mortal_image_url: string | null; mortal_image_updated_at: number | null;
    character_updated_at: number; character_image_url: string | null; character_image_updated_at: number | null;
    character_data_json: string | null;
  }>;
  for (const row of rows) {
    const characterWinsPortrait =
      (row.character_image_updated_at ?? 0) >= (row.mortal_image_updated_at ?? 0);
    const portraitTime = Math.max(
      row.character_image_updated_at ?? 0,
      row.mortal_image_updated_at ?? 0,
      row.character_updated_at,
      row.mortal_updated_at,
    );
    if (characterWinsPortrait) {
      syncLinkedMortalPortraitFromCharacter(db, row.character_id, row.character_image_url, portraitTime);
    } else {
      syncLinkedCharacterPortraitFromMortal(db, row.mortal_id, row.mortal_image_url, portraitTime);
    }

    if (row.character_updated_at >= row.mortal_updated_at) {
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(row.character_data_json ?? "{}") as Record<string, unknown>; }
      catch { /* malformed optional data contributes no age */ }
      syncLinkedMortalAgeFromCharacter(db, row.character_id, data, row.character_updated_at);
    } else {
      syncLinkedCharacterAgeFromMortal(db, row.mortal_id, row.mortal_updated_at);
    }
  }
}
