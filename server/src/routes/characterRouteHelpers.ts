import { z } from "zod";
import type { Response } from "express";
import type { CharacterCampaignAssignmentDto } from "@beholden/shared/api";
import type { Db } from "../lib/db.js";
import type { Assignment } from "../services/characters.js";

export const CharacterBodyBase = z.object({
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
  syncedAc: z.number().int().optional(),
});

export const CharacterCreateBody = CharacterBodyBase.extend({ name: z.string().trim().min(1) });
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
  abilityScores: z.object({
    str: z.number().int().min(1).max(30).optional(),
    dex: z.number().int().min(1).max(30).optional(),
    con: z.number().int().min(1).max(30).optional(),
    int: z.number().int().min(1).max(30).optional(),
    wis: z.number().int().min(1).max(30).optional(),
    cha: z.number().int().min(1).max(30).optional(),
  }).optional(),
});

export function toCharacterSheetDtoInput(
  character: {
    id: string;
    userId: string;
    name: string;
    playerName: string;
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
    sharedNotes: string;
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
    sharedNotes: character.sharedNotes ?? "",
    campaigns,
    ...(character.conditions ? { conditions: character.conditions } : {}),
    ...(character.overrides ? { overrides: character.overrides } : {}),
    ...(character.deathSaves ? { deathSaves: character.deathSaves } : {}),
    ...(campaignSharedNotes !== undefined ? { campaignSharedNotes } : {}),
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
  };
}

export function requireOwnedCharacter(db: Db, charId: string, userId: string, res: Response): { id: string } | null {
  const row = db.prepare("SELECT id FROM user_characters WHERE id = ? AND user_id = ?")
    .get(charId, userId) as { id: string } | undefined;
  if (!row) {
    res.status(404).json({ ok: false, message: "Not found" });
    return null;
  }
  return row;
}

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
      "SELECT shared_notes FROM players WHERE campaign_id = ? AND character_id IS NOT NULL AND character_id != ? AND shared_notes != ''"
    ).all(assignment.campaign_id, charId) as { shared_notes: string }[];
    for (const player of otherPlayers) pushNotes(player.shared_notes);
  }

  return JSON.stringify(campaignNotes);
}
