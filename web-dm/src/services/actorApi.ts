import type {
  CampaignCharacterDto,
  EncounterActorDto,
  FlatCampaignCharacterDto,
  FlatEncounterActorDto,
} from "@beholden/shared/api";
import { flattenCampaignCharacterDto, flattenEncounterActorDto } from "@beholden/shared/api";
import { api } from "@/services/api";
import { encounterCombatantsPath } from "@/services/encounterApi";

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

export async function fetchCampaignCharacter(
  campaignId: string,
  playerId: string,
  options?: { includeSharedNotes?: boolean },
): Promise<FlatCampaignCharacterDto> {
  const includeSharedNotes = options?.includeSharedNotes;
  const query =
    includeSharedNotes === undefined
      ? ""
      : `?includeSharedNotes=${includeSharedNotes ? "1" : "0"}`;
  const dto = await api<CampaignCharacterDto>(`/api/campaigns/${campaignId}/players/${playerId}${query}`);
  return flattenCampaignCharacterDto(dto);
}

export async function fetchEncounterActors(encounterId: string): Promise<FlatEncounterActorDto[]> {
  return (await api<EncounterActorDto[]>(encounterCombatantsPath(encounterId))).map(flattenEncounterActorDto);
}

export async function fetchEncounterActor(encounterId: string, combatantId: string): Promise<FlatEncounterActorDto> {
  const dto = await api<EncounterActorDto>(encounterCombatantsPath(encounterId, combatantId));
  return flattenEncounterActorDto(dto);
}
