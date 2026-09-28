import { flattenCampaignCharacterDto, flattenNoteDto, type CampaignCharacterDto, type NoteDto } from "@beholden/shared/api";
import type { Adventure, CampaignCharacter, INpc, Note, TreasureEntry } from "@/domain/types/domain";
import { api } from "@/services/api";
import {
  treasureListRowToFlat,
  type TreasureListRow,
} from "@/services/collectionApi";

type CampaignBootstrapResponse = {
  adventures: Adventure[];
  players: CampaignCharacterDto[];
  inpcs: INpc[];
  notes: NoteDto[];
  treasure: TreasureListRow[];
};

export async function fetchCampaignBootstrap(campaignId: string, signal?: AbortSignal): Promise<{
  adventures: Adventure[];
  players: CampaignCharacter[];
  inpcs: INpc[];
  notes: Note[];
  treasure: TreasureEntry[];
}> {
  const response = await api<CampaignBootstrapResponse>(`/api/campaigns/${campaignId}/bootstrap`, { signal });
  return {
    adventures: response.adventures,
    players: response.players.map(flattenCampaignCharacterDto) as CampaignCharacter[],
    inpcs: response.inpcs,
    notes: response.notes.map(flattenNoteDto) as Note[],
    treasure: response.treasure.map(treasureListRowToFlat) as TreasureEntry[],
  };
}
