// server/src/routes/characters.ts
// Player-owned characters: campaign-agnostic CRUD + campaign assignment.

import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import { cleanStoredImageUrl, normalizeCharacterSheetForStorage, rowToCharacterSheet, CHARACTER_SHEET_COLS } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { toCharacterCampaignAssignmentDto, toCharacterSheetDto } from "../../lib/apiActors.js";
import {
  getAssignments,
  getAssignmentsForCharacters,
  getCharacterSheetOverrides,
  assignmentsToJson,
  getAssignedPlayers,
  buildCampaignCharacterLiveState,
  buildMirroredPlayerSnapshot,
  characterSheetDbColumns,
  insertProjectedPlayerRow,
  mergeLiveStats,
  syncAssignedPlayerRows,
  updateProjectedPlayerRow,
} from "../../services/characters.js";
import { prepareUploadedImage } from "../../lib/imageHelpers.js";
import { absolutizePublicUrlForRequest } from "../../lib/publicUrl.js";
import { withAbsoluteImageUrl } from "../../lib/routeImageUrl.js";
import {
  syncLinkedMortalAgeFromCharacter,
  syncLinkedMortalNameFromCharacter,
  syncLinkedMortalPortraitFromCharacter,
} from "../../services/binders/linkedCharacterSync.js";
import { preserveForeignClassProficiencies, preserveProficienciesOnLevelUp } from "../../lib/levelUpProficiencies.js";
import {
  AssignBody,
  CharacterCreateBody,
  CharacterUpdateBody,
  UnassignBody,
  collectCampaignSharedNotes,
  requireOwnedCharacter,
  toCharacterSheetDtoInput,
  makeEmitPlayerChange,
} from "./helpers.js";
import { registerCharacterFieldPatchRoutes } from "./fieldPatchRoutes.js";
import { ensureLinkedBinderMortalForCharacter } from "../../services/binders/linkedPlayerIdentity.js";

const LinkedIdentityPatch = z.object({
  gender: z.string().trim().max(80).nullable().optional(),
  age: z.number().int().min(0).max(10_000).nullable().optional(),
  description: z.string().max(200_000).nullable().optional(),
  backstory: z.string().max(200_000).nullable().optional(),
}).strict().refine((body) => Object.keys(body).length > 0);

function identityRequirementError(characterData: Record<string, unknown> | null | undefined): string | null {
  const age = Number(String(characterData?.age ?? "").trim());
  if (!Number.isInteger(age) || age <= 0 || age > 10_000) return "Character age is required and must be a positive whole number";
  if (characterData?.gender !== "male" && characterData?.gender !== "female") return "Character gender is required";
  return null;
}

