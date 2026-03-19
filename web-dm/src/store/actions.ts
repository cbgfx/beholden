import type { Adventure, Campaign, Combatant, Encounter, INpc, Meta, Note, Player, TreasureEntry } from "@/domain/types/domain";
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
  | { type: "selectAdventure"; adventureId: string | null }
  | { type: "setEncounters"; encounters: Encounter[] }
  | { type: "selectEncounter"; encounterId: string | null }
  | { type: "setPlayers"; players: Player[] }
  | { type: "setINpcs"; inpcs: INpc[] }
  | { type: "setCombatants"; combatants: Combatant[] }
  | { type: "mergeMonsterDetails"; patch: Record<string, MonsterDetail> }
  | { type: "setCampaignNotes"; notes: Note[] }
  | { type: "setAdventureNotes"; notes: Note[] }
  | { type: "setCampaignTreasure"; treasure: TreasureEntry[] }
  | { type: "setAdventureTreasure"; treasure: TreasureEntry[] }
  | { type: "toggleNote"; noteId: string }
  | { type: "openDrawer"; drawer: DrawerState }
  | { type: "closeDrawer" };
