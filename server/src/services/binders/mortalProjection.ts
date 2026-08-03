import type { Db } from "../../lib/db.js";

export type MortalRow = {
  id: string; binder_id: string; visibility: "dm" | "campaign" | "public"; name: string;
  mortal_type: "npc" | "player_character"; race_id: string | null; race_name: string | null;
  gender: string | null; life_status: string | null; birth_date_text: string | null;
  death_date_text: string | null; residence_record_id: string | null; location_name: string | null;
  class_name: string | null; description: string | null; backstory: string | null;
  dm_notes: string | null; image_url: string | null; image_updated_at: number | null;
  monster_id: string | null; hp_max: number | null; hp_current: number | null;
  hp_details: string | null; ac: number | null; ac_details: string | null;
  attack_overrides_json: string | null; character_id: string | null; player_id: string | null;
  player_name: string | null; player_character_name: string | null; character_data_json: string | null;
  organization_id: string | null; organization_name: string | null; organization_icon: string | null;
  position_id: string | null; position_name: string | null; position_icon: string | null;
  created_at: number; updated_at: number;
};

const binderRouteForType: Record<string, string> = {
  mortal: "mortals", deity: "deities", race: "races", position: "positions",
  organization: "organizations", domain: "domains", continent: "continents",
  country: "countries", location: "locations", poi: "points-of-interest", event: "events",
};

function resolveImportedBinderLinks(value: string | null, binderId: string, db: Db): string | null {
  if (!value) return value;
  return value.replace(/\[([^\]]+)\]\((?:[^)\s]*?)([0-9a-f]{32})\.md\)/gi,
    (original, label: string, externalId: string) => {
      const target = db.prepare(`
        SELECT external.record_id AS id, record.record_type AS type
        FROM binder_external_ids external
        JOIN binder_records record ON record.id = external.record_id
        WHERE external.binder_id = ? AND external.source = 'notion' AND external.external_id = ?
        LIMIT 1
      `).get(binderId, externalId.toLocaleLowerCase()) as { id: string; type: string } | undefined;
      const route = target ? binderRouteForType[target.type] : null;
      return target && route ? `[${label}](/binder/${binderId}/${route}/${target.id})` : original;
    });
}

export const SELECT_MORTAL = `
  SELECT m.id, br.binder_id, br.name, br.visibility, m.mortal_type, m.race_id,
         race_record.name AS race_name, m.gender, m.life_status,
         m.birth_date_text, m.death_date_text, m.residence_record_id,
         location_record.name AS location_name, m.class_name, m.description, m.backstory,
         m.dm_notes, m.image_url, m.image_updated_at, npc.monster_id,
         npc.hp_max, npc.hp_current, npc.hp_details, npc.ac, npc.ac_details,
         npc.attack_overrides_json, pc.character_id, pc.player_id, player.player_name,
         player.character_name AS player_character_name, character.character_data_json,
         membership.organization_id, organization_record.name AS organization_name,
         organization_icon.icon AS organization_icon, m.position_id AS position_id,
         position_record.name AS position_name, position_icon.icon AS position_icon,
         br.created_at, br.updated_at
  FROM mortals m
  JOIN binder_records br ON br.id = m.id
  LEFT JOIN binder_records race_record ON race_record.id = m.race_id
  LEFT JOIN binder_npcs npc ON npc.mortal_id = m.id
  LEFT JOIN binder_player_characters pc ON pc.mortal_id = m.id
  LEFT JOIN players player ON player.id = pc.player_id
  LEFT JOIN user_characters character ON character.id = pc.character_id
  LEFT JOIN binder_records location_record ON location_record.id = m.residence_record_id
  LEFT JOIN organization_memberships membership ON membership.mortal_id = m.id AND membership.is_primary = 1
  LEFT JOIN binder_records organization_record ON organization_record.id = membership.organization_id
  LEFT JOIN binder_organizations organization_icon ON organization_icon.id = membership.organization_id
  LEFT JOIN binder_records position_record ON position_record.id = m.position_id
  LEFT JOIN binder_positions position_icon ON position_icon.id = m.position_id
`;

