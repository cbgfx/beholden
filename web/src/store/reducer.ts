import type { Action } from "./actions";
import { initialState, type State } from "./state";

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setMeta":
      return { ...state, meta: action.meta };
    case "setCampaigns":
      return { ...state, campaigns: action.campaigns };
    case "selectCampaign":
      return {
        ...state,
        selectedCampaignId: action.campaignId,
        selectedAdventureId: null,
        selectedEncounterId: null
      };
    case "setAdventures":
      return { ...state, adventures: action.adventures };
    case "selectAdventure":
      return { ...state, selectedAdventureId: action.adventureId, selectedEncounterId: null };
    case "setEncounters":
      return { ...state, encounters: action.encounters };
    case "selectEncounter":
      return { ...state, selectedEncounterId: action.encounterId };
    case "setPlayers":
      return { ...state, players: action.players };
    case "setINpcs":
      return { ...state, inpcs: action.inpcs };
    case "setCombatants":
      return { ...state, combatants: action.combatants };
    case "mergeMonsterDetails":
      return { ...state, monsterDetails: { ...state.monsterDetails, ...action.patch } };
    case "setCampaignNotes":
      return { ...state, campaignNotes: action.notes };
    case "setAdventureNotes":
      return { ...state, adventureNotes: action.notes };
    case "setCampaignTreasure":
      return { ...state, campaignTreasure: action.treasure };
    case "setAdventureTreasure":
      return { ...state, adventureTreasure: action.treasure };
    case "toggleNote": {
      const exists = state.expandedNoteIds.includes(action.noteId);
      return {
        ...state,
        expandedNoteIds: exists
          ? state.expandedNoteIds.filter((id) => id !== action.noteId)
          : [...state.expandedNoteIds, action.noteId]
      };
    }
    case "openDrawer":
      return { ...state, drawer: action.drawer };
    case "closeDrawer":
      return { ...state, drawer: null };
    default:
      return state;
  }
}

export { initialState };
