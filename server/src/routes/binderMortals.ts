import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../server/context.js";
import { binderEditorOrAdmin, binderReaderOrAdmin } from "../middleware/binderAuth.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { convertMortalSubtype, createMortal } from "../services/binders/mortals.js";
import { ACCEPTED_IMAGE_TYPES, deleteImageFiles, resizeToWebP } from "../lib/imageHelpers.js";
import {
  hydrateLinkedMortalFromCharacter,
  syncLinkedCharacterAgeFromMortal,
  syncLinkedCharacterNameFromMortal,
  syncLinkedCharacterPortraitFromMortal,
} from "../services/binders/linkedCharacterSync.js";
import { absolutizePublicUrlForRequest } from "../lib/publicUrl.js";
import { extractDetails, extractLeadingNumber } from "../lib/text.js";

const optionalText = (max: number) => z.string().max(max).nullable().optional().transform((value) => {
  if (value === undefined || value === null) return value;
  return value.trim() === "" ? null : value.trim();
});

const MortalBody = z.object({
  name: z.string().trim().min(1).max(160),
  mortalType: z.enum(["npc", "player_character"]),
  raceId: z.string().trim().min(1).nullable().optional(),
  gender: z.enum(["male", "female"]).nullable().optional(),
  birthDate: optionalText(100),
  deathDate: optionalText(100),
  locationId: z.string().trim().min(1).nullable().optional(),
  organizationId: z.string().trim().min(1).nullable().optional(),
  positionId: z.string().trim().min(1).nullable().optional(),
  className: optionalText(160),
  notes: optionalText(200_000),
  dmNotes: optionalText(200_000),
  playerId: z.string().trim().min(1).nullable().optional(),
  monsterId: z.string().trim().min(1).nullable().optional(),
  hpMax: z.number().int().min(1).optional(),
  hpCurrent: z.number().int().min(0).optional(),
  hpDetails: optionalText(500),
  ac: z.number().int().min(0).optional(),
  acDetails: optionalText(500),
  attackOverrides: z.record(z.string(), z.object({
    toHit: z.number().optional(), damage: z.string().optional(), damageType: z.string().optional(),
  }).strict()).nullable().optional(),
  visibility: z.enum(["dm", "public"]).optional(),
}).strict();

const MortalPatchBody = MortalBody.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one field is required" },
);

type MortalRow = {
  id: string;
  binder_id: string;
  visibility: "dm" | "campaign" | "public";
  name: string;
  mortal_type: "npc" | "player_character";
  race_id: string | null;
  race_name: string | null;
  gender: string | null;
  life_status: string | null;
  birth_date_text: string | null;
  death_date_text: string | null;
  residence_record_id: string | null;
  location_name: string | null;
  class_name: string | null;
  description: string | null;
  backstory: string | null;
  dm_notes: string | null;
  image_url: string | null;
  image_updated_at: number | null;
  monster_id: string | null;
  hp_max: number | null;
  hp_current: number | null;
  hp_details: string | null;
  ac: number | null;
  ac_details: string | null;
  attack_overrides_json: string | null;
  character_id: string | null;
  player_id: string | null;
  player_name: string | null;
  player_character_name: string | null;
  character_data_json: string | null;
  organization_id: string | null;
  organization_name: string | null;
  organization_icon: string | null;
  position_id: string | null;
  position_name: string | null;
  position_icon: string | null;
  created_at: number;
  updated_at: number;
};

const binderRouteForType: Record<string, string> = {
  mortal: "mortals",
  deity: "deities",
  race: "races",
  position: "positions",
  organization: "organizations",
  domain: "domains",
  continent: "continents",
  country: "countries",
  location: "locations",
  poi: "points-of-interest",
  event: "events",
};

function resolveImportedBinderLinks(value: string | null, binderId: string, db: ServerContext["db"]): string | null {
  if (!value) return value;
  return value.replace(
    /\[([^\]]+)\]\((?:[^)\s]*?)([0-9a-f]{32})\.md\)/gi,
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
    },
  );
}

