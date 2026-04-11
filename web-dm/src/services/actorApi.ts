import type {
  CampaignCharacterDto,
  EncounterActorDto,
  FlatCampaignCharacterDto,
  FlatEncounterActorDto,
} from "@beholden/shared/api";
import { flattenCampaignCharacterDto, flattenEncounterActorDto } from "@beholden/shared/api";
import { api } from "@/services/api";

export async function fetchCampaignCharacters(
  campaignId: string,
  options?: { includeSharedNotes?: boolean },
): Promise<FlatCampaignCharacterDto[]> {
  const includeSharedNotes = options?.includeSharedNotes;
  const query =
    includeSharedNotes === undefined
      ? ""
      : `?includeSharedNotes=${includeSharedNotes ? "1" : "0"}`;
  return (await api<CampaignCharacterDto[]>(`/api/campaigns/${campaignId}/players${query}`)).map(flattenCampaignCharacterDto);
}

export async function fetchEncounterActors(encounterId: string): Promise<FlatEncounterActorDto[]> {
  return (await api<EncounterActorDto[]>(`/api/encounters/${encounterId}/combatants`)).map(flattenEncounterActorDto);
}
