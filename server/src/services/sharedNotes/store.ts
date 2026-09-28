// server/src/services/sharedNotes/store.ts
//
// Shared notes are stored as one JSON string, and three different rows can hold a copy of the same
// list: a campaign owns its own, a character owns the player's, and every `players` row the
// character is assigned to carries a copy of the character's so the DM app can read it without
// joining. Writing one copy and not the others is what let the DM's edit be reverted by the
// player's next save, so every write goes through here.

import type { Db } from "../../lib/db.js";

export type SharedNotesOwner =
  | { kind: "campaign"; campaignId: string }
  | { kind: "player"; playerId: string }
  | { kind: "character"; characterId: string };

/** A player row that now holds a new copy, so the route knows who to tell. */
type AffectedPlayer = { playerId: string; campaignId: string; characterId: string | null };

export type SharedNotesWrite = {
  /** Set when the campaign's own notes changed, so the DM app can refresh the campaign. */
  campaignId: string | null;
  players: AffectedPlayer[];
};

function assignedPlayers(db: Db, characterId: string): AffectedPlayer[] {
  return (db.prepare("SELECT id AS playerId, campaign_id AS campaignId FROM player_rows WHERE character_id = ?")
    .all(characterId) as Array<{ playerId: string; campaignId: string }>)
    .map((row) => ({ ...row, characterId }));
}

/** The notes currently stored for an owner, or null when the owner itself is gone. */
export function readSharedNotes(db: Db, owner: SharedNotesOwner): string | null {
  const row = (() => {
    switch (owner.kind) {
      case "campaign":
        return db.prepare("SELECT shared_notes FROM campaigns WHERE id = ?").get(owner.campaignId);
      case "player":
        return db.prepare("SELECT shared_notes FROM player_rows WHERE id = ?").get(owner.playerId);
      case "character":
        return db.prepare("SELECT shared_notes FROM user_characters WHERE id = ?").get(owner.characterId);
    }
  })() as { shared_notes: string | null } | undefined;
  if (!row) return null;
  return row.shared_notes ?? "";
}

/**
 * Stores a new list for an owner and keeps every copy of it in step.
 *
 * Editing through a player row writes the character that owns the notes and every other campaign
 * that character plays in, which is exactly what the player's own save does - so whichever side
 * makes the change, both sides see the same list afterwards.
 */
export function writeSharedNotes(db: Db, owner: SharedNotesOwner, value: string, t: number): SharedNotesWrite {
  const setPlayer = db.prepare("UPDATE players SET shared_notes = ?, updated_at = ? WHERE id = ?");
  const setCharacter = db.prepare("UPDATE user_characters SET shared_notes = ?, updated_at = ? WHERE id = ?");

  if (owner.kind === "campaign") {
    db.prepare("UPDATE campaigns SET shared_notes = ?, updated_at = ? WHERE id = ?").run(value, t, owner.campaignId);
    return { campaignId: owner.campaignId, players: [] };
  }

  const characterId = owner.kind === "character"
    ? owner.characterId
    : (db.prepare("SELECT character_id FROM player_rows WHERE id = ?").get(owner.playerId) as { character_id: string | null } | undefined)?.character_id ?? null;

  return {
    campaignId: null,
    players: db.transaction(() => {
      if (!characterId) {
        // A campaign row with no character behind it keeps its notes to itself.
        const playerId = (owner as { playerId: string }).playerId;
        setPlayer.run(value, t, playerId);
        const row = db.prepare("SELECT campaign_id FROM player_rows WHERE id = ?").get(playerId) as { campaign_id: string } | undefined;
        return row ? [{ playerId, campaignId: row.campaign_id, characterId: null }] : [];
      }
      setCharacter.run(value, t, characterId);
      const affected = assignedPlayers(db, characterId);
      for (const player of affected) setPlayer.run(value, t, player.playerId);
      return affected;
    })(),
  };
}
