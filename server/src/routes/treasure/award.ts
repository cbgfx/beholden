import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import { rowToTreasure, TREASURE_COLS } from "../../lib/db.js";
import { toTreasureDto } from "../../lib/apiCollections.js";
import { dmOrAdmin } from "../../middleware/campaignAuth.js";
import { parseStoredPresentationEntry } from "../../services/compendium/storedCompendium.js";
import { hydrateTreasureEntry } from "./core.js";
import { currencyCodeForName } from "@beholden/shared/domain/items";
import { inventoryValidationProblem } from "../../services/inventoryValidation.js";

const TreasureAwardBody = z.object({
  playerId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
});

export function registerTreasureAwardRoute(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  app.post("/api/treasure/:treasureId/award", dmOrAdmin(db), (req, res) => {
    const treasureId = requireParam(req, res, "treasureId");
    if (!treasureId) return;
    const { playerId, quantity } = parseBody(TreasureAwardBody, req);
    const isPartyStash = playerId === "party";

    const result = db.transaction(() => {
      const treasureRow = db
        .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
        .get(treasureId) as Record<string, unknown> | undefined;
      if (!treasureRow) return { error: { status: 404, message: "Treasure not found" } } as const;

      const treasure = hydrateTreasureEntry(db, rowToTreasure(treasureRow));
      if (quantity > treasure.qty) {
        return { error: { status: 400, message: `Only ${treasure.qty} available` } } as const;
      }

      let itemDetail: Record<string, unknown> = {};
      if (treasure.itemId) {
        const itemRow = db
          .prepare("SELECT data_json FROM compendium_items WHERE id = ?")
          .get(treasure.itemId) as { data_json: string } | undefined;
        if (itemRow) {
          try {
            // Route through the same canonical projection every other item consumer uses, rather
            // than parsing data_json directly — the canonical shape nests ac/damage under
            // armor/weapon (e.g. `armor.ac`, `weapon.damage`), so a raw `data.ac` here was always
            // null. This also picks up `modifiers` (magic item enchantment bonuses) for free.
            const data = parseStoredPresentationEntry("items", itemRow.data_json) as Record<string, unknown>;
            itemDetail = {
              equippable: data.equippable === true,
              weight: data.weight ?? null,
              value: data.value ?? null,
              proficiency: data.proficiency ?? null,
              ac: data.ac ?? null,
              stealthDisadvantage: Boolean(data.stealthDisadvantage),
              dmg1: data.dmg1 ?? null,
              dmg2: data.dmg2 ?? null,
              dmgType: data.dmgType ?? null,
              properties: Array.isArray(data.properties) ? data.properties : [],
              modifiers: Array.isArray(data.modifiers) ? data.modifiers : [],
              effects: Array.isArray(data.effects) ? data.effects : null,
              resolution: data.resolution ?? null,
            };
          } catch {
            itemDetail = {};
          }
        }
      }

      let characterId: string | null = null;
      let partyItemId: string | null = null;

      if (isPartyStash) {
        const id = uid();
        const t = now();
        const maxSort = (db.prepare(
          "SELECT COALESCE(MAX(sort),0)+1 AS n FROM party_inventory WHERE campaign_id = ?"
        ).get(treasure.campaignId) as { n: number }).n;
        db.prepare(`
          INSERT INTO party_inventory
            (id, campaign_id, name, quantity, weight, notes, source, item_id, rarity, type, description, sort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          treasure.campaignId,
          treasure.name,
          quantity,
          (itemDetail.weight as number | null | undefined) ?? null,
          "",
          treasure.source,
          treasure.itemId,
          treasure.rarity,
          treasure.type,
          treasure.text || null,
          maxSort,
          t,
          t,
        );
        partyItemId = id;
      } else {
        const player = db
          .prepare("SELECT campaign_id, character_id FROM player_rows WHERE id = ?")
          .get(playerId) as { campaign_id: string; character_id: string | null } | undefined;
        if (!player || player.campaign_id !== treasure.campaignId) {
          return { error: { status: 404, message: "Player not found in this campaign" } } as const;
        }
        if (!player.character_id) {
          return { error: { status: 400, message: "This player has no linked character sheet" } } as const;
        }

        const characterRow = db
          .prepare("SELECT character_data_json FROM user_characters WHERE id = ?")
          .get(player.character_id) as { character_data_json: string | null } | undefined;
        if (!characterRow) {
          return { error: { status: 404, message: "Linked character sheet not found" } } as const;
        }

        let characterData: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(characterRow.character_data_json ?? "{}");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            characterData = parsed as Record<string, unknown>;
          }
        } catch {
          characterData = {};
        }
        const inventory = Array.isArray(characterData.inventory)
          ? [...characterData.inventory]
          : [];

        // Coins are one stack per denomination. The sheet's gold bar reads a single "GP" item, and a
        // second one is what broke a player's gold before: every later edit kept the first stack and
        // dropped the rest, so awarded coins would quietly vanish. A currency award therefore adds to
        // the stack the character already has.
        const currency = currencyCodeForName(treasure.name);
        const existingCoins = currency
          ? inventory.findIndex((entry) => currencyCodeForName((entry as { name?: string })?.name) === currency)
          : -1;
        if (existingCoins >= 0) {
          const stack = inventory[existingCoins] as { quantity?: unknown };
          const current = Number(stack.quantity);
          inventory[existingCoins] = { ...stack, quantity: (Number.isFinite(current) ? current : 0) + quantity };
        } else {
          inventory.push({
            id: uid(),
            name: treasure.name,
            quantity,
            equipped: false,
            equipState: "backpack",
            source: treasure.source,
            ...(treasure.itemId ? { itemId: treasure.itemId } : {}),
            rarity: treasure.rarity,
            type: treasure.type,
            attunement: treasure.attunement,
            attuned: false,
            magic: treasure.magic,
            silvered: false,
            description: treasure.text || undefined,
            ...itemDetail,
          });
        }

        const inventoryError = inventoryValidationProblem({ ...characterData, inventory });
        if (inventoryError) {
          return { error: { status: 400, ...inventoryError } } as const;
        }
        const t = now();
        db.prepare("UPDATE user_characters SET character_data_json = ?, updated_at = ? WHERE id = ?")
          .run(JSON.stringify({ ...characterData, inventory }), t, player.character_id);
        characterId = player.character_id;
      }

      const remaining = treasure.qty - quantity;
      if (remaining === 0) {
        db.prepare("DELETE FROM treasure WHERE id = ?").run(treasureId);
        return { treasure, characterId, partyItemId, remaining, treasureDto: null } as const;
      }

      db.prepare(
        "UPDATE treasure SET qty = ?, updated_at = ? WHERE id = ?",
      ).run(remaining, now(), treasureId);
      const updatedRow = db
        .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
        .get(treasureId) as Record<string, unknown>;
      return {
        treasure,
        characterId,
        partyItemId,
        remaining,
        treasureDto: toTreasureDto(hydrateTreasureEntry(db, rowToTreasure(updatedRow))),
      } as const;
    })();

    if ("error" in result) {
      const { status, ...error } = result.error;
      return res.status(status).json({ ok: false, ...error });
    }

    ctx.broadcast("treasure:delta", {
      campaignId: result.treasure.campaignId,
      adventureId: result.treasure.adventureId ?? null,
      encounterId: result.treasure.encounterId ?? null,
      action: result.remaining === 0 ? "delete" : "upsert",
      treasureId,
      ...(result.treasureDto ? { treasure: result.treasureDto } : {}),
    });
    if (result.partyItemId) {
      ctx.broadcast("partyInventory:delta", {
        campaignId: result.treasure.campaignId,
        action: "upsert",
        itemId: result.partyItemId,
      });
    } else {
      ctx.broadcast("players:delta", {
        campaignId: result.treasure.campaignId,
        action: "upsert",
        playerId,
        characterId: result.characterId,
      });
    }
    res.json({ ok: true, remaining: result.remaining });
  });
}
