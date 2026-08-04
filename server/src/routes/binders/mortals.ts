import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../../server/context.js";
import { binderEditorOrAdmin, binderReaderOrAdmin } from "../../middleware/binderAuth.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import {
  createMortal,
  isValidRace,
  isBinderRecordType,
  playerLink,
  isValidMonster,
  compendiumMonsterMechanics,
  replaceMemberships,
  updateMortal,
} from "../../services/binders/mortals.js";
import { deleteImageFiles, prepareUploadedImage } from "../../lib/imageHelpers.js";
import {
  hydrateLinkedMortalFromCharacter,
  syncLinkedCharacterPortraitFromMortal,
} from "../../services/binders/linkedCharacterSync.js";
import { absolutizePublicUrlForRequest } from "../../lib/publicUrl.js";
import { EntityNameSchema } from "../../lib/schemas.js";
import { SELECT_MORTAL, toMortalDto as dto, type MortalRow } from "../../services/binders/mortalProjection.js";

const optionalText = (max: number) => z.string().max(max).nullable().optional().transform((value) => {
  if (value === undefined || value === null) return value;
  return value.trim() === "" ? null : value.trim();
});

const MortalBody = z.object({
  name: EntityNameSchema,
  mortalType: z.enum(["npc", "player_character"]),
  raceId: z.string().trim().min(1).nullable().optional(),
  gender: z.enum(["male", "female"]).nullable().optional(),
  birthDate: optionalText(100),
  deathDate: optionalText(100),
  locationId: z.string().trim().min(1).nullable().optional(),
  organizationId: z.string().trim().min(1).nullable().optional(),
  organizationIds: z.array(z.string().trim().min(1)).max(100).optional(),
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

export type MortalPatchBodyType = z.infer<typeof MortalPatchBody>;


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
    if (!isValidRace(db, binderId, body.raceId)) {
      return res.status(400).json({ ok: false, message: "Race must belong to this Binder" });
    }
    if (!isBinderRecordType(db, binderId, body.locationId, ["location", "poi"])) {
      return res.status(400).json({ ok: false, message: "A Mortal's Location must be a Location or Point of Interest in this Binder" });
    }
    const organizationIds = body.organizationIds ?? (body.organizationId ? [body.organizationId] : []);
    if (organizationIds.some((organizationId) => !isBinderRecordType(db, binderId, organizationId, ["organization"]))) {
      return res.status(400).json({ ok: false, message: "Organization must belong to this Binder" });
    }
    if (!isBinderRecordType(db, binderId, body.positionId, ["position"])) {
      return res.status(400).json({ ok: false, message: "Position must belong to this Binder" });
    }
    if (!body.gender) {
      return res.status(400).json({ ok: false, message: "Gender must be Male or Female" });
    }
    const linkedPlayer = body.mortalType === "player_character" ? playerLink(db, binderId, body.playerId) : { playerId: null, characterId: null, imageUrl: null };
    if (body.playerId && !linkedPlayer) {
      return res.status(400).json({ ok: false, message: "Player must belong to a Campaign in this Binder" });
    }
    if (body.mortalType === "npc" && !isValidMonster(db, body.monsterId)) {
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
      replaceMemberships(db, id, organizationIds, now);
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
    if (!isValidRace(db, binderId, body.raceId)) {
      return res.status(400).json({ ok: false, message: "Race must belong to this Binder" });
    }
    const existingOrganizationIds = (db.prepare(
      "SELECT organization_id FROM organization_memberships WHERE mortal_id = ? ORDER BY is_primary DESC, created_at, id",
    ).all(mortalId) as Array<{ organization_id: string }>).map((row) => row.organization_id);
    const nextOrganizationIds = body.organizationIds !== undefined
      ? body.organizationIds
      : body.organizationId !== undefined
        ? (body.organizationId ? [body.organizationId] : [])
        : existingOrganizationIds;
    const nextPositionId = body.positionId === undefined ? existing.position_id : body.positionId;
    if (!isBinderRecordType(db, binderId, body.locationId, ["location", "poi"])) {
      return res.status(400).json({ ok: false, message: "A Mortal's Location must be a Location or Point of Interest in this Binder" });
    }
    if (nextOrganizationIds.some((organizationId) => !isBinderRecordType(db, binderId, organizationId, ["organization"]))) {
      return res.status(400).json({ ok: false, message: "Organization must belong to this Binder" });
    }
    if (!isBinderRecordType(db, binderId, nextPositionId, ["position"])) {
      return res.status(400).json({ ok: false, message: "Position must belong to this Binder" });
    }
    const nextType = body.mortalType ?? existing.mortal_type;
    const linkedPlayer = nextType === "player_character"
      ? playerLink(db, binderId, body.playerId === undefined ? existing.player_id : body.playerId, mortalId)
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
    if (!isValidMonster(db, nextMonsterId)) {
      return res.status(400).json({ ok: false, message: "Statblock must exist in the Compendium" });
    }
    const now = ctx.helpers.now();
    updateMortal(db, binderId, mortalId, existing, body, {
      nextOrganizationIds,
      nextPositionId,
      nextType,
      linkedPlayer,
      nextMonsterId,
      linkChanged,
    }, now);
    const row = db.prepare(`${SELECT_MORTAL} WHERE m.id = ?`).get(mortalId) as MortalRow;
    res.json(dto(row, db));
  });

  app.post("/api/binders/:binderId/mortals/:mortalId/image", owner, ctx.upload.single("image"), async (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const mortalId = requireParam(req, res, "mortalId");
    if (!binderId || !mortalId) return;
    const exists = db.prepare("SELECT 1 FROM binder_records WHERE id = ? AND binder_id = ? AND record_type = 'mortal'").get(mortalId, binderId);
    if (!exists) return res.status(404).json({ ok: false, message: "Mortal not found" });
    const prepared = await prepareUploadedImage(req.file);
    if (!prepared.ok) return res.status(400).json({ ok: false, message: prepared.message });
    const image = prepared.image;
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
