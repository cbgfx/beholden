import type { Db } from "../../lib/db.js";
import { createMortal } from "./mortals.js";
import { hydrateLinkedMortalFromCharacter } from "./linkedCharacterSync.js";

export function ensureLinkedBinderMortalForCharacter(
  db: Db,
  characterId: string,
  helpers: { uid: () => string; now: () => number; normalizeKey: (value: string) => string },
): string | null {
  const directLink = db.prepare(`
    SELECT bpc.mortal_id,br.binder_id
    FROM binder_player_characters bpc JOIN binder_records br ON br.id=bpc.mortal_id
    WHERE bpc.character_id=?
  `).get(characterId) as { mortal_id: string; binder_id: string } | undefined;
  const binders = db.prepare(`
    SELECT DISTINCT c.binder_id AS binderId
    FROM players p JOIN campaigns c ON c.id = p.campaign_id
    WHERE p.character_id = ? AND c.binder_id IS NOT NULL
  `).all(characterId) as Array<{ binderId: string }>;
  if (!directLink && binders.length !== 1) return null;

  const character = db.prepare(`
    SELECT name, class_name AS className, species, character_data_json AS characterData,
           image_url AS imageUrl, image_updated_at AS imageUpdatedAt
    FROM user_characters WHERE id = ?
  `).get(characterId) as {
    name: string; className: string; species: string; characterData: string | null;
    imageUrl: string | null; imageUpdatedAt: number | null;
  } | undefined;
  if (!character) return null;
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(character.characterData ?? "{}") as Record<string, unknown>; } catch { /* optional data */ }
  const binderId = directLink?.binder_id ?? binders[0]!.binderId;
  const race = character.species.trim() ? db.prepare(`
    SELECT br.id FROM binder_races r JOIN binder_records br ON br.id = r.id
    WHERE br.binder_id = ? AND (br.name_key = ? OR EXISTS (
      SELECT 1 FROM binder_record_aliases a WHERE a.record_id=br.id AND a.alias_key=?
    )) LIMIT 1
  `).get(binderId, helpers.normalizeKey(character.species), helpers.normalizeKey(character.species)) as { id: string } | undefined : undefined;
  const player = db.prepare(`
    SELECT p.id FROM players p JOIN campaigns c ON c.id=p.campaign_id
    WHERE p.character_id=? AND c.binder_id=? ORDER BY p.created_at LIMIT 1
  `).get(characterId, binderId) as { id: string } | undefined;
  const t = helpers.now();
  const existing = db.prepare(`
    SELECT bpc.mortal_id
    FROM binder_player_characters bpc
    JOIN binder_records br ON br.id=bpc.mortal_id
    LEFT JOIN players linked_player ON linked_player.id=bpc.player_id
    WHERE br.binder_id=? AND (bpc.character_id=? OR linked_player.character_id=?)
    LIMIT 1
  `).get(binderId, characterId, characterId) as { mortal_id: string } | undefined;
  if (existing) {
    db.prepare(`UPDATE binder_player_characters SET character_id=?,player_id=COALESCE(?,player_id),updated_at=? WHERE mortal_id=?`)
      .run(characterId, player?.id ?? null, t, existing.mortal_id);
    db.prepare(`UPDATE mortals SET race_id=?,gender=?,class_name=?,image_url=?,image_updated_at=?,updated_at=? WHERE id=?`)
      .run(race?.id ?? null, typeof data.gender === "string" ? data.gender.trim() || null : null,
        character.className || null, character.imageUrl, character.imageUpdatedAt, t, existing.mortal_id);
    hydrateLinkedMortalFromCharacter(db, existing.mortal_id, t);
    return existing.mortal_id;
  }

  const id = helpers.uid();
  createMortal(db, {
    binderId, name: character.name, nameKey: helpers.normalizeKey(character.name),
    subtype: { type: "player_character", characterId }, raceId: race?.id ?? null,
    gender: typeof data.gender === "string" ? data.gender.trim() || null : null, lifeStatus: "alive",
  }, { recordId: id }, t);
  db.prepare(`UPDATE binder_player_characters SET player_id=?, updated_at=? WHERE mortal_id=?`)
    .run(player?.id ?? null, t, id);
  db.prepare(`UPDATE mortals SET class_name=?, image_url=?, image_updated_at=?, updated_at=? WHERE id=?`)
    .run(character.className || null, character.imageUrl, character.imageUpdatedAt, t, id);
  hydrateLinkedMortalFromCharacter(db, id, t);
  return id;
}
