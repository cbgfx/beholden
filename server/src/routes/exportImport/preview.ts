import type { CampaignImportPreview } from "@beholden/shared/api/campaignImport.ts";
import type { Db } from "../../lib/db.js";
import { migrateCampaignDocument } from "./migrate.js";

// Fixed table names only; uploaded values are always bound parameters.
const collections = {
  adventures: "adventures",
  encounters: "encounters",
  players: "player_rows",
  inpcs: "inpcs",
  notes: "notes",
  partyInventory: "party_inventory",
  treasure: "treasure",
  conditions: "conditions",
  bastions: "bastions",
} as const;

/** Uses the same migration and validation as restore, without writing any data. */
export function previewCampaignImport(
  db: Db,
  raw: unknown,
): CampaignImportPreview {
  const doc = migrateCampaignDocument(raw);
  const existing = db
    .prepare("SELECT name FROM campaigns WHERE id = ?")
    .get(doc.campaign.id) as { name: string } | undefined;
  const warnings: string[] = [];
  const counts = Object.entries(collections).map(([collection, table]) => {
    const entries = Object.values(doc[collection as keyof typeof collections]);
    const collision = db.prepare(
      `SELECT campaign_id FROM ${table} WHERE id = ? AND campaign_id <> ?`,
    );
    for (const entry of entries) {
      if (collision.get(entry.id, doc.campaign.id)) {
        throw new Error(
          `${collection}: record ${entry.id} already belongs to another campaign.`,
        );
      }
    }
    return {
      collection,
      incoming: entries.length,
      existing: Number(
        db
          .prepare(`SELECT count(*) FROM ${table} WHERE campaign_id = ?`)
          .pluck()
          .get(doc.campaign.id),
      ),
    };
  });
  if (
    doc.campaign.binderId &&
    !db.prepare("SELECT 1 FROM binders WHERE id = ?").get(doc.campaign.binderId)
  ) {
    warnings.push(
      "The linked Binder is missing. The campaign will be imported without it.",
    );
  }
  for (const player of Object.values(doc.players)) {
    if (
      player.userId &&
      !db.prepare("SELECT 1 FROM users WHERE id = ?").get(player.userId)
    ) {
      warnings.push(
        `Missing account link: ${player.characterName || player.id}. The player row will be imported without this link.`,
      );
    }
    if (
      player.characterId &&
      !db
        .prepare("SELECT 1 FROM user_characters WHERE id = ?")
        .get(player.characterId)
    ) {
      warnings.push(
        `Missing character link: ${player.characterName || player.id}. The player row will be imported without this link.`,
      );
    }
  }
  for (const npc of Object.values(doc.inpcs)) {
    if (
      npc.binderMortalId &&
      (!doc.campaign.binderId ||
        !db
          .prepare(
            "SELECT 1 FROM binder_records WHERE id = ? AND binder_id = ? AND record_type = 'mortal'",
          )
          .get(npc.binderMortalId, doc.campaign.binderId))
    ) {
      warnings.push(
        `Missing Binder mortal link: ${npc.name || npc.id}. The NPC will be imported without this link.`,
      );
    }
  }
  const combatIds = new Set<string>();
  for (const combat of Object.values(doc.combats)) {
    for (const actor of combat.combatants) {
      // Old backups may omit IDs; restore generates fresh ones for those actors.
      if (!actor.id) continue;
      if (
        combatIds.has(actor.id) ||
        db
          .prepare(
            "SELECT 1 FROM combatants WHERE id = ? AND encounter_id NOT IN (SELECT id FROM encounters WHERE campaign_id = ?)",
          )
          .get(actor.id, doc.campaign.id)
      ) {
        throw new Error(`Combatant ID collision: ${actor.id}.`);
      }
      combatIds.add(actor.id);
    }
  }
  return {
    campaignId: doc.campaign.id,
    name: doc.campaign.name,
    existingName: existing?.name ?? null,
    sameNameCampaigns: (
      db
        .prepare(
          "SELECT name FROM campaigns WHERE lower(trim(name)) = lower(trim(?)) AND id <> ?",
        )
        .all(doc.campaign.name, doc.campaign.id) as { name: string }[]
    ).map((row) => row.name),
    counts,
    warnings,
  };
}
