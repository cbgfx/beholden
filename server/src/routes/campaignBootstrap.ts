import type { Express, Request } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import {
  ADVENTURE_COLS,
  CAMPAIGN_CHARACTER_COLS,
  INPC_COLS,
  rowToAdventure,
  rowToCampaignCharacter,
  rowToINpc,
} from "../lib/db.js";
import { toCampaignCharacterDto } from "../lib/apiActors.js";
import { withAbsoluteImageUrl } from "../lib/routeImageUrl.js";
import { dmOrAdmin } from "../middleware/campaignAuth.js";

function readPlayers(ctx: ServerContext, req: Request, campaignId: string) {
  const rows = ctx.db.prepare(`
    SELECT p.${CAMPAIGN_CHARACTER_COLS.split(", ").join(", p.")},
           json_extract(uc.character_data_json, '$.concentrationSpell') AS concentration_spell
    FROM players p
    LEFT JOIN user_characters uc ON uc.id = p.character_id
    WHERE p.campaign_id = ?
  `).all(campaignId) as Array<Record<string, unknown>>;
  return rows.map((row) => {
    const dto = toCampaignCharacterDto(rowToCampaignCharacter(row));
    if (typeof row.concentration_spell === "string" && row.concentration_spell) {
      dto.live.concentrationSpell = row.concentration_spell;
    }
    return withAbsoluteImageUrl(req, dto);
  });
}

function readNoteSummaries(ctx: ServerContext, campaignId: string) {
  const rows = ctx.db.prepare(`
    SELECT id, campaign_id, title, sort, updated_at
    FROM notes
    WHERE campaign_id = ? AND adventure_id IS NULL
    ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC
  `).all(campaignId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    adventureId: null as string | null,
    title: row.title,
    sort: row.sort,
    updatedAt: row.updated_at,
  }));
}

function readTreasureSummaries(ctx: ServerContext, campaignId: string) {
  const rows = ctx.db.prepare(`
    SELECT
      t.id, t.campaign_id, t.adventure_id, t.encounter_id, t.item_id,
      CASE
        WHEN TRIM(COALESCE(t.name, '')) = '' OR t.name = 'New Item'
          THEN COALESCE(NULLIF(TRIM(ci.name), ''), t.name)
        ELSE t.name
      END AS resolved_name,
      COALESCE(ci.rarity, t.rarity) AS resolved_rarity,
      COALESCE(ci.type, t.type) AS resolved_type,
      CASE WHEN ci.id IS NULL THEN t.attunement ELSE ci.attunement END AS resolved_attunement,
      CASE WHEN ci.id IS NULL THEN t.magic ELSE ci.magic END AS resolved_magic,
      t.qty, t.sort, t.updated_at
    FROM treasure t
    LEFT JOIN compendium_items ci ON ci.id = t.item_id
    WHERE t.campaign_id = ? AND t.adventure_id IS NULL
    ORDER BY COALESCE(t.sort, 9999) ASC, t.updated_at DESC
  `).all(campaignId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    adventureId: row.adventure_id,
    encounterId: row.encounter_id,
    itemId: row.item_id,
    name: row.resolved_name,
    qty: row.qty,
    rarity: row.resolved_rarity,
    type: row.resolved_type,
    attunement: Boolean(row.resolved_attunement),
    magic: Boolean(row.resolved_magic),
    sort: row.sort,
    updatedAt: row.updated_at,
  }));
}

export function registerCampaignBootstrapRoute(app: Express, ctx: ServerContext) {
  app.get("/api/campaigns/:campaignId/bootstrap", dmOrAdmin(ctx.db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const campaign = ctx.db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!campaign) return res.status(404).json({ ok: false, message: "Campaign not found" });

    const adventures = ctx.db.prepare(`
      SELECT ${ADVENTURE_COLS}
      FROM adventures
      WHERE campaign_id = ?
      ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC
    `).all(campaignId) as Array<Record<string, unknown>>;
    const inpcs = ctx.db.prepare(`
      SELECT ${INPC_COLS}
      FROM inpcs
      WHERE campaign_id = ?
    `).all(campaignId) as Array<Record<string, unknown>>;

    res.json({
      adventures: adventures.map(rowToAdventure),
      players: readPlayers(ctx, req, campaignId),
      inpcs: inpcs.map(rowToINpc),
      notes: readNoteSummaries(ctx, campaignId),
      treasure: readTreasureSummaries(ctx, campaignId),
    });
  });
}