export function toMortalDto(row: MortalRow, db: Db) {
  let characterData: Record<string, unknown> = {};
  try { characterData = JSON.parse(row.character_data_json ?? "{}") as Record<string, unknown>; } catch { /* optional */ }
  const personalText = (key: "hair" | "height" | "weight" | "skin") => {
    const value = characterData[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const organizations = db.prepare(`
    SELECT om.organization_id AS id, organization_record.name, organization_icon.icon AS icon, om.is_primary AS isPrimary
    FROM organization_memberships om
    JOIN binder_records organization_record ON organization_record.id = om.organization_id
    LEFT JOIN binder_organizations organization_icon ON organization_icon.id = om.organization_id
    WHERE om.mortal_id = ? ORDER BY om.is_primary DESC, organization_record.name_key, om.id
  `).all(row.id).map((membership: any) => ({ id: membership.id, name: membership.name, icon: membership.icon, isPrimary: membership.isPrimary === 1 }));
  const continent = row.residence_record_id ? db.prepare(`
    WITH RECURSIVE ancestry(id) AS (
      SELECT ? UNION ALL
      SELECT CASE parent_record.record_type
        WHEN 'country' THEN (SELECT continent_id FROM binder_countries WHERE id = parent_record.id)
        WHEN 'location' THEN (SELECT COALESCE(continent_id, country_id) FROM binder_locations WHERE id = parent_record.id)
        WHEN 'poi' THEN (SELECT COALESCE(location_id, country_id, parent_poi_id) FROM binder_points_of_interest WHERE id = parent_record.id)
        ELSE NULL END
      FROM ancestry JOIN binder_records parent_record ON parent_record.id = ancestry.id
      WHERE parent_record.record_type <> 'continent'
    )
    SELECT br.id, br.name FROM ancestry JOIN binder_records br ON br.id = ancestry.id
    WHERE br.record_type = 'continent' LIMIT 1
  `).get(row.residence_record_id) as { id: string; name: string } | undefined : undefined;
  return {
    id: row.id, binderId: row.binder_id, visibility: row.visibility, name: row.name,
    mortalType: row.mortal_type, race: row.race_id ? { id: row.race_id, name: row.race_name! } : null,
    gender: row.gender, lifeStatus: row.death_date_text ? "dead" : "alive",
    birthDate: row.birth_date_text, deathDate: row.death_date_text,
    location: row.residence_record_id ? { id: row.residence_record_id, name: row.location_name! } : null,
    continent: continent ?? null,
    organization: row.organization_id ? { id: row.organization_id, name: row.organization_name!, icon: row.organization_icon } : null,
    organizations, position: row.position_id ? { id: row.position_id, name: row.position_name!, icon: row.position_icon } : null,
    className: row.mortal_type === "player_character" ? row.class_name : null,
    personal: row.mortal_type === "player_character" ? { hair: personalText("hair"), height: personalText("height"), weight: personalText("weight"), skin: personalText("skin") } : null,
    notes: resolveImportedBinderLinks(row.description ?? row.backstory, row.binder_id, db), dmNotes: row.dm_notes,
    imageUrl: row.image_url, imageUpdatedAt: row.image_updated_at, monsterId: row.monster_id,
    npcMechanics: row.mortal_type === "npc" ? { hpMax: row.hp_max, hpCurrent: row.hp_current, hpDetails: row.hp_details, ac: row.ac, acDetails: row.ac_details, attackOverrides: row.attack_overrides_json ? JSON.parse(row.attack_overrides_json) : null } : null,
    characterId: row.character_id,
    player: row.player_id ? { id: row.player_id, playerName: row.player_name, characterName: row.player_character_name } : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
