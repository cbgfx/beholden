// Central, typed contract for server->client realtime events.
//
// IMPORTANT: This must stay aligned with what the web client expects.
// Do NOT invent new event names casually.

export type Id = string;

export type HelloPayload = { ok: true; time: number };

export type CampaignsChangedPayload = { campaignId: Id };

export type AdventuresChangedPayload =
  | { campaignId: Id }
  | { adventureId: Id };

export type EncountersChangedPayload =
  | { campaignId: Id; adventureId: Id }
  | { campaignId: Id }
  | { encounterId: Id };

export type NotesChangedPayload =
  | { campaignId: Id; adventureId: Id | null }
  | { campaignId: Id }
  | { noteId: Id };

export type PlayersChangedPayload = { campaignId: Id };

export type InpcsChangedPayload = { campaignId: Id };

export type TreasureChangedPayload = { campaignId: Id };

export type PartyInventoryChangedPayload = { campaignId: Id };

export type CompendiumChangedPayload =
  | { cleared: true }
  | { imported: number; total: number }
  | { monsterCreated: string }
  | { monsterUpdated: string }
  | { monsterDeleted: string }
  | { itemCreated: string }
  | { itemUpdated: string }
  | { itemDeleted: string }
  | { spellCreated: string }
  | { spellUpdated: string }
  | { spellDeleted: string };

export type EncounterCombatantsChangedPayload = { encounterId: Id };

export type EncounterCombatStateChangedPayload = { encounterId: Id };

export type SavePendingPayload = Record<string, never>;
export type SaveCompletePayload = Record<string, never>;

export interface ServerEventMap {
  hello: HelloPayload;

  "campaigns:changed": CampaignsChangedPayload;
  "adventures:changed": AdventuresChangedPayload;
  "encounters:changed": EncountersChangedPayload;
  "notes:changed": NotesChangedPayload;
  "players:changed": PlayersChangedPayload;
  "inpcs:changed": InpcsChangedPayload;
  "treasure:changed": TreasureChangedPayload;
  "partyInventory:changed": PartyInventoryChangedPayload;
  "compendium:changed": CompendiumChangedPayload;

  "encounter:combatantsChanged": EncounterCombatantsChangedPayload;
  "encounter:combatStateChanged": EncounterCombatStateChangedPayload;

  "save:pending": SavePendingPayload;
  "save:complete": SaveCompletePayload;
}

export type ServerEventType = keyof ServerEventMap;

export type BroadcastFn = <K extends ServerEventType>(
  type: K,
  payload: ServerEventMap[K]
) => void;
