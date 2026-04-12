// Central, typed contract for server->client realtime events.
//
// IMPORTANT: This must stay aligned with what the web client expects.
// Do NOT invent new event names casually.

export type Id = string;

export type HelloPayload = { ok: true; time: number };

export type CampaignsChangedPayload = { campaignId: Id };
export type AdventuresDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  adventureId?: Id;
};

export type EncountersDeltaPayload = {
  campaignId: Id;
  adventureId: Id;
  action: "upsert" | "delete" | "refresh";
  encounterId?: Id;
};

export type NotesDeltaPayload = {
  campaignId: Id;
  adventureId?: Id | null;
  action: "upsert" | "delete" | "refresh";
  noteId?: Id;
};

export type PlayersDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  playerId?: Id;
  characterId?: Id | null;
};

export type InpcsDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  inpcId?: Id;
};

export type TreasureDeltaPayload = {
  campaignId: Id;
  adventureId?: Id | null;
  action: "upsert" | "delete" | "refresh";
  treasureId?: Id;
};

export type PartyInventoryDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  itemId?: Id;
};
export type BastionsDeltaPayload = {
  campaignId: Id;
  action: "upsert" | "delete" | "refresh";
  bastionId?: Id;
};

export type CompendiumChangedPayload =
  | { cleared: true }
  | { imported: number; total: number }
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

export type EncounterCombatantsDeltaPayload = {
  encounterId: Id;
  action: "upsert" | "delete" | "refresh";
  combatantId?: Id;
};

export type EncounterCombatStateChangedPayload = { encounterId: Id };

export type SavePendingPayload = Record<string, never>;
export type SaveCompletePayload = Record<string, never>;

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
  "bastions:delta": BastionsDeltaPayload;
  "compendium:changed": CompendiumChangedPayload;

  "encounter:combatantsDelta": EncounterCombatantsDeltaPayload;
  "encounter:combatStateChanged": EncounterCombatStateChangedPayload;

  "save:pending": SavePendingPayload;
  "save:complete": SaveCompletePayload;
}

export type ServerEventType = keyof ServerEventMap;

export type BroadcastFn = <K extends ServerEventType>(
  type: K,
  payload: ServerEventMap[K]
) => void;
