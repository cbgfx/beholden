// Central, typed contract for server->client realtime events.
//
// IMPORTANT: This must stay aligned with what the web client expects.
// Do NOT invent new event names casually.

import type { EncounterActorDto, NoteDto, TreasureDto } from "@beholden/shared/api";

type Id = string;

type HelloPayload = { ok: true; time: number };

type CampaignsChangedPayload = { campaignId: Id };
type AdventuresDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  adventureId?: Id;
};

type EncountersDeltaPayload = {
  campaignId: Id;
  adventureId: Id;
  action: "upsert" | "delete" | "refresh";
  encounterId?: Id;
};

type NotesDeltaPayload = {
  campaignId: Id;
  adventureId?: Id | null;
  action: "upsert" | "delete" | "refresh";
  noteId?: Id;
  note?: NoteDto;
};

type PlayersDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  playerId?: Id;
  characterId?: Id | null;
};

type InpcsDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  inpcId?: Id;
};

type TreasureDeltaPayload = {
  campaignId: Id;
  adventureId?: Id | null;
  encounterId?: Id | null;
  action: "upsert" | "delete" | "refresh";
  treasureId?: Id;
  treasure?: TreasureDto;
};

type PartyInventoryDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  itemId?: Id;
};
type PartyCurrencyDeltaPayload = {
  campaignId: Id;
};
type BastionsDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  bastionId?: Id;
};

type CompendiumChangedPayload =
  | { cleared: true }
  | { liveReferencesMigrated: true; changedRows: number; changedReferences: number }
  | { imported: number; total: number }
  | {
      nativeImported: true;
      category: string;
      imported: number;
      total: number;
    }
  | {
      blobTrimmed: true;
      updatedMonsters: number;
      updatedSpells: number;
      updatedItems: number;
      updatedClasses: number;
      updatedRaces: number;
      updatedBackgrounds: number;
      updatedFeats: number;
    }
  | { monsterCreated: string }
  | { monsterUpdated: string }
  | { monsterDeleted: string }
  | { itemCreated: string }
  | { itemUpdated: string }
  | { itemDeleted: string }
  | { spellCreated: string }
  | { spellUpdated: string }
  | { spellDeleted: string };

type EncounterCombatantsDeltaPayload = {
  encounterId: Id;
  action: "upsert" | "delete" | "refresh";
  combatantId?: Id;
  combatant?: EncounterActorDto;
};

type EncounterCombatStateChangedPayload = { encounterId: Id };

type SavePendingPayload = Record<string, never>;
type SaveCompletePayload = Record<string, never>;

type InitiativePromptPayload = {
  campaignId: Id;
  encounterId: Id;
  prompts: Array<{ characterId: Id; combatantId: Id }>;
};

type InitiativeFulfilledPayload = {
  campaignId: Id;
  encounterId: Id;
  combatantId: Id;
  characterId: Id;
};

type ConcentrationCheckPayload = {
  campaignId: Id;
  encounterId: Id;
  characterId: Id;
  characterName: string;
  dc: number;
};

type XpAwardedPayload = {
  campaignId: Id;
  characterId: Id;
  xpAdded: number;
};

export interface ServerEventMap {
  hello: HelloPayload;

  "campaigns:changed": CampaignsChangedPayload;
  "adventures:delta": AdventuresDeltaPayload;
  "encounters:delta": EncountersDeltaPayload;
  "notes:delta": NotesDeltaPayload;
  "players:delta": PlayersDeltaPayload;
  "inpcs:delta": InpcsDeltaPayload;
  "treasure:delta": TreasureDeltaPayload;
  "partyInventory:delta": PartyInventoryDeltaPayload;
  "partyCurrency:delta": PartyCurrencyDeltaPayload;
  "bastions:delta": BastionsDeltaPayload;
  "compendium:changed": CompendiumChangedPayload;

  "encounter:combatantsDelta": EncounterCombatantsDeltaPayload;
  "encounter:combatStateChanged": EncounterCombatStateChangedPayload;

  "initiative:prompt": InitiativePromptPayload;
  "initiative:fulfilled": InitiativeFulfilledPayload;
  "concentration:check": ConcentrationCheckPayload;
  "xp:awarded": XpAwardedPayload;

  "save:pending": SavePendingPayload;
  "save:complete": SaveCompletePayload;
}

export type ServerEventType = keyof ServerEventMap;

export type BroadcastFn = <K extends ServerEventType>(
  type: K,
  payload: ServerEventMap[K]
) => void;
