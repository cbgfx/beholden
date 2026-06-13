import {
  flattenPartyInventoryItemDto,
  type FlatPartyInventoryItemDto,
  type PartyInventoryItemDto,
} from "@beholden/shared/api";
import { api, jsonInit } from "@/services/api";

export function fetchPartyInventory(
  campaignId: string,
): Promise<FlatPartyInventoryItemDto[]> {
  return api<PartyInventoryItemDto[]>(
    `/api/campaigns/${campaignId}/party-inventory`,
  ).then((rows) => rows.map(flattenPartyInventoryItemDto));
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
