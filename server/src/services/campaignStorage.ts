import path from "node:path";
import fs from "node:fs";
import { loadJson, saveJsonAtomic } from "../lib/jsonFile.js";
import type { Paths, UserData } from "../server/context.js";

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
  } as UserData;
}

export function ensureCampaignIndexExists(paths: Paths) {
  if (fs.existsSync(paths.campaignsIndexPath)) return;
  saveJsonAtomic(paths.campaignsIndexPath, { version: 1, campaigns: {} });
}

export function campaignFilePath(paths: Paths, campaignId: string) {
  return path.join(paths.campaignsDir, `${campaignId}.json`);
}

export function loadAllCampaignFiles(paths: Paths): UserData {
  const idx = loadJson(paths.campaignsIndexPath, { version: 1, campaigns: {} });
  const ud = buildEmptyUserData();

  const campaignIds = Object.keys(idx.campaigns ?? {});
  for (const campaignId of campaignIds) {
    const fp = campaignFilePath(paths, campaignId);
    const doc = loadJson(fp, null);
    if (!doc) continue;

    ud.campaigns[campaignId] = doc.campaign ?? idx.campaigns[campaignId];
    Object.assign(ud.adventures, doc.adventures ?? {});
    Object.assign(ud.encounters, doc.encounters ?? {});
    Object.assign(ud.notes, doc.notes ?? {});
    Object.assign(ud.treasure, doc.treasure ?? {});
    Object.assign(ud.players, doc.players ?? {});
    Object.assign(ud.inpcs, doc.inpcs ?? {});
    Object.assign(ud.conditions, doc.conditions ?? {});
    Object.assign(ud.combats, doc.combats ?? {});
  }

  return ud;
}

export function persistCampaignStorageFromUserData(paths: Paths, userData: UserData) {
  const index = { version: 1, campaigns: {} };

  const campaignIds = Object.keys(userData.campaigns ?? {});
  for (const campaignId of campaignIds) {
    const campaign = userData.campaigns[campaignId];
    index.campaigns[campaignId] = campaign;

    const adventures = {};
    const encounters = {};
    const notes = {};
    const treasure = {};
    const players = {};
    const inpcs = {};
    const conditions = {};
    const combats = {};

    for (const [id, a] of Object.entries(userData.adventures)) if (a?.campaignId === campaignId) adventures[id] = a;
    for (const [id, e] of Object.entries(userData.encounters)) if (e?.campaignId === campaignId) encounters[id] = e;
    for (const [id, n] of Object.entries(userData.notes)) if (n?.campaignId === campaignId) notes[id] = n;
    for (const [id, t] of Object.entries(userData.treasure)) if (t?.campaignId === campaignId) treasure[id] = t;
    for (const [id, p] of Object.entries(userData.players)) if (p?.campaignId === campaignId) players[id] = p;
    for (const [id, i] of Object.entries(userData.inpcs)) if (i?.campaignId === campaignId) inpcs[id] = i;
    for (const [id, c] of Object.entries(userData.conditions)) if (c?.campaignId === campaignId) conditions[id] = c;

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
