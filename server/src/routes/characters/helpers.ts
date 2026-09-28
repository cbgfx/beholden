import { createHash } from "node:crypto";
import { z } from "zod";
import type { Response } from "express";
import type { CharacterCampaignAssignmentDto } from "@beholden/shared/api";
import type { Db } from "../../lib/db.js";
import type { Assignment } from "../../services/characters.js";
import type { ServerContext } from "../../server/context.js";
import { ConditionInstanceSchema } from "../../lib/schemas.js";

// MARK: - Inventory Rev
/**
 * Opaque revision of a character's stored inventory. Two calls return the same
 * string iff `inventory` and `inventoryContainers` are byte-identical, so a
 * `PUT` that carries the wrong `expectedInventoryRev` can be rejected instead of
 * clobbering a concurrent edit (another device, or a DM treasure award).
 */
export function inventoryRevOf(characterData: Record<string, unknown> | null | undefined): string {
  const inventory = characterData?.["inventory"] ?? [];
  const containers = characterData?.["inventoryContainers"] ?? [];
  return createHash("sha1")
    .update(`${JSON.stringify(inventory)}\u0000${JSON.stringify(containers)}`)
    .digest("hex")
    .slice(0, 16);
}

/** Opaque revision for whole-value spell fields that must not overwrite another device's change. */
export function spellStateRevOf(characterData: Record<string, unknown> | null | undefined): string {
  const state = {
    usedSpellSlots: characterData?.usedSpellSlots ?? {},
    classSpellSelections: characterData?.classSpellSelections ?? {},
    trackedSpells: (characterData?.proficiencies as Record<string, unknown> | undefined)?.spells ?? [],
    concentrationSpell: characterData?.concentrationSpell ?? null,
  };
  return createHash("sha1").update(JSON.stringify(state)).digest("hex").slice(0, 16);
}

// MARK: - Make Emit Player Change
export function makeEmitPlayerChange(ctx: ServerContext) {
  return (args: { campaignId: string; action: "upsert" | "delete" | "refresh"; playerId?: string; characterId?: string | null }) => {
    ctx.broadcast("players:delta", {
      campaignId: args.campaignId,
      action: args.action,
      ...(args.playerId ? { playerId: args.playerId } : {}),
      ...(args.characterId !== undefined ? { characterId: args.characterId } : {}),
    });
  };
}

const CharacterBodyBase = z.object({
  name: z.string().trim().min(1).optional(),
  playerName: z.string().trim().optional(),
  className: z.string().trim().optional(),
  species: z.string().trim().optional(),
  level: z.number().int().min(1).max(20).optional(),
  hpMax: z.number().int().min(0).optional(),
  hpCurrent: z.number().int().min(0).optional(),
  ac: z.number().int().optional(),
  speed: z.number().int().optional(),
  strScore: z.number().int().min(1).max(30).nullable().optional(),
  dexScore: z.number().int().min(1).max(30).nullable().optional(),
  conScore: z.number().int().min(1).max(30).nullable().optional(),
  intScore: z.number().int().min(1).max(30).nullable().optional(),
  wisScore: z.number().int().min(1).max(30).nullable().optional(),
  chaScore: z.number().int().min(1).max(30).nullable().optional(),
  color: z.string().optional(),
  characterData: z.record(z.string(), z.unknown()).nullable().optional(),
  syncedAc: z.number().int().min(1).optional(),
  syncedHpMax: z.number().int().min(1).optional(),
  syncedSpeed: z.number().int().optional(),
  progressionClassEntryId: z.string().trim().min(1).optional(),
  expectedCharacterRevision: z.number().int().nonnegative().optional(),
  // Required by the route whenever inventory or its containers are replaced;
  // omitted by callers that are not editing inventory.
  expectedInventoryRev: z.string().max(64).optional(),
  expectedSpellStateRev: z.string().max(64).optional(),
});

const CharacterTransferOverrides = z.object({
  tempHp: z.number().int().default(0),
  acBonus: z.number().int().default(0),
  hpMaxBonus: z.number().int().default(0),
  inspiration: z.boolean().default(false),
  abilityScores: z.object({
    str: z.number().int().min(-30).max(30).optional(),
    dex: z.number().int().min(-30).max(30).optional(),
    con: z.number().int().min(-30).max(30).optional(),
    int: z.number().int().min(-30).max(30).optional(),
    wis: z.number().int().min(-30).max(30).optional(),
    cha: z.number().int().min(-30).max(30).optional(),
  }).optional(),
  permanent: z.object({
    acBonus: z.boolean().optional(),
    hpMaxBonus: z.boolean().optional(),
    abilityScores: z.boolean().optional(),
  }).optional(),
}).strict();

export const CharacterCreateBody = CharacterBodyBase.extend({
  name: z.string().trim().min(1),
  ruleset: z.enum(["5e", "5.5e"]),
  creationToken: z.string().trim().min(16).max(128).optional(),
  conditions: z.array(ConditionInstanceSchema).max(100).optional(),
  overrides: CharacterTransferOverrides.optional(),
  deathSaves: z.object({
    success: z.number().int().min(0).max(3),
    fail: z.number().int().min(0).max(3),
  }).strict().optional(),
  sharedNotes: z.string().max(200_000).optional(),
  isActive: z.boolean().optional(),
});
export const CharacterUpdateBody = CharacterBodyBase;

export const AssignBody = z.object({
  campaignIds: z.array(z.string()).min(1),
});

export const UnassignBody = z.object({
  campaignId: z.string(),
});

