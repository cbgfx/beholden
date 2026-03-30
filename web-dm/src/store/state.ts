import type { Adventure, Campaign, Combatant, Encounter, INpc, Meta, Note, Player, TreasureEntry } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

export type DrawerState =
  | { type: "createCampaign" }
  | { type: "editCampaign"; campaignId: string }
  | { type: "createAdventure"; campaignId: string }
  | { type: "editAdventure"; adventureId: string }
  | { type: "createEncounter"; adventureId: string }
  | { type: "editEncounter"; encounterId: string }
  | { type: "note"; scope: "campaign" | "adventure"; campaignId: string; adventureId?: string | null }
  | { type: "editNote"; noteId: string }
  | { type: "createPlayer"; campaignId: string }
  | { type: "editPlayer"; playerId: string }
  | { type: "editINpc"; inpcId: string }
  | { type: "editCombatant"; encounterId: string; combatantId: string }
  | { type: "combatantOverrides"; encounterId: string; combatantId: string }
  | { type: "combatantConditions"; encounterId: string; combatantId: string; role: "active" | "target"; activeIdForCaster?: string | null; currentRound?: number }
  | { type: "viewTreasure"; treasureId: string; title: string }
  | { type: "viewSpell"; spellId: string; title: string }
  | { type: "spellbook" }
  | { type: "adventureNotes" }
  | { type: "polymorphTransform"; encounterId: string; combatantId: string; combatantName: string }
  | null;

export type State = {
  meta: Meta | null;
  campaigns: Campaign[];
  selectedCampaignId: string;
  adventures: Adventure[];
  selectedAdventureId: string | null;
  encounters: Encounter[];
  selectedEncounterId: string | null;
  players: Player[];
  inpcs: INpc[];
  combatants: Combatant[];
  // Cached compendium monster details keyed by monster id.
  monsterDetails: Record<string, MonsterDetail>;
  campaignNotes: Note[];
  adventureNotes: Note[];
  campaignTreasure: TreasureEntry[];
  adventureTreasure: TreasureEntry[];
  expandedNoteIds: string[];
  drawer: DrawerState;
};

export const initialState: State = {
  meta: null,
  campaigns: [],
  selectedCampaignId: "",
  adventures: [],
  selectedAdventureId: null,
  encounters: [],
  selectedEncounterId: null,
  players: [],
  inpcs: [],
  combatants: [],
  monsterDetails: {},
  campaignNotes: [],
  adventureNotes: [],
  campaignTreasure: [],
  adventureTreasure: [],
  expandedNoteIds: [],
  drawer: null
};
