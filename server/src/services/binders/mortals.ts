import type { Db } from "../../lib/db.js";
import { uid } from "../../lib/runtime.js";
import { normalizeKey, extractDetails, extractLeadingNumber } from "../../lib/text.js";
import type { MortalPatchBodyType } from "../../routes/binderMortals.js";
import type { MortalRow } from "./mortalProjection.js";
import {
  hydrateLinkedMortalFromCharacter,
  syncLinkedCharacterAgeFromMortal,
  syncLinkedCharacterNameFromMortal,
} from "./linkedCharacterSync.js";

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

export function isValidRace(db: Db, binderId: string, raceId: string | null | undefined): boolean {
  if (!raceId) return true;
  return Boolean(db.prepare(`
    SELECT 1
    FROM binder_races race
    JOIN binder_records br ON br.id = race.id
    WHERE race.id = ? AND br.binder_id = ?
  `).get(raceId, binderId));
}

export function isBinderRecordType(db: Db, binderId: string, recordId: string | null | undefined, types: string[]): boolean {
  if (!recordId) return true;
  const placeholders = types.map(() => "?").join(", ");
  return Boolean(db.prepare(`
    SELECT 1 FROM binder_records
    WHERE id = ? AND binder_id = ? AND record_type IN (${placeholders})
  `).get(recordId, binderId, ...types));
}

export function playerLink(db: Db, binderId: string, playerId: string | null | undefined, mortalId?: string) {
  if (!playerId) return { playerId: null, characterId: null, imageUrl: null };
  return db.prepare(`
    SELECT p.id AS playerId, p.character_id AS characterId, p.image_url AS imageUrl
    FROM players p
    JOIN campaigns c ON c.id = p.campaign_id
    LEFT JOIN binder_player_characters linked
      ON linked.player_id = p.id
      OR (p.character_id IS NOT NULL AND linked.character_id = p.character_id)
    WHERE p.id = ? AND c.binder_id = ?
      AND (linked.mortal_id IS NULL OR linked.mortal_id = ?)
  `).get(playerId, binderId, mortalId ?? "") as { playerId: string; characterId: string | null; imageUrl: string | null } | undefined;
}

export function isValidMonster(db: Db, monsterId: string | null | undefined): boolean {
  if (!monsterId) return true;
  return Boolean(db.prepare("SELECT 1 FROM compendium_monsters WHERE id = ?").get(monsterId));
}

export function compendiumMonsterMechanics(dataJson: string | null | undefined) {
  let monster: Record<string, any> = {};
  try { monster = JSON.parse(dataJson ?? "{}"); } catch { /* invalid legacy rows fall back safely */ }
  const hpMax = extractLeadingNumber(monster.hp)
    ?? extractLeadingNumber(monster.hitPoints?.average)
    ?? averageHitPointFormula(monster.hitPoints?.formula)
    ?? 1;
  const ac = extractLeadingNumber(monster.ac)
    ?? extractLeadingNumber(monster.armorClass?.value)
    ?? 10;
  return {
    hpMax,
    hpDetails: extractDetails(monster.hp) ?? (typeof monster.hitPoints?.formula === "string" ? monster.hitPoints.formula : null),
    ac,
    acDetails: extractDetails(monster.ac) ?? (typeof monster.armorClass?.source === "string" ? monster.armorClass.source : null),
  };
}

/** Grand statblocks may provide only a hit-dice formula; derive its rules-average HP. */
export function averageHitPointFormula(value: unknown): number | null {
  const match = String(value ?? "").trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/iu);
  if (!match) return null;
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const modifier = Number(match[4] || 0) * (match[3] === "-" ? -1 : 1);
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(sides) || sides < 1) return null;
  return Math.max(1, Math.floor(count * ((sides + 1) / 2) + modifier));
}

