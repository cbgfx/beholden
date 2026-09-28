import type { Db } from "../../lib/db.js";
import { insertCombatant } from "../../services/combat.js";
import { DEFAULT_DEATH_SAVES, DEFAULT_OVERRIDES } from "../../lib/defaults.js";
import { seedDefaultConditions } from "../../services/conditions.js";
import { campaignLiveDbColumns, campaignSheetDbColumns } from "../../services/characters.js";
import { replaceBastionAssignments } from "../bastions/helpers.js";
import { cleanStoredImageUrl } from "../../lib/dbConverters.js";
import { normalizeKey } from "../../lib/text.js";
import type { StoredConditionInstance, StoredEncounterActor } from "../../server/userData.js";
import { migrateCampaignDocument } from "./migrate.js";

// MARK: - Import Campaign Document
/**
 * Replaces (or creates) a campaign from an export file.
 *
 * The file is migrated to the current v3 shape and fully validated before anything is written, so a
 * bad file fails without touching the database. The writes then run in one transaction, so a
 * database-level failure (e.g. an id already used by another campaign) also leaves nothing behind.
 */
export function importCampaignDocument(db: Db, raw: unknown, uid: () => string): string {
  const doc = migrateCampaignDocument(raw);
  const c = doc.campaign;
  const campaignId = c.id;
  const now = Date.now();

  db.transaction(() => {
    const previous = db.prepare("SELECT party_currency_json, campaign_story, campaign_notes FROM campaigns WHERE id = ?").get(campaignId) as Record<string, unknown> | undefined;
    // Membership is installation-local authority, never granted from an imported file.
    const memberships = db.prepare("SELECT * FROM campaign_membership WHERE campaign_id = ?").all(campaignId) as Record<string, unknown>[];
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);

    // A Binder belongs to one installation. The link is kept only when that Binder exists here,
    // e.g. restoring a backup onto the same server; otherwise the campaign arrives unlinked.
    const binderId = c.binderId && db.prepare("SELECT 1 FROM binders WHERE id = ?").get(c.binderId) ? c.binderId : null;

    db.prepare(`
      INSERT INTO campaigns (id, name, color, ruleset, image_url, image_updated_at, shared_notes, campaign_story, campaign_notes,
        party_currency_json, is_active, binder_id, current_date_text, current_date_sort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      campaignId,
      c.name,
      c.color,
      c.ruleset,
      cleanStoredImageUrl(c.imageUrl),
      c.updatedAt ?? now,
      c.sharedNotes,
      c.campaignStory === undefined ? previous?.campaign_story ?? null : c.campaignStory,
      c.campaignNotes === undefined ? previous?.campaign_notes ?? null : c.campaignNotes,
      c.partyCurrency ? JSON.stringify(c.partyCurrency) : previous?.party_currency_json ?? JSON.stringify({ PP: 0, GP: 0, SP: 0, CP: 0 }),
      c.isActive ? 1 : 0,
      binderId,
      // The in-world date is the campaign's own value, so it travels even without the Binder.
      c.currentDate?.text ?? null,
      c.currentDate?.sort ?? null,
      c.createdAt ?? now,
      c.updatedAt ?? now,
    );

    for (const m of memberships) {
      db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(m.id, campaignId, m.user_id, m.role, m.created_at, m.updated_at);
    }

    for (const adventure of Object.values(doc.adventures)) {
      db.prepare(`
        INSERT INTO adventures (id, campaign_id, name, status, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        adventure.id, campaignId, adventure.name, adventure.status, adventure.sort,
        adventure.createdAt ?? now, adventure.updatedAt ?? now,
      );
    }

    for (const encounter of Object.values(doc.encounters)) {
      db.prepare(`
        INSERT INTO encounters
          (id, campaign_id, adventure_id, name, status, sort,
           combat_round, combat_active_combatant_id, xp_awarded_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        encounter.id,
        campaignId,
        encounter.adventureId,
        encounter.name,
        encounter.status,
        encounter.sort,
        encounter.combat?.round ?? null,
        encounter.combat?.activeCombatantId ?? null,
        encounter.xpAwardedAt,
        encounter.createdAt ?? now,
        encounter.updatedAt ?? now,
      );
    }

    // Account and character links are kept only when they exist on this installation.
    const existingUserIds = new Set(
      (db.prepare("SELECT id FROM users").all() as Array<{ id: string }>).map((r) => r.id)
    );
    const existingCharacterIds = new Set(
      (db.prepare("SELECT id FROM user_characters").all() as Array<{ id: string }>).map((r) => r.id)
    );
    for (const player of Object.values(doc.players)) {
      // Prefer the stored base speed; `speed` has conditions (grappled, slowed...) applied and
      // would otherwise make a temporary reduction permanent. Old files may only carry `speed`.
      const speed = player.baseSpeed ?? player.speed;
      const sheetCols = campaignSheetDbColumns({
        playerName: player.playerName,
        characterName: player.characterName,
        class: player.class,
        species: player.species,
        level: player.level,
        hpMax: player.hpMax,
        ac: player.ac,
        ...(speed != null ? { speed } : {}),
        ...(player.str != null ? { str: player.str } : {}),
        ...(player.dex != null ? { dex: player.dex } : {}),
        ...(player.con != null ? { con: player.con } : {}),
        ...(player.int != null ? { int: player.int } : {}),
        ...(player.wis != null ? { wis: player.wis } : {}),
        ...(player.cha != null ? { cha: player.cha } : {}),
        ...(player.color !== undefined ? { color: player.color } : {}),
        ...(player.syncedAc != null ? { syncedAc: player.syncedAc } : {}),
      });
      const liveCols = campaignLiveDbColumns({
        hpCurrent: player.hpCurrent,
        overrides: player.overrides ?? DEFAULT_OVERRIDES,
        // The schema has already checked and normalized each condition; only optional-field typing differs.
        conditions: player.conditions as StoredConditionInstance[],
        ...(player.deathSaves ? { deathSaves: player.deathSaves } : {}),
      });
      db.prepare(`
        INSERT INTO players
          (id, campaign_id, user_id, character_id,
           player_name, character_name, class_name, species, level, hp_max, hp_current, ac, speed,
           str, dex, con, int, wis, cha, color, synced_ac, death_saves_success, death_saves_fail,
           live_json, image_url, image_updated_at, shared_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        player.id,
        campaignId,
        player.userId && existingUserIds.has(player.userId) ? player.userId : null,
        player.characterId && existingCharacterIds.has(player.characterId) ? player.characterId : null,
        sheetCols.playerName,
        sheetCols.characterName,
        sheetCols.className,
        sheetCols.species,
        sheetCols.level,
        sheetCols.hpMax,
        liveCols.hpCurrent,
        sheetCols.ac,
        sheetCols.speed,
        sheetCols.str,
        sheetCols.dex,
        sheetCols.con,
        sheetCols.int,
        sheetCols.wis,
        sheetCols.cha,
        sheetCols.color,
        sheetCols.syncedAc,
        liveCols.deathSavesSuccess,
        liveCols.deathSavesFail,
        liveCols.liveJson,
        cleanStoredImageUrl(player.imageUrl),
        player.updatedAt ?? now,
        player.sharedNotes,
        player.createdAt ?? now,
        player.updatedAt ?? now,
      );
    }

    // An NPC's Binder mortal is kept only when it belongs to the Binder this campaign is linked to
    // here; the column has a foreign key, so an unknown mortal would otherwise fail the import.
    const mortalInBinder = db.prepare("SELECT 1 FROM mortals m JOIN binder_records br ON br.id = m.id WHERE m.id = ? AND br.binder_id = ?");
    for (const inpc of Object.values(doc.inpcs)) {
      const binderMortalId = binderId && inpc.binderMortalId && mortalInBinder.get(inpc.binderMortalId, binderId) ? inpc.binderMortalId : null;
      db.prepare(`
        INSERT INTO inpcs
          (id, campaign_id, monster_id, binder_mortal_id, name, label, friendly,
           hp_max, hp_current, hp_details, ac, ac_details, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        inpc.id,
        campaignId,
        inpc.monsterId,
        binderMortalId,
        inpc.name,
        inpc.label,
        inpc.friendly ? 1 : 0,
        inpc.hpMax,
        inpc.hpCurrent,
        inpc.hpDetails,
        inpc.ac,
        inpc.acDetails,
        inpc.sort,
        inpc.createdAt ?? now,
        inpc.updatedAt ?? now,
      );
    }

    for (const note of Object.values(doc.notes)) {
      db.prepare(`
        INSERT INTO notes (id, campaign_id, adventure_id, title, text, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        note.id, campaignId, note.adventureId, note.title, note.text, note.sort,
        note.createdAt ?? now, note.updatedAt ?? now,
      );
    }

    for (const entry of Object.values(doc.treasure)) {
      db.prepare(`
        INSERT INTO treasure
          (id, campaign_id, adventure_id, encounter_id, source, item_id, name, rarity, type, type_key,
           attunement, magic, text, qty, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.id,
        campaignId,
        entry.adventureId,
        entry.encounterId,
        entry.source,
        entry.itemId,
        entry.name,
        entry.rarity,
        entry.type,
        entry.type_key,
        entry.attunement ? 1 : 0,
        entry.magic ? 1 : 0,
        entry.text,
        entry.qty,
        entry.sort,
        entry.createdAt ?? now,
        entry.updatedAt ?? now,
      );
    }

    for (const item of Object.values(doc.partyInventory)) {
      db.prepare(`
        INSERT INTO party_inventory
          (id, campaign_id, name, quantity, weight, notes, source, item_id, rarity, type, description, payload_json, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        campaignId,
        item.name,
        item.quantity,
        item.weight,
        item.notes,
        item.source,
        item.itemId,
        item.rarity,
        item.type,
        item.description,
        item.payload ? JSON.stringify(item.payload) : null,
        item.sort,
        item.createdAt ?? now,
        item.updatedAt ?? now,
      );
    }

    for (const condition of Object.values(doc.conditions)) {
      // Some older campaigns stored default conditions with an empty key. Rebuild it from the name
      // the same way seedDefaultConditions builds keys; otherwise seeding would re-add "Blinded"
      // under the same id and fail the import.
      const key = condition.key.trim() || normalizeKey(condition.name).replace(/\s/g, "_");
      db.prepare(`
        INSERT INTO conditions (id, campaign_id, key, name, description, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        condition.id, campaignId, key, condition.name, condition.description, condition.sort,
        condition.createdAt ?? now, condition.updatedAt ?? now,
      );
    }

    for (const bastion of Object.values(doc.bastions)) {
      db.prepare(`
        INSERT INTO bastions
          (id, campaign_id, name, active, walled, defenders_armed, defenders_unarmed, notes, maintain_order, facilities_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bastion.id,
        campaignId,
        bastion.name,
        bastion.active ? 1 : 0,
        bastion.walled ? 1 : 0,
        bastion.defendersArmed,
        bastion.defendersUnarmed,
        bastion.notes,
        bastion.maintainOrder ? 1 : 0,
        JSON.stringify(bastion.facilities),
        bastion.createdAt ?? now,
        bastion.updatedAt ?? now,
      );
      replaceBastionAssignments(db, bastion.id, bastion.assignedPlayerIds, bastion.assignedCharacterIds);
    }

    for (const combat of Object.values(doc.combats)) {
      const encounterId = combat.encounterId;
      db.prepare("UPDATE encounters SET combat_round=?, combat_active_combatant_id=? WHERE id=?").run(
        combat.round,
        combat.activeCombatantId,
        encounterId,
      );

      for (const [index, raw] of combat.combatants.entries()) {
        const combatant: StoredEncounterActor = {
          id: raw.id ?? uid(),
          encounterId,
          baseType: raw.baseType,
          baseId: raw.baseId,
          ...(raw.baseRuleset ? { baseRuleset: raw.baseRuleset } : {}),
          name: raw.name,
          label: raw.label,
          initiative: raw.initiative,
          friendly: raw.friendly,
          color: raw.color,
          hpCurrent: raw.hpCurrent,
          hpMax: raw.hpMax,
          hpDetails: raw.hpDetails,
          ac: raw.ac,
          acDetails: raw.acDetails,
          sort: raw.sort ?? index + 1,
          usedReaction: raw.usedReaction,
          usedLegendaryActions: raw.usedLegendaryActions,
          usedLegendaryResistances: raw.usedLegendaryResistances,
          overrides: raw.overrides ?? DEFAULT_OVERRIDES,
          conditions: raw.conditions as StoredConditionInstance[],
          deathSaves: raw.deathSaves ?? DEFAULT_DEATH_SAVES,
          usedSpellSlots: raw.usedSpellSlots,
          attackOverrides: raw.attackOverrides,
          ...(raw.engagedWithPlayers === true ? { engagedWithPlayers: true } : {}),
          ...(raw.description !== undefined ? { description: raw.description } : {}),
          createdAt: raw.createdAt ?? now,
          updatedAt: raw.updatedAt ?? now,
        };
        insertCombatant(db, combatant);
      }
    }

    seedDefaultConditions(db, campaignId);
  })();

  return campaignId;
}
