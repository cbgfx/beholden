import type { Adventure, Campaign, CampaignCharacter, Encounter, EncounterActor, INpc, Meta, Note, TreasureEntry } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { DrawerState } from "@/store/state";

export type Action =
  | { type: "setMeta"; meta: Meta }
  | { type: "setCampaigns"; campaigns: Campaign[] }
  | { type: "selectCampaign"; campaignId: string }
  // Selects the first campaign only if none is currently selected.
  // Keeps refreshAll dep-free of state.selectedCampaignId.
  | { type: "autoSelectFirstCampaign"; campaigns: Campaign[] }
  | { type: "setAdventures"; adventures: Adventure[] }
  | { type: "upsertAdventure"; adventure: Adventure }
  | { type: "removeAdventure"; adventureId: string }
  | { type: "selectAdventure"; adventureId: string | null }
  | { type: "setEncounters"; encounters: Encounter[] }
  | { type: "upsertEncounter"; encounter: Encounter }
  | { type: "removeEncounter"; encounterId: string }
  | { type: "selectEncounter"; encounterId: string | null }
  | { type: "setPlayers"; players: CampaignCharacter[] }
  | { type: "upsertPlayer"; player: CampaignCharacter }
  | { type: "removePlayer"; playerId: string }
  | { type: "setINpcs"; inpcs: INpc[] }
  | { type: "upsertINpc"; inpc: INpc }
  | { type: "removeINpc"; inpcId: string }
  | { type: "setCombatants"; combatants: EncounterActor[] }
  | { type: "upsertCombatant"; combatant: EncounterActor }
  | { type: "removeCombatant"; combatantId: string }
  | { type: "mergeMonsterDetails"; patch: Record<string, MonsterDetail> }
  | { type: "setCampaignNotes"; notes: Note[] }
  | { type: "setAdventureNotes"; notes: Note[] }
  | { type: "upsertCampaignNote"; note: Note }
  | { type: "removeCampaignNote"; noteId: string }
  | { type: "upsertAdventureNote"; note: Note }
  | { type: "removeAdventureNote"; noteId: string }
  | { type: "setCampaignTreasure"; treasure: TreasureEntry[] }
  | { type: "setAdventureTreasure"; treasure: TreasureEntry[] }
  | { type: "upsertCampaignTreasure"; entry: TreasureEntry }
  | { type: "removeCampaignTreasure"; treasureId: string }
  | { type: "upsertAdventureTreasure"; entry: TreasureEntry }
  | { type: "removeAdventureTreasure"; treasureId: string }
  | { type: "toggleNote"; noteId: string }
  | { type: "openDrawer"; drawer: DrawerState }
  | { type: "closeDrawer" };
