// server/src/services/characterDeletion.ts
// Taking a player out of a campaign, and deleting a character sheet along with its players.

import type { ServerContext } from "../server/context.js";
import { deleteImageFiles, removeCharacterImageFiles } from "../lib/imageHelpers.js";
import { getAssignedPlayers } from "./characters.js";
import { removePlayerCombatants } from "./combat.removal.js";

type TeardownContext = Pick<ServerContext, "db" | "broadcast" | "fs" | "path" | "paths">;

/**
 * Takes one player out of its campaign: out of every encounter it stood in, off the roster (the DM is
 * told), and its campaign portrait copy removed. The character sheet it was made from is untouched.
 *
 * Used when a character is unassigned, when its owner is removed from the campaign, and (through
 * deleteCharacterWithPlayers) when the character itself is deleted.
 */
export function removePlayerFromCampaign(
  ctx: TeardownContext,
  player: { id: string; campaignId: string; characterId: string | null },
): void {
  removePlayerCombatants(ctx.db, ctx.broadcast, player.id);
  ctx.db.prepare("DELETE FROM players WHERE id = ?").run(player.id);
  ctx.broadcast("players:delta", { campaignId: player.campaignId, action: "delete", playerId: player.id, characterId: player.characterId });
  deleteImageFiles(ctx, ctx.path.join(ctx.paths.dataDir, "player-images"), player.id);
}

/**
 * Takes a user's players out of one campaign, as when an admin removes them from it. Their
 * characters stay on their account, simply no longer assigned there.
 */
export function removeUserPlayersFromCampaign(ctx: TeardownContext, userId: string, campaignId: string): number {
  const players = ctx.db
    .prepare("SELECT id, character_id FROM player_rows WHERE user_id = ? AND campaign_id = ?")
    .all(userId, campaignId) as Array<{ id: string; character_id: string | null }>;
  for (const player of players) removePlayerFromCampaign(ctx, { id: player.id, campaignId, characterId: player.character_id });
  return players.length;
}

/**
 * Deletes a character and its campaign players. Every player the sheet was assigned as leaves its
 * campaign as above, then the sheet and its portraits go.
 *
 * The foreign keys alone would only set `players.character_id` to NULL, leaving a nameless player
 * in the roster and in any fight. So every path that deletes a character - the player deleting it,
 * or an admin deleting the whole account - must come through here.
 */
export function deleteCharacterWithPlayers(ctx: TeardownContext, characterId: string): void {
  const assignedPlayers = getAssignedPlayers(ctx.db, characterId);
  for (const { player_id, campaign_id } of assignedPlayers) {
    removePlayerFromCampaign(ctx, { id: player_id, campaignId: campaign_id, characterId });
  }
  ctx.db.prepare("DELETE FROM user_characters WHERE id = ?").run(characterId);
  removeCharacterImageFiles(ctx, characterId, []);
}
