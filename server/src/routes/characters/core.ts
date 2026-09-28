import { characterLevelFromClasses } from "@beholden/shared/domain/characterClasses";
import { classProgressionRequirements } from "@beholden/shared/domain/classProgressionRequirements";
import { hpProgressionHistoryProblem } from "@beholden/shared/domain/progressionHp";
import { progressionOwnershipProblem } from "@beholden/shared/domain/progressionOwnership";
// server/src/routes/characters.ts
// Player-owned characters: campaign-agnostic CRUD + campaign assignment.

import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import { normalizeCharacterSheetForStorage, rowToCharacterSheet, CHARACTER_SHEET_COLS } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { toCharacterCampaignAssignmentDto, toCharacterSheetDto } from "../../lib/apiActors.js";
import {
  getAssignments,
  getAssignmentsForCharacters,
  assignmentsToJson,
  getAssignedPlayers,
  buildCampaignCharacterLiveState,
  buildMirroredPlayerSnapshot,
  characterSheetDbColumns,
  insertProjectedPlayerRow,
  mergeLiveStats,
  syncAssignedPlayerRows,
} from "../../services/characters.js";
import { sweepDependentConditions } from "../../services/combat.js";
import { prepareUploadedImage } from "../../lib/imageHelpers.js";
import { deleteCharacterWithPlayers, removePlayerFromCampaign } from "../../services/characterDeletion.js";
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
  inventoryRevOf,
  spellStateRevOf,
  requireOwnedCharacter,
  toCharacterSheetDtoInput,
  makeEmitPlayerChange,
} from "./helpers.js";
import { registerCharacterFieldPatchRoutes } from "./fieldPatchRoutes.js";
import { ensureLinkedBinderMortalForCharacter } from "../../services/binders/linkedPlayerIdentity.js";
import { characterProgressionEligibilityProblem } from "../../services/characterProgressionEligibility.js";
import { inventoryValidationProblem } from "../../services/inventoryValidation.js";
import { spellStateValidationProblem } from "../../services/spellStateValidation.js";
import { foldLegacyPreparedSpells } from "@beholden/shared/domain/spellPreparation";
import { foldLegacyHitDice } from "@beholden/shared/domain/hitDice";
import { hitDieMaximaFor } from "../../services/hitDieMaxima.js";
import { mergeLiveJson, takeSheetColumnKeys } from "../../lib/sheetLiveColumns.js";

const LinkedIdentityPatch = z.object({
  gender: z.string().trim().max(80).nullable().optional(),
  age: z.number().int().min(0).max(10_000).nullable().optional(),
  description: z.string().max(200_000).nullable().optional(),
  backstory: z.string().max(200_000).nullable().optional(),
}).strict().refine((body) => Object.keys(body).length > 0);