export function replaceMemberships(db: Db, mortalId: string, organizationIds: string[], now: number) {
  const selectedIds = [...new Set(organizationIds)];
  const existing = db.prepare(`
    SELECT id, organization_id
    FROM organization_memberships
    WHERE mortal_id = ?
    ORDER BY is_primary DESC, created_at, id
  `).all(mortalId) as Array<{ id: string; organization_id: string }>;
  const selected = new Set(selectedIds);
  const remove = db.prepare("DELETE FROM organization_memberships WHERE id = ?");
  for (const membership of existing) {
    if (!selected.has(membership.organization_id)) remove.run(membership.id);
  }

  const retainedByOrganization = new Map<string, string>();
  for (const membership of existing) {
    if (selected.has(membership.organization_id) && !retainedByOrganization.has(membership.organization_id)) {
      retainedByOrganization.set(membership.organization_id, membership.id);
    }
  }
  db.prepare("UPDATE organization_memberships SET is_primary = 0, updated_at = ? WHERE mortal_id = ?")
    .run(now, mortalId);
  const insert = db.prepare(`
    INSERT INTO organization_memberships (
      id, organization_id, mortal_id, is_primary, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const setPrimary = db.prepare("UPDATE organization_memberships SET is_primary = ?, updated_at = ? WHERE id = ?");
  selectedIds.forEach((organizationId, index) => {
    const retainedId = retainedByOrganization.get(organizationId);
    if (retainedId) setPrimary.run(index === 0 ? 1 : 0, now, retainedId);
    else insert.run(uid(), organizationId, mortalId, index === 0 ? 1 : 0, now, now);
  });
}

/**
 * Applies a validated PATCH to a Mortal: subtype conversion (if the type changed), the
 * binder_records/mortals field update, membership replacement, and the player-link or
 * NPC-mechanics branch (including the live-combatant snapshot cascade when a monster swap or
 * mechanics edit requires one). Input-validation-to-400 mapping (race/location/organization/
 * position/player/monster existence) stays in the route -- this only ever runs on
 * already-validated, already-resolved values.
 */
export function updateMortal(
  db: Db,
  binderId: string,
  mortalId: string,
  existing: MortalRow,
  body: MortalPatchBodyType,
  resolved: {
    nextOrganizationIds: string[];
    nextPositionId: string | null | undefined;
    nextType: "npc" | "player_character";
    linkedPlayer: { playerId: string | null; characterId: string | null; imageUrl: string | null } | undefined;
    nextMonsterId: string | null;
    linkChanged: boolean;
  },
  now: number,
): void {
  const { nextOrganizationIds, nextPositionId, nextType, linkedPlayer, nextMonsterId, linkChanged } = resolved;
  db.transaction(() => {
    if (body.mortalType && body.mortalType !== existing.mortal_type) {
      convertMortalSubtype(db, mortalId, body.mortalType === "npc"
        ? { type: "npc", monsterId: nextMonsterId }
        : { type: "player_character", characterId: null }, now);
    }
    const name = body.name ?? existing.name;
    db.prepare(`
      UPDATE binder_records
      SET name = ?, name_key = ?, visibility = ?, updated_at = ?
      WHERE id = ? AND binder_id = ?
    `).run(name, normalizeKey(name), body.visibility ?? existing.visibility, now, mortalId, binderId);
    db.prepare(`
      UPDATE mortals SET
        race_id = ?, gender = ?, life_status = ?, description = ?, dm_notes = ?,
        backstory = NULL, birth_date_text = ?, death_date_text = ?,
        position_id = ?, class_name = ?,
        residence_record_id = ?, updated_at = ?
      WHERE id = ?
    `).run(
      body.raceId === undefined ? existing.race_id : body.raceId,
      body.gender === undefined ? existing.gender : body.gender,
      (body.deathDate === undefined ? existing.death_date_text : body.deathDate) ? "dead" : "alive",
      body.notes === undefined ? (existing.description ?? existing.backstory) : body.notes,
      body.dmNotes === undefined ? existing.dm_notes : body.dmNotes,
      body.birthDate === undefined ? existing.birth_date_text : body.birthDate,
      body.deathDate === undefined ? existing.death_date_text : body.deathDate,
      nextPositionId ?? null,
      body.className === undefined ? existing.class_name : body.className,
      body.locationId === undefined ? existing.residence_record_id : body.locationId,
      now,
      mortalId,
    );
    replaceMemberships(db, mortalId, nextOrganizationIds, now);
    if (nextType === "player_character") {
      db.prepare(`
        UPDATE binder_player_characters SET player_id = ?, character_id = ?, updated_at = ?
        WHERE mortal_id = ?
      `).run(linkedPlayer?.playerId ?? null, linkedPlayer?.characterId ?? null, now, mortalId);
      if (linkChanged) hydrateLinkedMortalFromCharacter(db, mortalId, now);
      else if (body.birthDate !== undefined) syncLinkedCharacterAgeFromMortal(db, mortalId, now);
      if (body.name !== undefined) syncLinkedCharacterNameFromMortal(db, mortalId, name, now);
    } else {
      db.prepare(`
        UPDATE binder_npcs SET monster_id = ?, updated_at = ?
        WHERE mortal_id = ?
      `).run(nextMonsterId, now, mortalId);
      db.prepare(`
        UPDATE inpcs SET name = ?, monster_id = ?, updated_at = ?
        WHERE binder_mortal_id = ?
      `).run(name, nextMonsterId, now, mortalId);
      if (body.monsterId !== undefined && nextMonsterId !== existing.monster_id) {
        const monsterRow = nextMonsterId
          ? db.prepare("SELECT data_json FROM compendium_monsters WHERE id = ?").get(nextMonsterId) as { data_json: string } | undefined
          : undefined;
        const mechanics = compendiumMonsterMechanics(monsterRow?.data_json);
        const { hpMax, ac, hpDetails, acDetails } = mechanics;
        db.prepare(`
          UPDATE binder_npcs SET hp_max=?, hp_current=?, hp_details=?, ac=?, ac_details=?,
            attack_overrides_json=NULL, updated_at=? WHERE mortal_id=?
        `).run(hpMax, hpMax, hpDetails, ac, acDetails, now, mortalId);
        db.prepare(`
          UPDATE inpcs SET hp_max=?, hp_current=?, hp_details=?, ac=?, ac_details=?, updated_at=?
          WHERE binder_mortal_id=?
        `).run(hpMax, hpMax, hpDetails, ac, acDetails, now, mortalId);
        db.prepare(`
          UPDATE combatants SET
            snapshot_json=json_set(snapshot_json, '$.name', ?, '$.hpMax', ?, '$.hpDetails', ?, '$.ac', ?, '$.acDetails', ?, '$.attackOverrides', json('null')),
            live_json=json_set(live_json, '$.hpCurrent', ?), updated_at=?
          WHERE base_type='inpc' AND base_id IN (SELECT id FROM inpcs WHERE binder_mortal_id=?)
        `).run(name, hpMax, hpDetails, ac, acDetails, hpMax, now, mortalId);
      } else {
        db.prepare(`
          UPDATE combatants SET snapshot_json=json_set(snapshot_json, '$.name', ?), updated_at=?
          WHERE base_type='inpc' AND base_id IN (SELECT id FROM inpcs WHERE binder_mortal_id=?)
        `).run(name, now, mortalId);
      }
      const mechanicsChanged = body.hpMax !== undefined || body.hpCurrent !== undefined
        || body.hpDetails !== undefined || body.ac !== undefined || body.acDetails !== undefined
        || body.attackOverrides !== undefined;
      if (mechanicsChanged) {
        const canonical = db.prepare("SELECT * FROM binder_npcs WHERE mortal_id=?").get(mortalId) as Record<string, any>;
        const hpMax = body.hpMax ?? canonical.hp_max ?? 1;
        const hpCurrent = Math.min(body.hpCurrent ?? canonical.hp_current ?? hpMax, hpMax);
        const hpDetails = body.hpDetails !== undefined ? body.hpDetails : canonical.hp_details;
        const ac = body.ac ?? canonical.ac ?? 10;
        const acDetails = body.acDetails !== undefined ? body.acDetails : canonical.ac_details;
        const attacks = body.attackOverrides !== undefined
          ? (body.attackOverrides === null ? null : JSON.stringify(body.attackOverrides))
          : canonical.attack_overrides_json;
        db.prepare(`UPDATE binder_npcs SET hp_max=?,hp_current=?,hp_details=?,ac=?,ac_details=?,attack_overrides_json=?,updated_at=? WHERE mortal_id=?`)
          .run(hpMax, hpCurrent, hpDetails, ac, acDetails, attacks, now, mortalId);
        db.prepare(`UPDATE inpcs SET hp_max=?,hp_current=?,hp_details=?,ac=?,ac_details=?,updated_at=? WHERE binder_mortal_id=?`)
          .run(hpMax, hpCurrent, hpDetails, ac, acDetails, now, mortalId);
        db.prepare(`UPDATE combatants SET snapshot_json=json_set(snapshot_json,'$.hpMax',?,'$.hpDetails',?,'$.ac',?,'$.acDetails',?,'$.attackOverrides',json(?)),live_json=json_set(live_json,'$.hpCurrent',?),updated_at=? WHERE base_type='inpc' AND base_id IN (SELECT id FROM inpcs WHERE binder_mortal_id=?)`)
          .run(hpMax, hpDetails, ac, acDetails, JSON.stringify(body.attackOverrides ?? (attacks ? JSON.parse(attacks) : null)), hpCurrent, now, mortalId);
      }
    }
  })();
}
