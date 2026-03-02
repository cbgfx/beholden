// server/src/services/campaignStorage.ts
import path from "node:path";
import fs from "node:fs";
import { loadJson, saveJsonAtomic } from "../lib/jsonFile.js";
import type { Paths, UserData } from "../server/context.js";
import type {
  StoredCampaign,
  StoredAdventure,
  StoredEncounter,
  StoredNote,
  StoredTreasure,
  StoredPlayer,
  StoredINpc,
  StoredCondition,
  StoredCombat,
} from "../server/userData.js";

export function buildEmptyUserData(): UserData {
  return {
    version: 3,
    campaigns: {},
    adventures: {},
    encounters: {},
    notes: {},
    treasure: {},
    players: {},
    inpcs: {},
    conditions: {},
    combats: {},
  };
}

export function ensureCampaignIndexExists(paths: Paths) {
  if (fs.existsSync(paths.campaignsIndexPath)) return;
  saveJsonAtomic(paths.campaignsIndexPath, { version: 1, campaigns: {} });
}

export function campaignFilePath(paths: Paths, campaignId: string) {
  return path.join(paths.campaignsDir, `${campaignId}.json`);
}

/** Campaigns index shape stored in the top-level index file. */
type CampaignIndex = {
  version: number;
  campaigns: Record<string, StoredCampaign>;
};

/** Shape of each per-campaign JSON file on disk. */
type CampaignFile = Record<string, unknown>;

export function loadAllCampaignFiles(paths: Paths): UserData {
  const idx = loadJson<CampaignIndex>(paths.campaignsIndexPath, {
    version: 1,
    campaigns: {},
  });
  const ud = buildEmptyUserData();

  const campaignIds = Object.keys(idx.campaigns ?? {});
  for (const campaignId of campaignIds) {
    const fp = campaignFilePath(paths, campaignId);
    if (!fs.existsSync(fp)) continue;
    const doc = loadJson<CampaignFile>(fp, {});

    ud.campaigns[campaignId] = (doc["campaign"] ?? idx.campaigns[campaignId]) as StoredCampaign;

    mergeIfObject(ud.adventures, doc["adventures"]);
    mergeIfObject(ud.encounters, doc["encounters"]);
    mergeIfObject(ud.notes, doc["notes"]);
    mergeIfObject(ud.treasure, doc["treasure"]);
    mergeIfObject(ud.players, doc["players"]);
    mergeIfObject(ud.inpcs, doc["inpcs"]);
    mergeIfObject(ud.conditions, doc["conditions"]);
    mergeIfObject(ud.combats, doc["combats"]);
  }

  return ud;
}

export function persistCampaignStorageFromUserData(paths: Paths, userData: UserData) {
  const index: CampaignIndex = { version: 1, campaigns: {} };

  const campaignIds = Object.keys(userData.campaigns ?? {});
  for (const campaignId of campaignIds) {
    const campaign = userData.campaigns[campaignId];
    if (!campaign) continue;
    index.campaigns[campaignId] = campaign;

    const adventures: Record<string, StoredAdventure> = {};
    const encounters: Record<string, StoredEncounter> = {};
    const notes: Record<string, StoredNote> = {};
    const treasure: Record<string, StoredTreasure> = {};
    const players: Record<string, StoredPlayer> = {};
    const inpcs: Record<string, StoredINpc> = {};
    const conditions: Record<string, StoredCondition> = {};
    const combats: Record<string, StoredCombat> = {};

    for (const [id, a] of Object.entries(userData.adventures)) if (a.campaignId === campaignId) adventures[id] = a;
    for (const [id, e] of Object.entries(userData.encounters)) if (e.campaignId === campaignId) encounters[id] = e;
    for (const [id, n] of Object.entries(userData.notes)) if (n.campaignId === campaignId) notes[id] = n;
    for (const [id, t] of Object.entries(userData.treasure)) if (t.campaignId === campaignId) treasure[id] = t;
    for (const [id, p] of Object.entries(userData.players)) if (p.campaignId === campaignId) players[id] = p;
    for (const [id, i] of Object.entries(userData.inpcs)) if (i.campaignId === campaignId) inpcs[id] = i;
    for (const [id, c] of Object.entries(userData.conditions)) if (c.campaignId === campaignId) conditions[id] = c;

    for (const [encId, combat] of Object.entries(userData.combats)) {
      const enc = userData.encounters[encId];
      if (enc?.campaignId === campaignId) combats[encId] = combat;
    }

    const doc = { version: 1, campaign, adventures, encounters, notes, treasure, players, inpcs, conditions, combats };
    saveJsonAtomic(campaignFilePath(paths, campaignId), doc);
  }

  // IMPORTANT: do not auto-delete campaign files that are not present in memory.
  // Campaign deletion should be explicit.
  saveJsonAtomic(paths.campaignsIndexPath, index);
}

/**
 * Merges a plain-object value from disk into a typed target record.
 * Non-object values (null, arrays, primitives) are silently ignored.
 */
function mergeIfObject<T>(target: Record<string, T>, incoming: unknown): void {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return;
  for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
    target[k] = v as T;
  }
}
