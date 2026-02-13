import type { Adventure, Campaign, Combatant, Encounter, INpc, Meta, Note, Player, TreasureEntry } from "@/app/types/domain";
import type { MonsterDetail } from "@/app/types/compendium";
import type { DrawerState } from "./state";

export type Action =
  | { type: "setMeta"; meta: Meta }
  | { type: "setCampaigns"; campaigns: Campaign[] }
  | { type: "selectCampaign"; campaignId: string }
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