function identityRequirementError(characterData: Record<string, unknown> | null | undefined): string | null {
  const age = Number(String(characterData?.age ?? "").trim());
  if (!Number.isInteger(age) || age <= 0 || age > 10_000) return "Character age is required and must be a positive whole number";
  // This check runs on the stored data, so it also decides whether an older character may be saved
  // at all. Sheets written before the value was normalised hold "Male"; read it the way the Binder
  // projection does (trimmed, lower case) rather than refusing every save that character makes.
  const gender = String(characterData?.gender ?? "").trim().toLowerCase();
  if (gender !== "male" && gender !== "female") return "Character gender is required";
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
      return { ...withAbsoluteImageUrl(req, toCharacterSheetDto(
        toCharacterSheetDtoInput(
          mergeLiveStats(db, char, assignments),
          toCharacterCampaignAssignmentDto(assignmentsToJson(assignments)),
        ),
      )), inventoryRev: inventoryRevOf(char.characterData), spellStateRev: spellStateRevOf(char.characterData) };
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

    res.json({
      ...withAbsoluteImageUrl(req, toCharacterSheetDto(
        toCharacterSheetDtoInput(
          merged,
          toCharacterCampaignAssignmentDto(assignmentsToJson(assignments)),
          collectCampaignSharedNotes(db, assignments, charId),
        ),
      )),
      inventoryRev: inventoryRevOf(char.characterData),
      spellStateRev: spellStateRevOf(char.characterData),
    });
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
      LEFT JOIN player_rows p ON p.id=bpc.player_id
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
      FROM player_rows p
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
        ...withAbsoluteImageUrl(req, record),
        domains: record.domains ? String(record.domains).split("||") : [],
      })),
      places: publicRecords.filter((record) => record.type !== "deity").map((record) => withAbsoluteImageUrl(req, record)),
      mortals: mortals.map((mortal) => ({
        ...withAbsoluteImageUrl(req, mortal),
        age: mortal.birthDateSort != null && (mortal.deathDateSort != null || access.currentDateSort != null)
          ? Math.max(0, Number(mortal.deathDateSort ?? access.currentDateSort) - Number(mortal.birthDateSort))
          : null,
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
      if (p.creationToken) {
        const prior = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE user_id = ? AND creation_token = ?`)
          .get(userId, p.creationToken) as Record<string, unknown> | undefined;
        if (prior) {
          const priorSheet = rowToCharacterSheet(prior);
          const assignments = getAssignments(db, priorSheet.id);
          return res.json(withAbsoluteImageUrl(req, toCharacterSheetDto(
            toCharacterSheetDtoInput(priorSheet, toCharacterCampaignAssignmentDto(assignmentsToJson(assignments))),
          )));
        }
      }
    const progressionProblems = classProgressionRequirements(p.characterData?.classes, p.level);
    if (progressionProblems.length) return res.status(400).json({ ok: false, code: "invalid-progression", message: progressionProblems[0]!.message, requirements: progressionProblems });
    const identityError = identityRequirementError(p.characterData);
    if (identityError) return res.status(400).json({ ok: false, message: identityError });
    const id = uid();
    const t = now();
    // The creator sends its worked-out HP maximum (and possibly AC or speed) in the data: those, and
    // any live state, belong in their columns (lib/sheetLiveColumns.ts), not the blob.
    const incomingData = p.characterData ? (foldLegacyPreparedSpells(p.characterData) ?? p.characterData) : null;
    const createColumns = incomingData ? takeSheetColumnKeys(incomingData) : null;
    const normalized = normalizeCharacterSheetForStorage({
      name: p.name,
      playerName: ownerName,
      ruleset: p.ruleset,
      className: p.className ?? "",
      species: p.species ?? "",
      level: p.level ?? 1,
      hpMax: p.hpMax ?? 0,
      hpCurrent: p.hpCurrent ?? p.hpMax ?? 0,
      ac: createColumns?.values.derivedAc ?? p.ac ?? 10,
      speed: p.speed ?? 30,
      strScore: p.strScore ?? null,
      dexScore: p.dexScore ?? null,
      conScore: p.conScore ?? null,
      intScore: p.intScore ?? null,
      wisScore: p.wisScore ?? null,
      chaScore: p.chaScore ?? null,
      color: p.color ?? null,
      ...(p.deathSaves ? { deathSaves: p.deathSaves } : {}),
    }, createColumns ? createColumns.data : incomingData);
    const inventoryError = inventoryValidationProblem(normalized.characterData);
    if (inventoryError) return res.status(400).json({ ok: false, ...inventoryError });
    const spellStateError = spellStateValidationProblem(normalized.characterData);
    if (spellStateError) return res.status(400).json({ ok: false, ...spellStateError });
    const hpHistoryError = hpProgressionHistoryProblem(normalized.characterData, normalized.sheet.level, normalized.sheet.hpMax);
    if (hpHistoryError) return res.status(400).json({ ok: false, code: "invalid-hp-progression", message: hpHistoryError });
    const sheetCols = characterSheetDbColumns(normalized.sheet);

    db.prepare(`
      INSERT INTO user_characters
          (id, user_id, creation_token, name, player_name, ruleset, class_name, species, level, hp_max, hp_current, ac, speed,
         str_score, dex_score, con_score, int_score, wis_score, cha_score, color, death_saves_success, death_saves_fail,
         image_url, character_data_json, live_json, derived_hp_max, derived_speed, shared_notes, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id, userId, p.creationToken ?? null, sheetCols.name, sheetCols.playerName, sheetCols.ruleset, sheetCols.className, sheetCols.species, sheetCols.level,
      sheetCols.hpMax, sheetCols.hpCurrent, sheetCols.ac, sheetCols.speed,
      sheetCols.strScore, sheetCols.dexScore, sheetCols.conScore, sheetCols.intScore, sheetCols.wisScore, sheetCols.chaScore,
      sheetCols.color, sheetCols.deathSavesSuccess, sheetCols.deathSavesFail,
      normalized.characterData ? JSON.stringify(normalized.characterData) : null,
      mergeLiveJson(
        mergeLiveJson("{}", createColumns?.values.live),
        p.overrides || p.conditions
          ? { ...(p.overrides ? { overrides: p.overrides } : {}), ...(p.conditions ? { conditions: p.conditions } : {}) }
          : undefined,
      ),
      createColumns?.values.derivedHpMax ?? null,
      createColumns?.values.derivedSpeed ?? null,
      p.sharedNotes ?? "",
      p.isActive === false ? 0 : 1,
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

    if (p.progressionClassEntryId && p.expectedCharacterRevision === undefined) {
      return res.status(428).json({
        ok: false,
        code: "character-revision-required",
        message: "Reload this character before changing its progression.",
      });
    }
    if (p.expectedCharacterRevision !== undefined && Number(ex.updatedAt) !== p.expectedCharacterRevision) {
      return res.status(409).json({
        ok: false,
        code: "stale-character",
        message: "This character changed in another tab. Reload and review the progression choices before saving again.",
        currentRevision: ex.updatedAt,
      });
    }

    // Inventory is replaced as a whole, so every inventory writer must prove
    // which stored version it edited. Without this requirement an older client
    // can silently erase a stash transfer, charge spend, or DM treasure award.
    const touchesInventory = Boolean(
      p.characterData
      && (Object.prototype.hasOwnProperty.call(p.characterData, "inventory")
        || Object.prototype.hasOwnProperty.call(p.characterData, "inventoryContainers")),
    );
    if (touchesInventory && p.expectedInventoryRev === undefined) {
      return res.status(428).json({
        ok: false,
        code: "inventory-revision-required",
        message: "Reload this character before changing its inventory.",
      });
    }
    if (touchesInventory && inventoryRevOf(ex.characterData) !== p.expectedInventoryRev) {
      return res.status(409).json({
        ok: false,
        code: "stale-inventory",
        message: "Your inventory changed on another device and has been reloaded — please redo that change.",
      });
    }
    // "preparedSpells" no longer exists (preparation is a flag on the spell entries), but an older
    // tab may still send it, and that write must pass the same stale-tab check.
    const spellStateFields = new Set(["usedSpellSlots", "preparedSpells", "classSpellSelections", "proficiencies", "concentrationSpell"]);
    const touchesSpellState = Boolean(p.characterData && Object.keys(p.characterData).some((key) => spellStateFields.has(key)));
    const carriesProgression = p.level !== undefined || Boolean(p.characterData && Object.prototype.hasOwnProperty.call(p.characterData, "classes"));
    if (touchesSpellState && !carriesProgression && p.expectedSpellStateRev === undefined && p.expectedCharacterRevision === undefined) {
      return res.status(428).json({ ok: false, code: "spell-state-revision-required", message: "Reload this character before changing spells or spell slots." });
    }
    if (touchesSpellState && p.expectedSpellStateRev !== undefined && spellStateRevOf(ex.characterData) !== p.expectedSpellStateRev) {
      return res.status(409).json({ ok: false, code: "stale-spell-state", message: "Spell state changed on another device. The latest character must be reloaded before retrying." });
    }

    const patchedCharacterData =
      p.characterData !== undefined
        ? (p.characterData === null ? null : { ...(ex.characterData ?? {}), ...p.characterData })
        : ex.characterData;
    // Prepared spells live on the spell entries. A client still sending the old name lists (an
    // older tab) has them folded onto the entries here, so the lists are never stored again.
    const withPreparedFlags = patchedCharacterData
      ? foldLegacyPreparedSpells(patchedCharacterData) ?? patchedCharacterData
      : patchedCharacterData;
    // Hit dice are stored as spent (shared/domain/hitDice); an older tab's "left" counts are
    // converted the same way the migration does.
    const withHitDice = withPreparedFlags
      ? foldLegacyHitDice(withPreparedFlags, hitDieMaximaFor(db, withPreparedFlags, ex.ruleset)) ?? withPreparedFlags
      : withPreparedFlags;
    // Live state and app-worked stats have their own columns (lib/sheetLiveColumns.ts); an older
    // tab or the creator still sending them in the data has them taken out and put there.
    const columnKeys = withHitDice ? takeSheetColumnKeys(withHitDice) : null;
    const requestedCharacterData = columnKeys ? columnKeys.data : withHitDice;
    const appDerivedHpMax = p.syncedHpMax ?? columnKeys?.values.derivedHpMax;
    const appDerivedAc = p.syncedAc ?? columnKeys?.values.derivedAc ?? undefined;
    const appDerivedSpeed = p.syncedSpeed ?? columnKeys?.values.derivedSpeed;
    const inventoryError = inventoryValidationProblem(requestedCharacterData);
    if (inventoryError) return res.status(400).json({ ok: false, ...inventoryError });
    const spellStateError = spellStateValidationProblem(requestedCharacterData);
    if (spellStateError) return res.status(400).json({ ok: false, ...spellStateError });
    const touchesProgression = p.level !== undefined || (p.characterData != null && Object.prototype.hasOwnProperty.call(p.characterData, "classes"));
    if (touchesProgression) {
      const progressionProblems = classProgressionRequirements(requestedCharacterData?.classes, p.level);
      if (progressionProblems.length) return res.status(400).json({ ok: false, code: "invalid-progression", message: progressionProblems[0]!.message, requirements: progressionProblems });
      const ownershipError = progressionOwnershipProblem(requestedCharacterData);
      if (ownershipError) return res.status(400).json({ ok: false, code: "invalid-progression-ownership", message: ownershipError });
    }
    const identityError = identityRequirementError(requestedCharacterData);
    if (identityError) return res.status(400).json({ ok: false, message: identityError });
    const levelSafeCharacterData = preserveProficienciesOnLevelUp(
      ex.characterData,
      requestedCharacterData,
      (Array.isArray(requestedCharacterData?.classes) && requestedCharacterData.classes.length > 0
        ? characterLevelFromClasses(requestedCharacterData.classes)
        : p.level ?? ex.level) > ex.level,
    );
    const mergedCharacterData = preserveForeignClassProficiencies(
      ex.characterData,
      levelSafeCharacterData,
      p.progressionClassEntryId,
    );
    const healedFromZero = p.hpCurrent !== undefined && Number(ex.hpCurrent) <= 0 && Number(p.hpCurrent) > 0;
    const nextSheet = {
      name: p.name ?? ex.name,
      playerName: ownerName,
      ruleset: ex.ruleset,
      className: p.className ?? ex.className,
      species: p.species ?? ex.species,
      level: p.level ?? ex.level,
      hpMax: p.hpMax ?? ex.hpMax,
      hpCurrent: p.hpCurrent ?? ex.hpCurrent,
      ac: appDerivedAc ?? p.ac ?? ex.ac,
      speed: p.speed ?? ex.speed,
      strScore: p.strScore !== undefined ? p.strScore : ex.strScore,
      dexScore: p.dexScore !== undefined ? p.dexScore : ex.dexScore,
      conScore: p.conScore !== undefined ? p.conScore : ex.conScore,
      intScore: p.intScore !== undefined ? p.intScore : ex.intScore,
      wisScore: p.wisScore !== undefined ? p.wisScore : ex.wisScore,
      chaScore: p.chaScore !== undefined ? p.chaScore : ex.chaScore,
      color: p.color !== undefined ? p.color : ex.color,
      ...(healedFromZero
        ? { deathSaves: { success: 0, fail: 0 } }
        : ex.deathSaves ? { deathSaves: ex.deathSaves } : {}),
    };
    const normalized = normalizeCharacterSheetForStorage(nextSheet, mergedCharacterData);
    const touchesHpProgression = p.hpMax !== undefined || p.level !== undefined
      || (p.characterData != null && Object.prototype.hasOwnProperty.call(p.characterData, "hpProgressionHistory"));
    if (touchesHpProgression) {
      const hpHistoryError = hpProgressionHistoryProblem(normalized.characterData, normalized.sheet.level, normalized.sheet.hpMax);
      if (hpHistoryError) return res.status(400).json({ ok: false, code: "invalid-hp-progression", message: hpHistoryError });
    }
    let characterDataForStorage = normalized.characterData;
    if (Number(normalized.sheet.hpCurrent) <= 0 && characterDataForStorage?.concentrationSpell) {
      characterDataForStorage = { ...characterDataForStorage, concentrationSpell: null };
    }
    const finalNormalized = normalizeCharacterSheetForStorage(
      normalized.sheet,
      characterDataForStorage,
    );
    if (touchesProgression) {
      const eligibilityError = characterProgressionEligibilityProblem(db, {
        ruleset: ex.ruleset,
        level: finalNormalized.sheet.level,
        scores: {
          str: finalNormalized.sheet.strScore, dex: finalNormalized.sheet.dexScore,
          con: finalNormalized.sheet.conScore, int: finalNormalized.sheet.intScore,
          wis: finalNormalized.sheet.wisScore, cha: finalNormalized.sheet.chaScore,
        },
        characterData: finalNormalized.characterData,
        previousCharacterData: ex.characterData,
      });
      if (eligibilityError) return res.status(400).json({ ok: false, code: "invalid-progression-eligibility", message: eligibilityError });
    }
    const sheetCols = characterSheetDbColumns(finalNormalized.sheet);

    // The HP maximum and speed the player's app worked out, and any live state an older tab sent in
    // the data, go to their columns; unchanged when this save did not carry them.
    const existingLive = db.prepare("SELECT live_json FROM user_characters WHERE id = ?").pluck().get(charId) as string | null;
    db.prepare(`
      UPDATE user_characters SET
        name=?, player_name=?, class_name=?, species=?, level=?, hp_max=?, hp_current=?, ac=?, speed=?,
        str_score=?, dex_score=?, con_score=?, int_score=?, wis_score=?, cha_score=?, color=?,
        death_saves_success=?, death_saves_fail=?, character_data_json=?,
        derived_hp_max = CASE WHEN ? THEN ? ELSE derived_hp_max END,
        derived_speed = CASE WHEN ? THEN ? ELSE derived_speed END,
        live_json=?, updated_at=?
      WHERE id=? AND user_id=?
    `).run(
      sheetCols.name, sheetCols.playerName, sheetCols.className, sheetCols.species, sheetCols.level, sheetCols.hpMax, sheetCols.hpCurrent,
      sheetCols.ac, sheetCols.speed, sheetCols.strScore, sheetCols.dexScore, sheetCols.conScore, sheetCols.intScore, sheetCols.wisScore,
      sheetCols.chaScore, sheetCols.color, sheetCols.deathSavesSuccess, sheetCols.deathSavesFail,
      characterDataForStorage ? JSON.stringify(characterDataForStorage) : null,
      appDerivedHpMax !== undefined ? 1 : 0, appDerivedHpMax ?? null,
      appDerivedSpeed !== undefined ? 1 : 0, appDerivedSpeed ?? null,
      columnKeys?.values.live ? mergeLiveJson(existingLive, columnKeys.values.live) : (existingLive ?? "{}"),
      t, charId, userId
    );
    if (p.characterData
      && Array.isArray(p.characterData.progressionRepairIssues)
      && p.characterData.progressionRepairIssues.length === 0
      && p.characterData.progressionRepairBaseline
      && typeof p.characterData.progressionRepairBaseline === "object"
      && (p.characterData.progressionRepairBaseline as Record<string, unknown>).resetReason === "ambiguous-beta-progression") {
      db.prepare("DELETE FROM character_progression_migration_report WHERE character_id = ?").run(charId);
    }
    if (p.characterData !== undefined && Object.prototype.hasOwnProperty.call(p.characterData ?? {}, "age")) {
      syncLinkedMortalAgeFromCharacter(db, charId, characterDataForStorage, t);
    }
    if (p.name !== undefined) {
      syncLinkedMortalNameFromCharacter(db, charId, sheetCols.name, ctx.helpers.normalizeKey(sheetCols.name), t);
    }

    const endedConcentrations = syncAssignedPlayerRows(
      db,
      ctx.broadcast,
      charId,
      p.hpCurrent !== undefined ? { previousHp: Number(ex.hpCurrent), hpCurrent: Number(finalNormalized.sheet.hpCurrent) } : undefined,
    );
    for (const { encounterId, ended } of endedConcentrations) {
      sweepDependentConditions(db, ctx.broadcast, encounterId, ended, t, ended.casterId);
    }

    const updated = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(charId) as Record<string, unknown>;
    const updatedSheet = rowToCharacterSheet(updated);
    res.json({
      ...withAbsoluteImageUrl(req, toCharacterSheetDto({ ...updatedSheet, campaigns: [] })),
      inventoryRev: inventoryRevOf(updatedSheet.characterData),
      spellStateRev: spellStateRevOf(updatedSheet.characterData),
    });
  });

  // Delete a user-owned character (cascades to character_campaigns)

  // MARK: - DELETE /api/me/characters/:id
  app.delete("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;

    // Its campaign players, their places in encounters and its portraits go with it.
    deleteCharacterWithPlayers(ctx, charId);
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
        .prepare("SELECT id FROM player_rows WHERE campaign_id = ? AND character_id = ?")
        .get(campaignId, charId) as { id: string } | undefined;

      // Already in the campaign: its player reads the sheet, so there is nothing to bring up to date.
      if (existing_link?.id) {
        emitPlayerChange({ campaignId, action: "upsert", playerId: existing_link.id, characterId: charId });
        results.push({ campaignId, playerId: existing_link.id });
        continue;
      }

      // The row's profile and live columns are required, so they are filled from the sheet, but a
      // linked player is always read from its sheet (lib/playerRowsView.ts); only the portrait
      // column means something here - a DM's campaign portrait - and it starts empty.
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
      .prepare("SELECT id FROM player_rows WHERE character_id = ? AND campaign_id = ?")
      .get(charId, campaignId) as { id: string } | undefined;

    // Leaving the campaign means leaving its encounters too.
    if (link?.id) removePlayerFromCampaign(ctx, { id: link.id, campaignId, characterId: charId });

    res.json({ ok: true });
  });

  // Upload character portrait image.

  // MARK: - POST /api/me/characters/:id/image
  app.post("/api/me/characters/:id/image", requireAuth, ctx.imageUpload.single("image"), async (req, res) => {
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
    // Campaign players show the sheet's portrait unless the DM chose one for the campaign.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }
    syncLinkedMortalPortraitFromCharacter(db, charId, imageUrl, t);
    res.json({ ok: true, imageUrl: absolutizePublicUrlForRequest(req, imageUrl) });
  });

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
    // Campaign players show the sheet's portrait unless the DM chose one for the campaign.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }
    syncLinkedMortalPortraitFromCharacter(db, charId, null, t);
    res.json({ ok: true });
  });
}