export const OverridesBody = z.object({
  tempHp: z.number().int(),
  acBonus: z.number().int(),
  hpMaxBonus: z.number().int(),
  // A bonus stacked on the character's score (Permanent Buffs), not the
  // absolute score itself -- can legitimately be negative (a curse/debuff).
  // The 1-30 range applies to the resulting score, computed client-side.
  abilityScores: z.object({
    str: z.number().int().min(-30).max(30).optional(),
    dex: z.number().int().min(-30).max(30).optional(),
    con: z.number().int().min(-30).max(30).optional(),
    int: z.number().int().min(-30).max(30).optional(),
    wis: z.number().int().min(-30).max(30).optional(),
    cha: z.number().int().min(-30).max(30).optional(),
  }).optional(),
  permanent: z.object({
    acBonus: z.boolean().optional(),
    hpMaxBonus: z.boolean().optional(),
    abilityScores: z.boolean().optional(),
  }).optional(),
});

// MARK: - To Character Sheet Dto Input
export function toCharacterSheetDtoInput(
  character: {
    id: string;
    userId: string;
    name: string;
    playerName: string;
    ruleset: "5e" | "5.5e";
    className: string;
    species: string;
    level: number;
    hpMax: number;
    hpCurrent: number;
    ac: number;
    speed: number;
    strScore: number | null;
    dexScore: number | null;
    conScore: number | null;
    intScore: number | null;
    wisScore: number | null;
    chaScore: number | null;
    color: string | null;
    imageUrl: string | null;
    characterData: Record<string, unknown> | null;
    // What the app worked out from items and feats, kept in its own columns (lib/sheetLiveColumns.ts).
    derivedHpMax?: number | null;
    derivedSpeed?: number | null;
    sharedNotes: string;
    isActive?: boolean;
    createdAt: number;
    updatedAt: number;
    deathSaves?: { success: number; fail: number } | undefined;
    conditions?: Array<Record<string, unknown>> | undefined;
    overrides?: {
      tempHp: number;
      acBonus: number;
      hpMaxBonus: number;
      inspiration?: boolean;
      abilityScores?: {
        str?: number | undefined;
        dex?: number | undefined;
        con?: number | undefined;
        int?: number | undefined;
        wis?: number | undefined;
        cha?: number | undefined;
      } | undefined;
    } | undefined;
  },
  campaigns: CharacterCampaignAssignmentDto[],
  campaignSharedNotes?: string,
) {
  return {
    id: character.id,
    userId: character.userId,
    name: character.name,
    playerName: character.playerName,
    ruleset: character.ruleset,
    className: character.className,
    species: character.species,
    level: character.level,
    hpMax: character.hpMax,
    hpCurrent: character.hpCurrent,
    ac: character.ac,
    speed: character.speed,
    strScore: character.strScore,
    dexScore: character.dexScore,
    conScore: character.conScore,
    intScore: character.intScore,
    wisScore: character.wisScore,
    chaScore: character.chaScore,
    color: character.color,
    imageUrl: character.imageUrl,
    characterData: character.characterData,
    // The home list and an export read these; the sheet works them out again for itself.
    ...(character.derivedHpMax != null ? { derivedHpMax: character.derivedHpMax } : {}),
    ...(character.derivedSpeed != null ? { derivedSpeed: character.derivedSpeed } : {}),
    sharedNotes: character.sharedNotes ?? "",
    isActive: character.isActive !== false,
    campaigns,
    ...(character.conditions ? { conditions: character.conditions } : {}),
    ...(character.overrides ? { overrides: character.overrides } : {}),
    ...(character.deathSaves ? { deathSaves: character.deathSaves } : {}),
    ...(campaignSharedNotes !== undefined ? { campaignSharedNotes } : {}),
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
  };
}

// MARK: - Require Owned Character
export function requireOwnedCharacter(db: Db, charId: string, userId: string, res: Response): { id: string } | null {
  const row = db.prepare("SELECT id FROM user_characters WHERE id = ? AND user_id = ?")
    .get(charId, userId) as { id: string } | undefined;
  if (!row) {
    res.status(404).json({ ok: false, message: "Not found" });
    return null;
  }
  return row;
}

// MARK: - Collect Campaign Shared Notes
export function collectCampaignSharedNotes(db: Db, assignments: Assignment[], charId: string): string {
  const campaignNotes: unknown[] = [];
  const seenNoteIds = new Set<string>();

  function pushNotes(raw: string | null | undefined) {
    if (!raw) return;
    let parsed: unknown[];
    try { parsed = JSON.parse(raw) as unknown[]; } catch { return; }
    for (const note of parsed) {
      const id = (note as { id?: unknown })?.id;
      if (typeof id === "string" && !seenNoteIds.has(id)) {
        seenNoteIds.add(id);
        campaignNotes.push(note);
      }
    }
  }

  for (const assignment of assignments) {
    const camp = db.prepare("SELECT shared_notes FROM campaigns WHERE id = ?")
      .get(assignment.campaign_id) as { shared_notes: string | null } | undefined;
    pushNotes(camp?.shared_notes);
    const otherPlayers = db.prepare(
      "SELECT shared_notes FROM player_rows WHERE campaign_id = ? AND character_id IS NOT NULL AND character_id != ? AND shared_notes != ''"
    ).all(assignment.campaign_id, charId) as { shared_notes: string }[];
    for (const player of otherPlayers) pushNotes(player.shared_notes);
  }

  return JSON.stringify(campaignNotes);
}
