// server/src/routes/exportImport.ts
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { requireAdmin } from "../middleware/auth.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import {
  rowToCampaign,
  rowToAdventure,
  rowToEncounter,
  rowToCampaignCharacter,
  rowToINpc,
  rowToNote,
  rowToPartyInventoryItem,
  rowToTreasure,
  rowToCondition,
  rowToEncounterActor,
  ADVENTURE_COLS,
  ENCOUNTER_COLS,
  CAMPAIGN_CHARACTER_COLS,
  INPC_COLS,
  NOTE_COLS,
  PARTY_INVENTORY_COLS,
  TREASURE_COLS,
  CONDITION_COLS,
  ENCOUNTER_ACTOR_COLS,
} from "../lib/db.js";
import { insertCombatant, ensureCombat } from "../services/combat.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import { serializeCampaignCharacterLive, serializeCampaignCharacterSheet } from "../services/characters.js";
import { seedDefaultConditions } from "../services/conditions.js";
import type {
  StoredEncounterActor,
  StoredNoteState,
  StoredTreasureState,
} from "../server/userData.js";

export function registerExportImportRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  const serializeNoteState = (note: StoredNoteState) => JSON.stringify(note);
  const serializeTreasureState = (entry: StoredTreasureState) => JSON.stringify(entry);

  // ── Export campaign ───────────────────────────────────────────────────────
  app.get("/api/campaigns/:campaignId/export", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const cRow = db
      .prepare("SELECT id, name, color, image_url, created_at, updated_at FROM campaigns WHERE id = ?")
      .get(campaignId) as Record<string, unknown> | undefined;
    if (!cRow) return res.status(404).json({ ok: false, message: "Campaign not found" });

    const campaign = rowToCampaign(cRow);
    const adventures = Object.fromEntries(
      (db.prepare(`SELECT ${ADVENTURE_COLS} FROM adventures WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToAdventure).map((a) => [a.id, a])
    );
    const encounters = Object.fromEntries(
      (db.prepare(`SELECT ${ENCOUNTER_COLS} FROM encounters WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToEncounter).map((e) => [e.id, e])
    );
    const players = Object.fromEntries(
      (db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToCampaignCharacter).map((p) => [p.id, p])
    );
    const inpcs = Object.fromEntries(
      (db.prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToINpc).map((i) => [i.id, i])
    );
    const notes = Object.fromEntries(
      (db.prepare(`SELECT ${NOTE_COLS} FROM notes WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToNote).map((n) => [n.id, n])
    );
    const treasure = Object.fromEntries(
      (db.prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToTreasure).map((t) => [t.id, t])
    );
    const partyInventory = Object.fromEntries(
      (db.prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToPartyInventoryItem).map((item) => [item.id, item])
    );
    const conditions = Object.fromEntries(
      (db.prepare(`SELECT ${CONDITION_COLS} FROM conditions WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToCondition).map((c) => [c.id, c])
    );

    // Build combats structure with nested combatants — bulk fetch, no per-encounter queries.
    // Round and activeCombatantId sourced from encounters (single source of truth).
    const combatantsByEnc = new Map<string, ReturnType<typeof rowToEncounterActor>[]>();
    for (const row of db.prepare(
      `SELECT ${ENCOUNTER_ACTOR_COLS}
       FROM combatants
       WHERE encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?)
       ORDER BY encounter_id, COALESCE(sort, 9999), created_at`
    ).all(campaignId) as Record<string, unknown>[]) {
      const encId = row.encounter_id as string;
      if (!combatantsByEnc.has(encId)) combatantsByEnc.set(encId, []);
      combatantsByEnc.get(encId)!.push(rowToEncounterActor(row));
    }

    const combats: Record<string, unknown> = {};
    for (const encId of Object.keys(encounters)) {
      const enc = encounters[encId] as any;
      if (!enc) continue;
      combats[encId] = {
        encounterId: encId,
        round: enc.combat?.round ?? 1,
        activeIndex: 0,
        activeCombatantId: enc.combat?.activeCombatantId ?? null,
        combatants: combatantsByEnc.get(encId) ?? [],
        createdAt: enc.createdAt,
        updatedAt: enc.updatedAt,
      };
    }

    const body = {
      version: 1,
      campaign,
      adventures,
      encounters,
      players,
      inpcs,
      notes,
      partyInventory,
      treasure,
      conditions,
      combats,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=campaign_${campaignId}.json`
    );
    res.send(JSON.stringify(body, null, 2));
  });

  // ── Import campaign ───────────────────────────────────────────────────────
  app.post("/api/campaigns/import", requireAdmin, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });

    let doc: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(req.file.buffer.toString("utf-8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return res.status(400).json({ ok: false, message: "Invalid campaign JSON" });
      }
      doc = parsed as Record<string, unknown>;
    } catch {
      return res.status(400).json({ ok: false, message: "Invalid JSON" });
    }

    const campaign = doc["campaign"];
    if (!campaign || typeof campaign !== "object" || !("id" in campaign)) {
      return res.status(400).json({ ok: false, message: "Missing campaign.id" });
    }

    const c = campaign as Record<string, unknown>;
    const campaignId = String(c["id"]);

    db.transaction(() => {
      // Remove existing data — FK CASCADE deletes all children
      db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);

      // Insert campaign
      db.prepare(`
        INSERT INTO campaigns (id, name, color, image_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        campaignId,
        String(c["name"] ?? ""),
        (c["color"] as string | null) ?? null,
        (c["imageUrl"] as string | null) ?? null,
        Number(c["createdAt"] ?? Date.now()),
        Number(c["updatedAt"] ?? Date.now())
      );

      // Adventures
      const adventures = toArray(doc["adventures"]);
      for (const a of adventures) {
        db.prepare(`
          INSERT OR IGNORE INTO adventures (id, campaign_id, name, status, sort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(a["id"]),
          campaignId,
          String(a["name"] ?? ""),
          String(a["status"] ?? "active"),
          Number(a["sort"] ?? 0),
          Number(a["createdAt"] ?? Date.now()),
          Number(a["updatedAt"] ?? Date.now())
        );
      }

      // Encounters
      const encounters = toArray(doc["encounters"]);
      for (const e of encounters) {
        const combat = e["combat"] as Record<string, unknown> | undefined;
        db.prepare(`
          INSERT OR IGNORE INTO encounters
            (id, campaign_id, adventure_id, name, status, sort,
             combat_round, combat_active_combatant_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(e["id"]),
          campaignId,
          String(e["adventureId"] ?? ""),
          String(e["name"] ?? ""),
          String(e["status"] ?? "Open"),
          Number(e["sort"] ?? 0),
          combat?.round != null ? Number(combat.round) : null,
          combat?.activeCombatantId != null ? String(combat.activeCombatantId) : null,
          Number(e["createdAt"] ?? Date.now()),
          Number(e["updatedAt"] ?? Date.now())
        );
      }

      // Players
      const players = toArray(doc["players"]);
      for (const p of players) {
        db.prepare(`
          INSERT OR IGNORE INTO players
            (id, campaign_id, user_id, character_id, sheet_json, live_json, image_url, shared_notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(p["id"]),
          campaignId,
          (p["userId"] as string | null) ?? null,
          (p["characterId"] as string | null) ?? null,
          serializeCampaignCharacterSheet({
            playerName: String(p["playerName"] ?? ""),
            characterName: String(p["characterName"] ?? ""),
            class: String(p["class"] ?? ""),
            species: String(p["species"] ?? ""),
            level: Number(p["level"] ?? 1),
            hpMax: Number(p["hpMax"] ?? 10),
            ac: Number(p["ac"] ?? 10),
            ...(p["speed"] != null ? { speed: Number(p["speed"]) } : {}),
            ...(p["str"] != null ? { str: Number(p["str"]) } : {}),
            ...(p["dex"] != null ? { dex: Number(p["dex"]) } : {}),
            ...(p["con"] != null ? { con: Number(p["con"]) } : {}),
            ...(p["int"] != null ? { int: Number(p["int"]) } : {}),
            ...(p["wis"] != null ? { wis: Number(p["wis"]) } : {}),
            ...(p["cha"] != null ? { cha: Number(p["cha"]) } : {}),
            ...((p["color"] as string | null) != null ? { color: p["color"] as string } : {}),
          }),
          serializeCampaignCharacterLive({
            hpCurrent: Number(p["hpCurrent"] ?? 10),
            overrides: (p["overrides"] as any) ?? DEFAULT_OVERRIDES,
            conditions: (p["conditions"] as any) ?? [],
            ...(p["deathSaves"] != null ? { deathSaves: p["deathSaves"] as any } : {}),
          }),
          (p["imageUrl"] as string | null) ?? null,
          String(p["sharedNotes"] ?? ""),
          Number(p["createdAt"] ?? Date.now()),
          Number(p["updatedAt"] ?? Date.now())
        );
      }

      // iNPCs
      const inpcs = toArray(doc["inpcs"]);
      for (const i of inpcs) {
        db.prepare(`
          INSERT OR IGNORE INTO inpcs
            (id, campaign_id, monster_id, name, label, friendly,
             hp_max, hp_current, hp_details, ac, ac_details, sort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(i["id"]),
          campaignId,
          String(i["monsterId"] ?? ""),
          String(i["name"] ?? ""),
          (i["label"] as string | null) ?? null,
          Boolean(i["friendly"]) ? 1 : 0,
          Number(i["hpMax"] ?? 1),
          Number(i["hpCurrent"] ?? 1),
          (i["hpDetails"] as string | null) ?? null,
          Number(i["ac"] ?? 10),
          (i["acDetails"] as string | null) ?? null,
          i["sort"] != null ? Number(i["sort"]) : null,
          Number(i["createdAt"] ?? Date.now()),
          Number(i["updatedAt"] ?? Date.now())
        );
      }

      // Notes
      const notes = toArray(doc["notes"]);
      for (const n of notes) {
        db.prepare(`
          INSERT OR IGNORE INTO notes (id, campaign_id, adventure_id, note_json, sort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(n["id"]),
          campaignId,
          (n["adventureId"] as string | null) ?? null,
          serializeNoteState({
            title: String(n["title"] ?? ""),
            text: String(n["text"] ?? ""),
          }),
          Number(n["sort"] ?? 0),
          Number(n["createdAt"] ?? Date.now()),
          Number(n["updatedAt"] ?? Date.now())
        );
      }

      // Treasure
      const treasure = toArray(doc["treasure"]);
      for (const t of treasure) {
        db.prepare(`
          INSERT OR IGNORE INTO treasure
            (id, campaign_id, adventure_id, entry_json, sort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(t["id"]),
          campaignId,
          (t["adventureId"] as string | null) ?? null,
          serializeTreasureState({
            source: t["source"] === "custom" ? "custom" : "compendium",
            itemId: (t["itemId"] as string | null) ?? null,
            name: String(t["name"] ?? ""),
            rarity: (t["rarity"] as string | null) ?? null,
            type: (t["type"] as string | null) ?? null,
            type_key: (t["type_key"] as string | null) ?? null,
            attunement: Boolean(t["attunement"]),
            magic: Boolean(t["magic"]),
            text: String(t["text"] ?? ""),
            qty: Number(t["qty"] ?? 1),
          }),
          Number(t["sort"] ?? 0),
          Number(t["createdAt"] ?? Date.now()),
          Number(t["updatedAt"] ?? Date.now())
        );
      }

      const partyInventory = toArray(doc["partyInventory"]);
      for (const item of partyInventory) {
        db.prepare(`
          INSERT OR IGNORE INTO party_inventory
            (id, campaign_id, item_json, sort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          String(item["id"]),
          campaignId,
          JSON.stringify({
            name: String(item["name"] ?? "New Item"),
            quantity: Number(item["quantity"] ?? 1),
            weight: item["weight"] != null ? Number(item["weight"]) : null,
            notes: String(item["notes"] ?? ""),
            source: (item["source"] as string | null) ?? null,
            itemId: (item["itemId"] as string | null) ?? null,
            rarity: (item["rarity"] as string | null) ?? null,
            type: (item["type"] as string | null) ?? null,
            description: (item["description"] as string | null) ?? null,
          }),
          Number(item["sort"] ?? 0),
          Number(item["createdAt"] ?? Date.now()),
          Number(item["updatedAt"] ?? Date.now())
        );
      }

      // Conditions
      const conditions = toArray(doc["conditions"]);
      for (const cond of conditions) {
        db.prepare(`
          INSERT OR IGNORE INTO conditions (id, campaign_id, key, name, description, sort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(cond["id"]),
          campaignId,
          String(cond["key"] ?? ""),
          String(cond["name"] ?? ""),
          (cond["description"] as string | null) ?? null,
          cond["sort"] != null ? Number(cond["sort"]) : null,
          Number(cond["createdAt"] ?? Date.now()),
          Number(cond["updatedAt"] ?? Date.now())
        );
      }

      // Combats + combatants
      const combats = toArray(doc["combats"]);
      for (const combat of combats) {
        const encId = String(combat["encounterId"]);
        ensureCombat(db, encId);

        // Update combat state
        db.prepare(
          "UPDATE combats SET round=?, active_combatant_id=? WHERE encounter_id=?"
        ).run(
          Number(combat["round"] ?? 1),
          (combat["activeCombatantId"] as string | null) ?? null,
          encId
        );

        const combatants = Array.isArray(combat["combatants"])
          ? (combat["combatants"] as Record<string, unknown>[])
          : [];
        for (const [ci, raw] of combatants.entries()) {
          const c: StoredEncounterActor = {
            id: String(raw["id"] ?? ctx.helpers.uid()),
            encounterId: encId,
            baseType: (raw["baseType"] as any) ?? "monster",
            baseId: String(raw["baseId"] ?? ""),
            name: String(raw["name"] ?? ""),
            label: String(raw["label"] ?? ""),
            initiative: raw["initiative"] != null ? Number(raw["initiative"]) : null,
            friendly: Boolean(raw["friendly"]),
            color: String(raw["color"] ?? "#cccccc"),
            hpCurrent: raw["hpCurrent"] != null ? Number(raw["hpCurrent"]) : null,
            hpMax: raw["hpMax"] != null ? Number(raw["hpMax"]) : null,
            hpDetails: (raw["hpDetails"] as string | null) ?? null,
            ac: raw["ac"] != null ? Number(raw["ac"]) : null,
            acDetails: (raw["acDetails"] as string | null) ?? null,
            sort: raw["sort"] != null ? Number(raw["sort"]) : ci + 1,
            usedReaction: Boolean(raw["usedReaction"]),
            usedLegendaryActions: Number(raw["usedLegendaryActions"] ?? 0),
            overrides: (raw["overrides"] as any) ?? DEFAULT_OVERRIDES,
            conditions: Array.isArray(raw["conditions"]) ? raw["conditions"] : [],
            deathSaves: (raw["deathSaves"] as any) ?? DEFAULT_DEATH_SAVES,
            usedSpellSlots:
              (raw["usedSpellSlots"] as Record<string, number> | undefined) ?? {},
            attackOverrides: (raw["attackOverrides"] as any) ?? null,
            createdAt: Number(raw["createdAt"] ?? Date.now()),
            updatedAt: Number(raw["updatedAt"] ?? Date.now()),
          };
          try {
            insertCombatant(db, c);
          } catch {
            // Skip duplicates on re-import
          }
        }
      }

      seedDefaultConditions(db, campaignId);
    })();

    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true, campaignId });
  });

  // ── Legacy: full data export (debug) ─────────────────────────────────────
  app.get("/api/user/export", requireAdmin, (_req, res) => {
    const campaigns = (
      db.prepare("SELECT id, name, color, image_url, created_at, updated_at FROM campaigns").all() as Record<string, unknown>[]
    ).map(rowToCampaign);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=userData.json");
    res.send(JSON.stringify({ campaigns }, null, 2));
  });
}

/** Converts an object-map (id→item) or array to an array of items. */
function toArray(v: unknown): Record<string, unknown>[] {
  if (!v || typeof v !== "object") return [];
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  return Object.values(v as Record<string, unknown>) as Record<string, unknown>[];
}
