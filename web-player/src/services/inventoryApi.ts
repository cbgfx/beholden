import {
  flattenPartyInventoryItemDto,
  type FlatPartyInventoryItemDto,
  type PartyInventoryItemDto,
  type PartyInventoryListDto,
} from "@beholden/shared/api";
import { api, jsonInit } from "@/services/api";

export type PartyInventoryResult = {
  items: FlatPartyInventoryItemDto[];
  otherMembersCapacityLbs: number | null;
};

export function fetchPartyInventory(campaignId: string): Promise<PartyInventoryResult> {
  return api<PartyInventoryListDto>(`/api/campaigns/${campaignId}/party-inventory`).then(
    ({ items, otherMembersCapacityLbs }) => ({
      items: items.map(flattenPartyInventoryItemDto),
      otherMembersCapacityLbs,
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