export function registerCharacterRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const accountNameFor = (userId: string): string => {
    const user = db.prepare("SELECT name FROM users WHERE id = ?").get(userId) as { name: string } | undefined;
    return String(user?.name ?? "").trim() || "Player";
  };
  const emitPlayerChange = makeEmitPlayerChange(ctx);

  registerCharacterFieldPatchRoutes(app, ctx);

  // List all user-owned characters with campaign assignment info

  // MARK: - GET /api/me/characters
  app.get("/api/me/characters", requireAuth, (req, res) => {
    const userId = req.user!.userId;
    const chars = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE user_id = ? ORDER BY updated_at DESC`)
      .all(userId) as Record<string, unknown>[];

    const sheets = chars.map((c) => rowToCharacterSheet(c));
    const assignmentsByChar = getAssignmentsForCharacters(db, sheets.map((s) => s.id));
    const result = sheets.map((char) => {
      const assignments = assignmentsByChar.get(char.id) ?? [];
      return withAbsoluteImageUrl(req, toCharacterSheetDto(
        toCharacterSheetDtoInput(
          mergeLiveStats(db, char, assignments),
          toCharacterCampaignAssignmentDto(assignmentsToJson(assignments)),
        ),
      ));
    });

    res.json(result);
  });

  // Get a single user-owned character

  // MARK: - GET /api/me/characters/:id
  app.get("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = req.user!.userId;
    const row = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });

    const char = rowToCharacterSheet(row);
    const assignments = getAssignments(db, char.id);
    const merged = mergeLiveStats(db, char, assignments);

    res.json(
      withAbsoluteImageUrl(req, toCharacterSheetDto(
        toCharacterSheetDtoInput(
          merged,
          toCharacterCampaignAssignmentDto(assignmentsToJson(assignments)),
          collectCampaignSharedNotes(db, assignments, charId),
        ),
      )),
    );
  });

  // MARK: - GET /api/me/characters/:id/binder-identity
  app.get("/api/me/characters/:id/binder-identity", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const row = db.prepare(`
      SELECT bpc.mortal_id AS id, br.binder_id AS binderId, b.name AS binderName,
             br.name, m.gender, COALESCE(m.description,m.backstory) AS backstory,
             m.image_url AS imageUrl, m.birth_date_sort AS birthDateSort,
             COALESCE(c.current_date_sort, b.current_date_sort) AS referenceYear,
             uc.character_data_json AS characterData
      FROM user_characters uc
      JOIN binder_player_characters bpc ON bpc.character_id=uc.id
      JOIN mortals m ON m.id=bpc.mortal_id
      JOIN binder_records br ON br.id=m.id
      JOIN binders b ON b.id=br.binder_id
      LEFT JOIN players p ON p.id=bpc.player_id
      LEFT JOIN campaigns c ON c.id=p.campaign_id
      WHERE uc.id=? AND uc.user_id=?
    `).get(charId, req.user!.userId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Linked Binder identity not found" });
    let characterData: Record<string, unknown> = {};
    try { characterData = JSON.parse(String(row.characterData ?? "{}")) as Record<string, unknown>; } catch { /* optional data */ }
    const storedAge = typeof characterData.age === "number" || typeof characterData.age === "string"
      ? Number(characterData.age) : Number.NaN;
    const calculatedAge = row.referenceYear != null && row.birthDateSort != null
      ? Number(row.referenceYear) - Number(row.birthDateSort) : null;
    res.json({
      id: row.id, binderId: row.binderId, binderName: row.binderName,
      name: row.name, gender: row.gender, backstory: row.backstory, imageUrl: row.imageUrl,
      age: Number.isFinite(storedAge) ? storedAge : calculatedAge,
    });
  });

  // MARK: - GET /api/me/characters/:id/binder
  app.get("/api/me/characters/:id/binder", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const access = db.prepare(`
      SELECT b.id AS binderId, b.name AS binderName, b.color, b.current_date_sort AS currentDateSort,
             bpc.mortal_id AS linkedMortalId
      FROM user_characters uc
      JOIN binder_player_characters bpc ON bpc.character_id=uc.id
      JOIN binder_records linked_record ON linked_record.id=bpc.mortal_id
      JOIN binders b ON b.id=linked_record.binder_id
      WHERE uc.id=? AND uc.user_id=?
    `).get(charId, req.user!.userId) as { binderId: string; binderName: string; color: string; currentDateSort: number | null; linkedMortalId: string } | undefined;
    if (!access) return res.status(404).json({ ok: false, message: "Linked Binder not found" });
    const mortals = db.prepare(`
      SELECT m.id, br.name, br.visibility, m.mortal_type AS mortalType,
             race.name AS species, m.gender, m.life_status AS lifeStatus,
             m.birth_date_text AS birthDate, m.birth_date_sort AS birthDateSort,
             m.death_date_sort AS deathDateSort, m.description, m.backstory,
             m.image_url AS imageUrl, m.image_updated_at AS imageUpdatedAt,
             location.name AS location,
             organization.name AS organization,
             organization_details.icon AS organizationIcon,
             position.name AS position,
             position_details.icon AS positionIcon
      FROM mortals m
      JOIN binder_records br ON br.id=m.id
      LEFT JOIN binder_records race ON race.id=m.race_id
      LEFT JOIN binder_records location ON location.id=m.residence_record_id
      LEFT JOIN organization_memberships membership ON membership.mortal_id=m.id AND membership.is_primary=1
      LEFT JOIN binder_records organization ON organization.id=membership.organization_id
      LEFT JOIN binder_organizations organization_details ON organization_details.id=membership.organization_id
      LEFT JOIN binder_records position ON position.id=m.position_id
      LEFT JOIN binder_positions position_details ON position_details.id=m.position_id
      WHERE br.binder_id=? AND (br.visibility='public' OR m.id=?)
      ORDER BY br.name_key, br.id
    `).all(access.binderId, access.linkedMortalId) as Array<Record<string, unknown>>;
    const campaigns = db.prepare(`
      SELECT DISTINCT c.id, c.name, COALESCE(c.current_date_text,b.current_date_text) AS currentDate,
             c.campaign_story AS story
      FROM players p
      JOIN campaigns c ON c.id=p.campaign_id
      JOIN binders b ON b.id=c.binder_id
      WHERE p.character_id=? AND c.binder_id=?
      ORDER BY c.name COLLATE NOCASE, c.id
    `).all(charId, access.binderId) as Array<Record<string, unknown>>;
    const publicRecords = db.prepare(`
      SELECT br.id, br.record_type AS type, br.name,
             COALESCE(deity.description,continent.description,country.description,location.description,poi.description) AS description,
             deity.rank, deity.image_url AS imageUrl, deity.image_updated_at AS imageUpdatedAt,
             CASE WHEN br.record_type='deity' THEN (
               SELECT GROUP_CONCAT(domain_record.name, '||')
               FROM deity_domains dd
               JOIN binder_records domain_record ON domain_record.id=dd.domain_id
               WHERE dd.deity_id=br.id
               ORDER BY domain_record.name_key
             ) END AS domains,
             COALESCE(country_parent.name,location_parent.name,poi_parent.name) AS parentName,
             poi.icon
      FROM binder_records br
      LEFT JOIN deities deity ON deity.id=br.id
      LEFT JOIN binder_continents continent ON continent.id=br.id
      LEFT JOIN binder_countries country ON country.id=br.id
      LEFT JOIN binder_locations location ON location.id=br.id
      LEFT JOIN binder_points_of_interest poi ON poi.id=br.id
      LEFT JOIN binder_records country_parent ON country_parent.id=country.continent_id
      LEFT JOIN binder_records location_parent ON location_parent.id=location.country_id
      LEFT JOIN binder_records poi_parent ON poi_parent.id=COALESCE(poi.location_id,poi.country_id,poi.parent_poi_id)
      WHERE br.binder_id=? AND br.visibility='public'
        AND br.record_type IN ('deity','continent','country','location','poi')
      ORDER BY br.record_type,br.name_key,br.id
    `).all(access.binderId) as Array<Record<string, unknown>>;
    res.json({
      binder: { id: access.binderId, name: access.binderName, color: access.color, currentDateSort: access.currentDateSort },
      linkedMortalId: access.linkedMortalId,
      campaigns,
      deities: publicRecords.filter((record) => record.type === "deity").map((record) => ({
        ...record,
        domains: record.domains ? String(record.domains).split("||") : [],
      })),
      places: publicRecords.filter((record) => record.type !== "deity"),
      mortals: mortals.map((mortal) => ({
        ...mortal,
        age: mortal.birthDateSort != null && (mortal.deathDateSort != null || access.currentDateSort != null)
          ? Math.max(0, Number(mortal.deathDateSort ?? access.currentDateSort) - Number(mortal.birthDateSort))
          : null,
        imageUrl: mortal.imageUrl ? String(mortal.imageUrl) : null,
      })),
    });
  });

  // MARK: - PATCH /api/me/characters/:id/binder-identity
  app.patch("/api/me/characters/:id/binder-identity", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const body = parseBody(LinkedIdentityPatch, req);
    const linked = db.prepare(`
      SELECT bpc.mortal_id AS mortalId, uc.character_data_json AS characterData
      FROM user_characters uc JOIN binder_player_characters bpc ON bpc.character_id=uc.id
      WHERE uc.id=? AND uc.user_id=?
    `).get(charId, req.user!.userId) as { mortalId: string; characterData: string | null } | undefined;
    if (!linked) return res.status(404).json({ ok: false, message: "Linked Binder identity not found" });
    const t = now();
    db.transaction(() => {
      const current = db.prepare("SELECT gender,description,backstory FROM mortals WHERE id=?").get(linked.mortalId) as Record<string, unknown>;
      db.prepare("UPDATE mortals SET gender=?,description=?,backstory=NULL,updated_at=? WHERE id=?").run(
        body.gender !== undefined ? body.gender : current.gender,
        body.backstory !== undefined
          ? body.backstory
          : body.description !== undefined
            ? body.description
            : current.description ?? current.backstory,
        t, linked.mortalId,
      );
      if (body.age !== undefined) {
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(linked.characterData ?? "{}") as Record<string, unknown>; } catch { /* replace malformed optional data */ }
        if (body.age === null) delete data.age; else data.age = body.age;
        db.prepare("UPDATE user_characters SET character_data_json=?,updated_at=? WHERE id=?")
          .run(Object.keys(data).length ? JSON.stringify(data) : null, t, charId);
        syncLinkedMortalAgeFromCharacter(db, charId, data, t);
      }
    })();
    res.json({ ok: true });
  });

  // MARK: - PATCH /api/me/characters/:id/activity
  app.patch("/api/me/characters/:id/activity", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const body = parseBody(z.object({ isActive: z.boolean() }).strict(), req);
    const result = db.prepare(`
      UPDATE user_characters
      SET is_active = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(body.isActive ? 1 : 0, now(), charId, req.user!.userId);
    if (result.changes === 0) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, isActive: body.isActive });
  });

  // Create a new user-owned character (no campaign required)

  // MARK: - POST /api/me/characters
  app.post("/api/me/characters", requireAuth, (req, res) => {
    const userId = req.user!.userId;
    const ownerName = accountNameFor(userId);
    const p = parseBody(CharacterCreateBody, req);
    const identityError = identityRequirementError(p.characterData);
    if (identityError) return res.status(400).json({ ok: false, message: identityError });
    const id = uid();
    const t = now();
    const normalized = normalizeCharacterSheetForStorage({
      name: p.name,
      playerName: ownerName,
      ruleset: p.ruleset,
      className: p.className ?? "",
      species: p.species ?? "",
      level: p.level ?? 1,
      hpMax: p.hpMax ?? 0,
      hpCurrent: p.hpCurrent ?? p.hpMax ?? 0,
      ac: p.ac ?? 10,
      speed: p.speed ?? 30,
      strScore: p.strScore ?? null,
      dexScore: p.dexScore ?? null,
      conScore: p.conScore ?? null,
      intScore: p.intScore ?? null,
      wisScore: p.wisScore ?? null,
      chaScore: p.chaScore ?? null,
      color: p.color ?? null,
    }, p.characterData ?? null);
    const sheetCols = characterSheetDbColumns(normalized.sheet);

    db.prepare(`
      INSERT INTO user_characters
        (id, user_id, name, player_name, ruleset, class_name, species, level, hp_max, hp_current, ac, speed,
         str_score, dex_score, con_score, int_score, wis_score, cha_score, color, death_saves_success, death_saves_fail,
         image_url, character_data_json, shared_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, '', ?, ?)
    `).run(
      id, userId, sheetCols.name, sheetCols.playerName, sheetCols.ruleset, sheetCols.className, sheetCols.species, sheetCols.level,
      sheetCols.hpMax, sheetCols.hpCurrent, sheetCols.ac, sheetCols.speed,
      sheetCols.strScore, sheetCols.dexScore, sheetCols.conScore, sheetCols.intScore, sheetCols.wisScore, sheetCols.chaScore,
      sheetCols.color, sheetCols.deathSavesSuccess, sheetCols.deathSavesFail,
      normalized.characterData ? JSON.stringify(normalized.characterData) : null,
      t, t,
    );

    const row = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json(withAbsoluteImageUrl(req, toCharacterSheetDto({ ...rowToCharacterSheet(row), campaigns: [] })));
  });

  // Update a user-owned character

  // MARK: - PUT /api/me/characters/:id
  app.put("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = req.user!.userId;
    const ownerName = accountNameFor(userId);
    const existing = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    const p = parseBody(CharacterUpdateBody, req);
    const t = now();
    const ex = rowToCharacterSheet(existing);
    const requestedCharacterData =
      p.characterData !== undefined
        ? (p.characterData === null ? null : { ...(ex.characterData ?? {}), ...p.characterData })
        : ex.characterData;
    const identityError = identityRequirementError(requestedCharacterData);
    if (identityError) return res.status(400).json({ ok: false, message: identityError });
    const levelSafeCharacterData = preserveProficienciesOnLevelUp(
      ex.characterData,
      requestedCharacterData,
      p.level !== undefined && p.level > ex.level,
    );
    const mergedCharacterData = preserveForeignClassProficiencies(
      ex.characterData,
      levelSafeCharacterData,
      p.progressionClassEntryId,
    );
    const nextSheet = {
      name: p.name ?? ex.name,
      playerName: ownerName,
      ruleset: ex.ruleset,
      className: p.className ?? ex.className,
      species: p.species ?? ex.species,
      level: p.level ?? ex.level,
      hpMax: p.hpMax ?? ex.hpMax,
      hpCurrent: p.hpCurrent ?? ex.hpCurrent,
      ac: p.ac ?? ex.ac,
      speed: p.speed ?? ex.speed,
      strScore: p.strScore !== undefined ? p.strScore : ex.strScore,
      dexScore: p.dexScore !== undefined ? p.dexScore : ex.dexScore,
      conScore: p.conScore !== undefined ? p.conScore : ex.conScore,
      intScore: p.intScore !== undefined ? p.intScore : ex.intScore,
      wisScore: p.wisScore !== undefined ? p.wisScore : ex.wisScore,
      chaScore: p.chaScore !== undefined ? p.chaScore : ex.chaScore,
      color: p.color !== undefined ? p.color : ex.color,
      ...(ex.deathSaves ? { deathSaves: ex.deathSaves } : {}),
    };
    const normalized = normalizeCharacterSheetForStorage(nextSheet, mergedCharacterData);
    const hasSyncedDerivedStats = p.syncedHpMax !== undefined || p.syncedAc !== undefined;
    let characterDataForStorage = hasSyncedDerivedStats
      ? {
          ...(normalized.characterData ?? {}),
          ...(p.syncedHpMax !== undefined ? { derivedHpMax: p.syncedHpMax } : {}),
          ...(p.syncedAc !== undefined ? { derivedAc: p.syncedAc } : {}),
        }
      : normalized.characterData;
    if (Number(normalized.sheet.hpCurrent) <= 0 && characterDataForStorage?.concentrationSpell) {
      characterDataForStorage = { ...characterDataForStorage, concentrationSpell: null };
    }
    const finalNormalized = normalizeCharacterSheetForStorage(
      normalized.sheet,
      characterDataForStorage,
    );
    const sheetCols = characterSheetDbColumns(finalNormalized.sheet);

    db.prepare(`
      UPDATE user_characters SET
        name=?, player_name=?, class_name=?, species=?, level=?, hp_max=?, hp_current=?, ac=?, speed=?,
        str_score=?, dex_score=?, con_score=?, int_score=?, wis_score=?, cha_score=?, color=?,
        death_saves_success=?, death_saves_fail=?, character_data_json=?, updated_at=?
      WHERE id=? AND user_id=?
    `).run(
      sheetCols.name, sheetCols.playerName, sheetCols.className, sheetCols.species, sheetCols.level, sheetCols.hpMax, sheetCols.hpCurrent,
      sheetCols.ac, sheetCols.speed, sheetCols.strScore, sheetCols.dexScore, sheetCols.conScore, sheetCols.intScore, sheetCols.wisScore,
      sheetCols.chaScore, sheetCols.color, sheetCols.deathSavesSuccess, sheetCols.deathSavesFail,
      characterDataForStorage ? JSON.stringify(characterDataForStorage) : null,
      t, charId, userId
    );
    if (p.characterData !== undefined && Object.prototype.hasOwnProperty.call(p.characterData ?? {}, "age")) {
      syncLinkedMortalAgeFromCharacter(db, charId, characterDataForStorage, t);
    }
    if (p.name !== undefined) {
      syncLinkedMortalNameFromCharacter(db, charId, sheetCols.name, ctx.helpers.normalizeKey(sheetCols.name), t);
    }

    const nextChar = {
      ...ex,
      ...finalNormalized.sheet,
      characterData: characterDataForStorage,
    };
    const sheetOverrides = getCharacterSheetOverrides(nextChar);
    syncAssignedPlayerRows(
      db,
      ctx.broadcast,
      charId,
      buildMirroredPlayerSnapshot(nextChar, p.syncedAc, p.syncedSpeed, p.syncedHpMax),
      t,
      userId,
      p.hpCurrent !== undefined || sheetOverrides
        ? {
            ...(p.hpCurrent !== undefined ? { hpCurrent: p.hpCurrent } : {}),
            ...(sheetOverrides ? { overrides: sheetOverrides } : {}),
          }
        : undefined,
    );

    const updated = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(charId) as Record<string, unknown>;
    res.json(withAbsoluteImageUrl(req, toCharacterSheetDto({ ...rowToCharacterSheet(updated), campaigns: [] })));
  });

  // Delete a user-owned character (cascades to character_campaigns)

  // MARK: - DELETE /api/me/characters/:id
  app.delete("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("DELETE FROM players WHERE id = ?").run(player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "delete", playerId: player_id, characterId: charId });
    }

    // Linked campaign characters are deleted alongside the sheet.
    db.prepare("DELETE FROM user_characters WHERE id = ?").run(charId);
    res.json({ ok: true });
  });

  // Assign character to one or more campaigns

  // MARK: - POST /api/me/characters/:id/assign
  app.post("/api/me/characters/:id/assign", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = req.user!.userId;
    const isAdmin = Boolean(req.user!.isAdmin);

    const existing = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });
    const char = rowToCharacterSheet(existing);
    const cleanImageUrl = cleanStoredImageUrl(existing.image_url);

    const { campaignIds } = parseBody(AssignBody, req);
    const t = now();
    const results: { campaignId: string; playerId: string }[] = [];
    const snapshot = buildMirroredPlayerSnapshot(char);

    for (const campaignId of campaignIds) {
      // Verify user is a member of the campaign (admins are always allowed)
      if (!isAdmin) {
        const membership = db
          .prepare("SELECT id FROM campaign_membership WHERE campaign_id = ? AND user_id = ?")
          .get(campaignId, userId);
        if (!membership) continue;
      }

      const existing_link = db
        .prepare("SELECT id FROM players WHERE campaign_id = ? AND character_id = ?")
        .get(campaignId, charId) as { id: string } | undefined;

      if (existing_link?.id) {
        updateProjectedPlayerRow(db, existing_link.id, snapshot, t, userId);
        if (cleanImageUrl) {
          db.prepare("UPDATE players SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?")
            .run(cleanImageUrl, existing.image_updated_at ?? t, t, existing_link.id);
        }
        emitPlayerChange({ campaignId, action: "upsert", playerId: existing_link.id, characterId: charId });
        results.push({ campaignId, playerId: existing_link.id });
        continue;
      }

      const playerId = uid();
      insertProjectedPlayerRow(db, {
        playerId,
        campaignId,
        characterId: charId,
        snapshot,
        liveState: buildCampaignCharacterLiveState(char),
        createdAt: t,
        updatedAt: t,
        userId,
      });
      if (cleanImageUrl) {
        db.prepare("UPDATE players SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?")
          .run(cleanImageUrl, existing.image_updated_at ?? t, t, playerId);
      }

      emitPlayerChange({ campaignId, action: "upsert", playerId, characterId: charId });
      results.push({ campaignId, playerId });
    }

    ensureLinkedBinderMortalForCharacter(db, charId, ctx.helpers);

    res.json({ ok: true, results });
  });

  // Unassign character from a campaign

  // MARK: - POST /api/me/characters/:id/unassign
  app.post("/api/me/characters/:id/unassign", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = req.user!.userId;

    const existing = db
      .prepare("SELECT id FROM user_characters WHERE id = ? AND user_id = ?")
      .get(charId, userId) as { id: string } | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    const { campaignId } = parseBody(UnassignBody, req);

    const link = db
      .prepare("SELECT id FROM players WHERE character_id = ? AND campaign_id = ?")
      .get(charId, campaignId) as { id: string } | undefined;

    if (link?.id) {
      db.prepare("DELETE FROM players WHERE id = ?").run(link.id);
      emitPlayerChange({ campaignId, action: "delete", playerId: link.id, characterId: charId });
    }

    res.json({ ok: true });
  });

  // Upload character portrait image.

  // MARK: - POST /api/me/characters/:id/image
  app.post("/api/me/characters/:id/image", requireAuth, ctx.upload.single("image"), async (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;
    const prepared = await prepareUploadedImage(req.file);
    if (!prepared.ok) return res.status(400).json({ ok: false, message: prepared.message });
    const thumbnail = prepared.image;

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "character-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });
    const filename = `${charId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), thumbnail);
    const imageUrl = `/character-images/${filename}`;
    const t = now();
    db.prepare("UPDATE user_characters SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?").run(imageUrl, t, t, charId);
    // Sync image to all campaign player rows linked to this character.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?").run(imageUrl, t, t, player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }
    syncLinkedMortalPortraitFromCharacter(db, charId, imageUrl, t);
    res.json({ ok: true, imageUrl: absolutizePublicUrlForRequest(req, imageUrl) });
  });

  // Remove character portrait image.

  // MARK: - DELETE /api/me/characters/:id/image
  app.delete("/api/me/characters/:id/image", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "character-images");
    const imgPath = ctx.path.join(imagesDir, `${charId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }
    const t = now();
    db.prepare("UPDATE user_characters SET image_url = NULL, image_updated_at = ?, updated_at = ? WHERE id = ?").run(t, t, charId);
    // Sync image removal to all campaign player rows linked to this character.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET image_url = NULL, image_updated_at = ?, updated_at = ? WHERE id = ?").run(t, t, player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }
    syncLinkedMortalPortraitFromCharacter(db, charId, null, t);
    res.json({ ok: true });
  });
}
