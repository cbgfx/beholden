import {
  flattenPartyInventoryItemDto,
  type FlatPartyInventoryItemDto,
  type PartyInventoryItemDto,
  type PartyInventoryListDto,
} from "@beholden/shared/api";
import { api, jsonInit } from "@/services/api";

export type PartyInventoryResult = {
  items: FlatPartyInventoryItemDto[];
  partyCapacityLbs: number | null;
};

export function fetchPartyInventory(campaignId: string): Promise<PartyInventoryResult> {
  return api<PartyInventoryListDto>(`/api/campaigns/${campaignId}/party-inventory`).then(
    ({ items, partyCapacityLbs }) => ({
      items: items.map(flattenPartyInventoryItemDto),
      partyCapacityLbs,
    }),
  );
}

export function fetchPartyInventoryItem(
  campaignId: string,
  itemId: string,
): Promise<FlatPartyInventoryItemDto> {
  return api<PartyInventoryItemDto>(
    `/api/campaigns/${campaignId}/party-inventory/${itemId}`,
  ).then(flattenPartyInventoryItemDto);
}

export function createPartyInventoryItem(
  campaignId: string,
  body: Record<string, unknown>,
): Promise<FlatPartyInventoryItemDto> {
  return api<PartyInventoryItemDto>(
    `/api/campaigns/${campaignId}/party-inventory`,
    jsonInit("POST", body),
  ).then(flattenPartyInventoryItemDto);
}

export function updatePartyInventoryQuantity(
  campaignId: string,
  itemId: string,
  quantity: number,
): Promise<FlatPartyInventoryItemDto> {
  return api<PartyInventoryItemDto>(
    `/api/campaigns/${campaignId}/party-inventory/${itemId}/quantity`,
    jsonInit("PATCH", { quantity }),
  ).then(flattenPartyInventoryItemDto);
}

/** Party-stash side of an atomic character <-> stash transfer. */
export type PartyStashTransferOp =
  | { action: "create"; item: Record<string, unknown> }
  | { action: "setQuantity"; itemId: string; quantity: number; expectedQuantity: number; expectedStashRev?: string }
  | { action: "delete"; itemId: string; expectedQuantity: number; expectedStashRev?: string };

export interface PartyInventoryTransferBody {
  characterId: string;
  expectedInventoryRev: string;
  /** The character's full next inventory, with the transferred item already added/removed. */
  inventory: unknown[];
  inventoryContainers: unknown[];
  stash: PartyStashTransferOp;
}

export interface PartyInventoryTransferResult {
  ok: true;
  inventoryRev: string;
  itemId: string;
  /** The upserted stash row, or null when the transfer emptied the slot (withdrawal). */
  stashItem: PartyInventoryItemDto | null;
}

/**
 * Move one item between a character sheet and the party stash in a single
 * server transaction. Replaces the old two-request pattern (character save +
 * separate stash create/delete) that could duplicate or destroy the item if
 * the second request failed.
 */
export function transferPartyInventoryItem(
  campaignId: string,
  body: PartyInventoryTransferBody,
): Promise<PartyInventoryTransferResult> {
  return api<PartyInventoryTransferResult>(
    `/api/campaigns/${campaignId}/party-inventory/transfer`,
    jsonInit("POST", body),
  );
}

export type PartyCurrencyMap = { PP: number; GP: number; SP: number; CP: number };

export function fetchPartyCurrency(campaignId: string): Promise<PartyCurrencyMap> {
  return api<PartyCurrencyMap>(`/api/campaigns/${campaignId}/party-currency`);
}

export function patchPartyCurrency(
  campaignId: string,
  patch: Partial<PartyCurrencyMap>,
): Promise<PartyCurrencyMap> {
  return api<PartyCurrencyMap>(`/api/campaigns/${campaignId}/party-currency`, jsonInit("PATCH", patch));
}
