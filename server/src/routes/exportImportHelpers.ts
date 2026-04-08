import type { Db } from "../lib/db.js";
import { ensureCombat, insertCombatant } from "../services/combat.js";
import { DEFAULT_DEATH_SAVES, DEFAULT_OVERRIDES } from "../lib/defaults.js";
import { seedDefaultConditions } from "../services/conditions.js";
import { serializeCampaignCharacterLive, serializeCampaignCharacterSheet } from "../services/characters.js";
import type {
  StoredConditionInstance,
  StoredDeathSaves,
  StoredEncounterActor,
  StoredNoteState,
  StoredOverrides,
  StoredTreasureState,
} from "../server/userData.js";

const serializeNoteState = (note: StoredNoteState) => JSON.stringify(note);
const serializeTreasureState = (entry: StoredTreasureState) => JSON.stringify(entry);

export function importCampaignDocument(db: Db, doc: Record<string, unknown>, uid: () => string): string {
  const campaign = doc["campaign"];
  if (!campaign || typeof campaign !== "object" || !("id" in campaign)) {
    throw new Error("Missing campaign.id");
  }

  const c = campaign as Record<string, unknown>;
  const campaignId = String(c["id"]);

  db.transaction(() => {
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);

    db.prepare(`
      INSERT INTO campaigns (id, name, color, image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      campaignId,
      String(c["name"] ?? ""),
      (c["color"] as string | null) ?? null,
      (c["imageUrl"] as string | null) ?? null,
      Number(c["createdAt"] ?? Date.now()),
      Number(c["updatedAt"] ?? Date.now()),
    );

    const adventures = toArray(doc["adventures"]);
    for (const adventure of adventures) {
      db.prepare(`
        INSERT OR IGNORE INTO adventures (id, campaign_id, name, status, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(adventure["id"]),
        campaignId,
        String(adventure["name"] ?? ""),
        String(adventure["status"] ?? "active"),
        Number(adventure["sort"] ?? 0),
        Number(adventure["createdAt"] ?? Date.now()),
        Number(adventure["updatedAt"] ?? Date.now()),
      );
    }

    const encounters = toArray(doc["encounters"]);
    for (const encounter of encounters) {
      const combat = encounter["combat"] as Record<string, unknown> | undefined;
      db.prepare(`
        INSERT OR IGNORE INTO encounters
          (id, campaign_id, adventure_id, name, status, sort,
           combat_round, combat_active_combatant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(encounter["id"]),
        campaignId,
        String(encounter["adventureId"] ?? ""),
        String(encounter["name"] ?? ""),
        String(encounter["status"] ?? "Open"),
        Number(encounter["sort"] ?? 0),
        combat?.round != null ? Number(combat.round) : null,
        combat?.activeCombatantId != null ? String(combat.activeCombatantId) : null,
        Number(encounter["createdAt"] ?? Date.now()),
        Number(encounter["updatedAt"] ?? Date.now()),
      );
    }

    const players = toArray(doc["players"]);
    for (const player of players) {
      db.prepare(`
        INSERT OR IGNORE INTO players
          (id, campaign_id, user_id, character_id, sheet_json, live_json, image_url, shared_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(player["id"]),
        campaignId,
        (player["userId"] as string | null) ?? null,
        (player["characterId"] as string | null) ?? null,
        serializeCampaignCharacterSheet({
          playerName: String(player["playerName"] ?? ""),
          characterName: String(player["characterName"] ?? ""),
          class: String(player["class"] ?? ""),
          species: String(player["species"] ?? ""),
          level: Number(player["level"] ?? 1),
          hpMax: Number(player["hpMax"] ?? 10),
          ac: Number(player["ac"] ?? 10),
          ...(player["speed"] != null ? { speed: Number(player["speed"]) } : {}),
          ...(player["str"] != null ? { str: Number(player["str"]) } : {}),
          ...(player["dex"] != null ? { dex: Number(player["dex"]) } : {}),
          ...(player["con"] != null ? { con: Number(player["con"]) } : {}),
          ...(player["int"] != null ? { int: Number(player["int"]) } : {}),
          ...(player["wis"] != null ? { wis: Number(player["wis"]) } : {}),
          ...(player["cha"] != null ? { cha: Number(player["cha"]) } : {}),
          ...((player["color"] as string | null) != null ? { color: player["color"] as string } : {}),
        }),
        serializeCampaignCharacterLive({
          hpCurrent: Number(player["hpCurrent"] ?? 10),
          overrides: (player["overrides"] as StoredOverrides | undefined) ?? DEFAULT_OVERRIDES,
          conditions: (player["conditions"] as StoredConditionInstance[] | undefined) ?? [],
          ...(player["deathSaves"] != null ? { deathSaves: player["deathSaves"] as StoredDeathSaves } : {}),
        }),
        (player["imageUrl"] as string | null) ?? null,
        String(player["sharedNotes"] ?? ""),
        Number(player["createdAt"] ?? Date.now()),
        Number(player["updatedAt"] ?? Date.now()),
      );
    }

    const inpcs = toArray(doc["inpcs"]);
    for (const inpc of inpcs) {
      db.prepare(`
        INSERT OR IGNORE INTO inpcs
          (id, campaign_id, monster_id, name, label, friendly,
           hp_max, hp_current, hp_details, ac, ac_details, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(inpc["id"]),
        campaignId,
        String(inpc["monsterId"] ?? ""),
        String(inpc["name"] ?? ""),
        (inpc["label"] as string | null) ?? null,
        Boolean(inpc["friendly"]) ? 1 : 0,
        Number(inpc["hpMax"] ?? 1),
        Number(inpc["hpCurrent"] ?? 1),
        (inpc["hpDetails"] as string | null) ?? null,
        Number(inpc["ac"] ?? 10),
        (inpc["acDetails"] as string | null) ?? null,
        inpc["sort"] != null ? Number(inpc["sort"]) : null,
        Number(inpc["createdAt"] ?? Date.now()),
        Number(inpc["updatedAt"] ?? Date.now()),
      );
    }

    const notes = toArray(doc["notes"]);
    for (const note of notes) {
      db.prepare(`
        INSERT OR IGNORE INTO notes (id, campaign_id, adventure_id, note_json, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(note["id"]),
        campaignId,
        (note["adventureId"] as string | null) ?? null,
        serializeNoteState({
          title: String(note["title"] ?? ""),
          text: String(note["text"] ?? ""),
        }),
        Number(note["sort"] ?? 0),
        Number(note["createdAt"] ?? Date.now()),
        Number(note["updatedAt"] ?? Date.now()),
      );
    }

    const treasure = toArray(doc["treasure"]);
    for (const entry of treasure) {
      db.prepare(`
        INSERT OR IGNORE INTO treasure
          (id, campaign_id, adventure_id, entry_json, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(entry["id"]),
        campaignId,
        (entry["adventureId"] as string | null) ?? null,
        serializeTreasureState({
          source: entry["source"] === "custom" ? "custom" : "compendium",
          itemId: (entry["itemId"] as string | null) ?? null,
          name: String(entry["name"] ?? ""),
          rarity: (entry["rarity"] as string | null) ?? null,
          type: (entry["type"] as string | null) ?? null,
          type_key: (entry["type_key"] as string | null) ?? null,
          attunement: Boolean(entry["attunement"]),
          magic: Boolean(entry["magic"]),
          text: String(entry["text"] ?? ""),
          qty: Number(entry["qty"] ?? 1),
        }),
        Number(entry["sort"] ?? 0),
        Number(entry["createdAt"] ?? Date.now()),
        Number(entry["updatedAt"] ?? Date.now()),
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
        Number(item["updatedAt"] ?? Date.now()),
      );
    }

    const conditions = toArray(doc["conditions"]);
    for (const condition of conditions) {
      db.prepare(`
        INSERT OR IGNORE INTO conditions (id, campaign_id, key, name, description, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(condition["id"]),
        campaignId,
        String(condition["key"] ?? ""),
        String(condition["name"] ?? ""),
        (condition["description"] as string | null) ?? null,
        condition["sort"] != null ? Number(condition["sort"]) : null,
        Number(condition["createdAt"] ?? Date.now()),
        Number(condition["updatedAt"] ?? Date.now()),
      );
    }

    const combats = toArray(doc["combats"]);
    for (const combat of combats) {
      const encounterId = String(combat["encounterId"]);
      ensureCombat(db, encounterId);
      db.prepare("UPDATE combats SET round=?, active_combatant_id=? WHERE encounter_id=?").run(
        Number(combat["round"] ?? 1),
        (combat["activeCombatantId"] as string | null) ?? null,
        encounterId,
      );

      const combatants = Array.isArray(combat["combatants"])
        ? (combat["combatants"] as Record<string, unknown>[])
        : [];
      for (const [index, raw] of combatants.entries()) {
        const combatant: StoredEncounterActor = {
          id: String(raw["id"] ?? uid()),
          encounterId,
          baseType: (raw["baseType"] as StoredEncounterActor["baseType"]) ?? "monster",
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
          sort: raw["sort"] != null ? Number(raw["sort"]) : index + 1,
          usedReaction: Boolean(raw["usedReaction"]),
          usedLegendaryActions: Number(raw["usedLegendaryActions"] ?? 0),
          overrides: (raw["overrides"] as StoredEncounterActor["overrides"]) ?? DEFAULT_OVERRIDES,
          conditions: Array.isArray(raw["conditions"]) ? raw["conditions"] : [],
          deathSaves: (raw["deathSaves"] as StoredEncounterActor["deathSaves"]) ?? DEFAULT_DEATH_SAVES,
          usedSpellSlots: (raw["usedSpellSlots"] as Record<string, number> | undefined) ?? {},
          attackOverrides: (raw["attackOverrides"] as StoredEncounterActor["attackOverrides"]) ?? null,
          createdAt: Number(raw["createdAt"] ?? Date.now()),
          updatedAt: Number(raw["updatedAt"] ?? Date.now()),
        };
        try {
          insertCombatant(db, combatant);
        } catch {
          // Skip duplicates on re-import
        }
      }
    }

    seedDefaultConditions(db, campaignId);
  })();

  return campaignId;
}

function toArray(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  return Object.values(value as Record<string, unknown>) as Record<string, unknown>[];
}