const SELECT_MORTAL = `
  SELECT m.id, br.binder_id, br.name, br.visibility, m.mortal_type, m.race_id,
         race_record.name AS race_name, m.gender, m.life_status,
         m.birth_date_text, m.death_date_text, m.residence_record_id,
         location_record.name AS location_name, m.class_name, m.description, m.backstory,
         m.dm_notes, m.image_url, m.image_updated_at, npc.monster_id,
         npc.hp_max, npc.hp_current, npc.hp_details, npc.ac, npc.ac_details,
         npc.attack_overrides_json,
         pc.character_id, pc.player_id, player.player_name,
         player.character_name AS player_character_name,
         character.character_data_json,
         membership.organization_id, organization_record.name AS organization_name,
         organization_icon.icon AS organization_icon,
         m.position_id AS position_id,
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
  LEFT JOIN organization_memberships membership
    ON membership.mortal_id = m.id AND membership.is_primary = 1
  LEFT JOIN binder_records organization_record ON organization_record.id = membership.organization_id
  LEFT JOIN binder_organizations organization_icon ON organization_icon.id = membership.organization_id
  LEFT JOIN binder_records position_record ON position_record.id = m.position_id
  LEFT JOIN binder_positions position_icon ON position_icon.id = m.position_id
`;

function dto(row: MortalRow, db: ServerContext["db"]) {
  let characterData: Record<string, unknown> = {};
  try { characterData = JSON.parse(row.character_data_json ?? "{}") as Record<string, unknown>; }
  catch { /* malformed optional character data contributes no personal fields */ }
  const personalText = (key: "hair" | "height" | "weight" | "skin") => {
    const value = characterData[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const organizations = db.prepare(`
    SELECT om.organization_id AS id, organization_record.name, organization_icon.icon AS icon,
           om.is_primary AS isPrimary
    FROM organization_memberships om
    JOIN binder_records organization_record ON organization_record.id = om.organization_id
    LEFT JOIN binder_organizations organization_icon ON organization_icon.id = om.organization_id
    WHERE om.mortal_id = ?
    ORDER BY om.is_primary DESC, organization_record.name_key, om.id
  `).all(row.id).map((membership: any) => ({
    id: membership.id,
    name: membership.name,
    icon: membership.icon,
    isPrimary: membership.isPrimary === 1,
  }));
  const continent = row.residence_record_id ? db.prepare(`
    WITH RECURSIVE ancestry(id) AS (
      SELECT ?
      UNION ALL
      SELECT CASE parent_record.record_type
        WHEN 'country' THEN (SELECT continent_id FROM binder_countries WHERE id = parent_record.id)
        WHEN 'location' THEN (
          SELECT COALESCE(continent_id, country_id)
          FROM binder_locations WHERE id = parent_record.id
        )
        WHEN 'poi' THEN (
          SELECT COALESCE(location_id, country_id, parent_poi_id)
          FROM binder_points_of_interest WHERE id = parent_record.id
        )
        ELSE NULL
      END
      FROM ancestry
      JOIN binder_records parent_record ON parent_record.id = ancestry.id
      WHERE parent_record.record_type <> 'continent'
    )
    SELECT br.id, br.name
    FROM ancestry
    JOIN binder_records br ON br.id = ancestry.id
    WHERE br.record_type = 'continent'
    LIMIT 1
  `).get(row.residence_record_id) as { id: string; name: string } | undefined : undefined;
  return {
    id: row.id,
    binderId: row.binder_id,
    visibility: row.visibility,
    name: row.name,
    mortalType: row.mortal_type,
    race: row.race_id ? { id: row.race_id, name: row.race_name! } : null,
    gender: row.gender,
    lifeStatus: row.death_date_text ? "dead" : "alive",
    birthDate: row.birth_date_text,
    deathDate: row.death_date_text,
    location: row.residence_record_id ? { id: row.residence_record_id, name: row.location_name! } : null,
    continent: continent ?? null,
    organization: row.organization_id ? { id: row.organization_id, name: row.organization_name!, icon: row.organization_icon } : null,
    organizations,
    position: row.position_id ? { id: row.position_id, name: row.position_name!, icon: row.position_icon } : null,
    className: row.mortal_type === "player_character" ? row.class_name : null,
    personal: row.mortal_type === "player_character" ? {
      hair: personalText("hair"),
      height: personalText("height"),
      weight: personalText("weight"),
      skin: personalText("skin"),
    } : null,
    notes: resolveImportedBinderLinks(row.description ?? row.backstory, row.binder_id, db),
    dmNotes: row.dm_notes,
    imageUrl: row.image_url,
    imageUpdatedAt: row.image_updated_at,
    monsterId: row.monster_id,
    npcMechanics: row.mortal_type === "npc" ? {
      hpMax: row.hp_max, hpCurrent: row.hp_current, hpDetails: row.hp_details,
      ac: row.ac, acDetails: row.ac_details,
      attackOverrides: row.attack_overrides_json ? JSON.parse(row.attack_overrides_json) : null,
    } : null,
    characterId: row.character_id,
    player: row.player_id ? {
      id: row.player_id,
      playerName: row.player_name,
      characterName: row.player_character_name,
    } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isValidRace(ctx: ServerContext, binderId: string, raceId: string | null | undefined): boolean {
  if (!raceId) return true;
  return Boolean(ctx.db.prepare(`
    SELECT 1
    FROM binder_races race
    JOIN binder_records br ON br.id = race.id
    WHERE race.id = ? AND br.binder_id = ?
  `).get(raceId, binderId));
}

function isBinderRecordType(ctx: ServerContext, binderId: string, recordId: string | null | undefined, types: string[]): boolean {
  if (!recordId) return true;
  const placeholders = types.map(() => "?").join(", ");
  return Boolean(ctx.db.prepare(`
    SELECT 1 FROM binder_records
    WHERE id = ? AND binder_id = ? AND record_type IN (${placeholders})
  `).get(recordId, binderId, ...types));
}

function playerLink(ctx: ServerContext, binderId: string, playerId: string | null | undefined, mortalId?: string) {
  if (!playerId) return { playerId: null, characterId: null, imageUrl: null };
  return ctx.db.prepare(`
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

function isValidMonster(ctx: ServerContext, monsterId: string | null | undefined): boolean {
  if (!monsterId) return true;
  return Boolean(ctx.db.prepare("SELECT 1 FROM compendium_monsters WHERE id = ?").get(monsterId));
}

function compendiumMonsterMechanics(dataJson: string | null | undefined) {
  let monster: Record<string, any> = {};
  try { monster = JSON.parse(dataJson ?? "{}"); } catch { /* invalid legacy rows fall back safely */ }
  const hpMax = extractLeadingNumber(monster.hp)
    ?? extractLeadingNumber(monster.hitPoints?.average)
    ?? extractLeadingNumber(monster.hitPoints?.formula)
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

function replacePrimaryMembership(ctx: ServerContext, mortalId: string, organizationId: string | null, now: number) {
  ctx.db.prepare("DELETE FROM organization_memberships WHERE mortal_id = ? AND is_primary = 1").run(mortalId);
  if (!organizationId) return;
  ctx.db.prepare(`
    INSERT INTO organization_memberships (
      id, organization_id, mortal_id, position_id, is_primary, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(ctx.helpers.uid(), organizationId, mortalId, null, now, now);
}

export function registerBinderMortalRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const reader = binderReaderOrAdmin(db);
  const owner = binderEditorOrAdmin(db);

  app.get("/api/binders/:binderId/mortals", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const query = typeof req.query.q === "string" ? ctx.helpers.normalizeKey(req.query.q) : "";
    const rows = db.prepare(`
      ${SELECT_MORTAL}
      WHERE br.binder_id = ? AND (? = '' OR br.name_key LIKE ?)
      ORDER BY br.name_key, br.id
      LIMIT 500
    `).all(binderId, query, `%${query}%`) as MortalRow[];
    res.json(rows.map((row) => dto(row, db)));
  });

  app.get("/api/binders/:binderId/mortal-options", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const records = db.prepare(`
      SELECT br.id, br.record_type AS type, br.name,
             COALESCE(o.icon, p.icon, poi.icon) AS icon
      FROM binder_records br
      LEFT JOIN binder_organizations o ON o.id = br.id AND br.record_type = 'organization'
      LEFT JOIN binder_positions p ON p.id = br.id AND br.record_type = 'position'
      LEFT JOIN binder_points_of_interest poi ON poi.id = br.id AND br.record_type = 'poi'
      WHERE br.binder_id = ? AND br.record_type IN (
        'race', 'position', 'organization', 'continent', 'country', 'location', 'poi'
      )
      ORDER BY br.name_key, br.id
    `).all(binderId) as Array<{ id: string; type: string; name: string; icon: string | null }>;
    const playerRows = db.prepare(`
      SELECT p.id, p.player_name AS playerName, p.character_name AS characterName,
             p.class_name AS className,
             p.species, COALESCE(uc.image_url, p.image_url) AS imageUrl,
             uc.character_data_json AS characterDataJson,
             p.character_id AS characterId, c.name AS campaignName,
             c.current_date_sort AS campaignCurrentDate,
             linked.mortal_id AS linkedMortalId
      FROM players p
      JOIN campaigns c ON c.id = p.campaign_id
      LEFT JOIN user_characters uc ON uc.id = p.character_id
      LEFT JOIN binder_player_characters linked
        ON linked.player_id = p.id
        OR (p.character_id IS NOT NULL AND linked.character_id = p.character_id)
      WHERE c.binder_id = ?
      ORDER BY p.character_name COLLATE NOCASE, p.id
    `).all(binderId) as Array<Record<string, unknown>>;
    const groupedPlayerRows = new Map<string, Record<string, unknown> & { campaignNames: string[] }>();
    for (const player of playerRows) {
      const characterId = typeof player.characterId === "string" && player.characterId ? player.characterId : null;
      // Modern rows share the canonical Character id across Campaigns. Legacy
      // rows predate that link, so collapse only an exact player+character name
      // match instead of showing the same person once per Campaign.
      const identityKey = characterId
        ? `character:${characterId}`
        : `legacy:${ctx.helpers.normalizeKey(String(player.playerName ?? ""))}:${ctx.helpers.normalizeKey(String(player.characterName ?? ""))}`;
      const existing = groupedPlayerRows.get(identityKey);
      if (existing) {
        const campaignName = String(player.campaignName ?? "");
        if (campaignName && !existing.campaignNames.includes(campaignName)) existing.campaignNames.push(campaignName);
        if (!existing.linkedMortalId && player.linkedMortalId) existing.linkedMortalId = player.linkedMortalId;
        continue;
      }
      groupedPlayerRows.set(identityKey, { ...player, campaignNames: [String(player.campaignName ?? "")].filter(Boolean) });
    }
    const players = [...groupedPlayerRows.values()].map((player) => {
      let characterData: Record<string, unknown> = {};
      try {
        characterData = JSON.parse(String(player.characterDataJson ?? "{}")) as Record<string, unknown>;
      } catch { /* malformed legacy live data contributes no optional lore defaults */ }
      return {
        ...player,
        campaignName: player.campaignNames.join(", "),
        campaignNames: undefined,
        characterDataJson: undefined,
        age: typeof characterData.age === "string" || typeof characterData.age === "number" ? String(characterData.age) : null,
        gender: typeof characterData.gender === "string" ? characterData.gender.toLocaleLowerCase() : null,
      };
    });
    const monsterRows = db.prepare(`
      SELECT id, name, data_json AS dataJson
      FROM compendium_monsters
      ORDER BY name COLLATE NOCASE, id
    `).all() as Array<{ id: string; name: string; dataJson: string }>;
    const monsters = monsterRows.map(({ id, name, dataJson }) => ({ id, name, ...compendiumMonsterMechanics(dataJson) }));
    res.json({ records, players, monsters });
  });

  app.get("/api/binders/:binderId/mortals/:mortalId", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const mortalId = requireParam(req, res, "mortalId");
    if (!binderId || !mortalId) return;
    const row = db.prepare(`${SELECT_MORTAL} WHERE br.binder_id = ? AND m.id = ?`)
      .get(binderId, mortalId) as MortalRow | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Mortal not found" });
    res.json(dto(row, db));
  });

  app.post("/api/binders/:binderId/mortals", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const body = parseBody(MortalBody, req);
    if (!isValidRace(ctx, binderId, body.raceId)) {
      return res.status(400).json({ ok: false, message: "Race must belong to this Binder" });
    }
    if (!isBinderRecordType(ctx, binderId, body.locationId, ["continent", "country", "location", "poi"])) {
      return res.status(400).json({ ok: false, message: "Location must belong to this Binder" });
    }
    if (!isBinderRecordType(ctx, binderId, body.organizationId, ["organization"])) {
      return res.status(400).json({ ok: false, message: "Organization must belong to this Binder" });
    }
    if (!isBinderRecordType(ctx, binderId, body.positionId, ["position"])) {
      return res.status(400).json({ ok: false, message: "Position must belong to this Binder" });
    }
    if (!body.gender) {
      return res.status(400).json({ ok: false, message: "Gender must be Male or Female" });
    }
    const linkedPlayer = body.mortalType === "player_character" ? playerLink(ctx, binderId, body.playerId) : { playerId: null, characterId: null, imageUrl: null };
    if (body.playerId && !linkedPlayer) {
      return res.status(400).json({ ok: false, message: "Player must belong to a Campaign in this Binder" });
    }
    if (body.mortalType === "npc" && !isValidMonster(ctx, body.monsterId)) {
      return res.status(400).json({ ok: false, message: "Statblock must exist in the Compendium" });
    }
    const id = ctx.helpers.uid();
    const now = ctx.helpers.now();
    createMortal(db, {
      binderId,
      name: body.name,
      nameKey: ctx.helpers.normalizeKey(body.name),
      subtype: body.mortalType === "npc"
        ? { type: "npc", monsterId: body.monsterId ?? null }
        : { type: "player_character", characterId: null },
      raceId: body.raceId ?? null,
      gender: body.gender ?? null,
      lifeStatus: body.deathDate ? "dead" : "alive",
      description: body.notes ?? null,
      dmNotes: body.dmNotes ?? null,
    }, { recordId: id }, now);
    db.transaction(() => {
      db.prepare(`
        UPDATE mortals SET birth_date_text = ?, death_date_text = ?,
          life_status = ?, position_id = ?, class_name = ?,
          residence_record_id = ?, updated_at = ? WHERE id = ?
      `).run(body.birthDate ?? null, body.deathDate ?? null, body.deathDate ? "dead" : "alive", body.positionId ?? null, body.className ?? null, body.locationId ?? null, now, id);
      replacePrimaryMembership(ctx, id, body.organizationId ?? null, now);
      if (body.mortalType === "player_character") {
        db.prepare(`
          UPDATE binder_player_characters SET player_id = ?, character_id = ?, updated_at = ?
          WHERE mortal_id = ?
        `).run(linkedPlayer?.playerId ?? null, linkedPlayer?.characterId ?? null, now, id);
        hydrateLinkedMortalFromCharacter(db, id, now);
      } else {
        const monsterRow = body.monsterId
          ? db.prepare("SELECT data_json FROM compendium_monsters WHERE id=?").get(body.monsterId) as { data_json: string } | undefined
          : undefined;
        const mechanics = compendiumMonsterMechanics(monsterRow?.data_json);
        const hpMax = body.hpMax ?? mechanics.hpMax;
        const hpCurrent = Math.min(body.hpCurrent ?? hpMax, hpMax);
        const hpDetails = body.hpDetails ?? mechanics.hpDetails;
        const ac = body.ac ?? mechanics.ac;
        const acDetails = body.acDetails ?? mechanics.acDetails;
        db.prepare(`UPDATE binder_npcs SET hp_max=?,hp_current=?,hp_details=?,ac=?,ac_details=?,attack_overrides_json=?,updated_at=? WHERE mortal_id=?`)
          .run(hpMax, hpCurrent, hpDetails, ac, acDetails, body.attackOverrides ? JSON.stringify(body.attackOverrides) : null, now, id);
      }
    })();
    const row = db.prepare(`${SELECT_MORTAL} WHERE m.id = ?`).get(id) as MortalRow;
    res.status(201).json(dto(row, db));
  });

  app.patch("/api/binders/:binderId/mortals/:mortalId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const mortalId = requireParam(req, res, "mortalId");
    if (!binderId || !mortalId) return;
    const existing = db.prepare(`${SELECT_MORTAL} WHERE br.binder_id = ? AND m.id = ?`)
      .get(binderId, mortalId) as MortalRow | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Mortal not found" });
    const body = parseBody(MortalPatchBody, req);
    if (!isValidRace(ctx, binderId, body.raceId)) {
      return res.status(400).json({ ok: false, message: "Race must belong to this Binder" });
    }
    const nextOrganizationId = body.organizationId === undefined ? existing.organization_id : body.organizationId;
    const nextPositionId = body.positionId === undefined ? existing.position_id : body.positionId;
    if (!isBinderRecordType(ctx, binderId, body.locationId, ["continent", "country", "location", "poi"])) {
      return res.status(400).json({ ok: false, message: "Location must belong to this Binder" });
    }
    if (!isBinderRecordType(ctx, binderId, nextOrganizationId, ["organization"])) {
      return res.status(400).json({ ok: false, message: "Organization must belong to this Binder" });
    }
    if (!isBinderRecordType(ctx, binderId, nextPositionId, ["position"])) {
      return res.status(400).json({ ok: false, message: "Position must belong to this Binder" });
    }
    const nextType = body.mortalType ?? existing.mortal_type;
    const linkedPlayer = nextType === "player_character"
      ? playerLink(ctx, binderId, body.playerId === undefined ? existing.player_id : body.playerId, mortalId)
      : { playerId: null, characterId: null, imageUrl: null };
    const linkChanged = nextType === "player_character" && (
      (linkedPlayer?.playerId ?? null) !== (existing.player_id ?? null)
      || (linkedPlayer?.characterId ?? null) !== (existing.character_id ?? null)
    );
    if ((body.playerId ?? existing.player_id) && nextType === "player_character" && !linkedPlayer) {
      return res.status(400).json({ ok: false, message: "Player must belong to a Campaign in this Binder" });
    }
    const nextMonsterId = nextType === "npc"
      ? (body.monsterId === undefined ? existing.monster_id : body.monsterId)
      : null;
    if (!isValidMonster(ctx, nextMonsterId)) {
      return res.status(400).json({ ok: false, message: "Statblock must exist in the Compendium" });
    }
    const now = ctx.helpers.now();
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
      `).run(name, ctx.helpers.normalizeKey(name), body.visibility ?? existing.visibility, now, mortalId, binderId);
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
      replacePrimaryMembership(ctx, mortalId, nextOrganizationId ?? null, now);
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
    const row = db.prepare(`${SELECT_MORTAL} WHERE m.id = ?`).get(mortalId) as MortalRow;
    res.json(dto(row, db));
  });

  app.post("/api/binders/:binderId/mortals/:mortalId/image", owner, ctx.upload.single("image"), async (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const mortalId = requireParam(req, res, "mortalId");
    if (!binderId || !mortalId) return;
    const exists = db.prepare("SELECT 1 FROM binder_records WHERE id = ? AND binder_id = ? AND record_type = 'mortal'").get(mortalId, binderId);
    if (!exists) return res.status(404).json({ ok: false, message: "Mortal not found" });
    if (!req.file) return res.status(400).json({ ok: false, message: "No file" });
    if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) return res.status(400).json({ ok: false, message: "Unsupported image type" });
    let image: Buffer;
    try { image = await resizeToWebP(req.file.buffer); }
    catch { return res.status(400).json({ ok: false, message: "Could not process image" }); }
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "binder-mortal-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });
    deleteImageFiles(ctx, imagesDir, mortalId);
    const filename = `${mortalId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), image);
    const imageUrl = `/binder-mortal-images/${filename}`;
    const now = ctx.helpers.now();
    db.prepare("UPDATE mortals SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?").run(imageUrl, now, now, mortalId);
    syncLinkedCharacterPortraitFromMortal(db, mortalId, imageUrl, now);
    res.json({ ok: true, imageUrl: absolutizePublicUrlForRequest(req, imageUrl) });
  });

  app.delete("/api/binders/:binderId/mortals/:mortalId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const mortalId = requireParam(req, res, "mortalId");
    if (!binderId || !mortalId) return;
    const result = db.prepare(`
      DELETE FROM binder_records
      WHERE id = ? AND binder_id = ? AND record_type = 'mortal'
    `).run(mortalId, binderId);
    if (!result.changes) return res.status(404).json({ ok: false, message: "Mortal not found" });
    deleteImageFiles(ctx, ctx.path.join(ctx.paths.dataDir, "binder-mortal-images"), mortalId);
    res.json({ ok: true });
  });
}
