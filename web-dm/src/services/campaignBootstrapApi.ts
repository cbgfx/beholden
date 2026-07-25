import { flattenCampaignCharacterDto, type CampaignCharacterDto } from "@beholden/shared/api";
import type { Adventure, CampaignCharacter, INpc, Note, TreasureEntry } from "@/domain/types/domain";
import { api } from "@/services/api";
import {
  noteListRowToFlat,
  treasureListRowToFlat,
  type NoteListRow,
  type TreasureListRow,
} from "@/services/collectionApi";

type CampaignBootstrapResponse = {
  adventures: Adventure[];
  players: CampaignCharacterDto[];
  inpcs: INpc[];
  notes: NoteListRow[];
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
    notes: response.notes.map(noteListRowToFlat) as Note[],
    treasure: response.treasure.map(treasureListRowToFlat) as TreasureEntry[],
  };
}
