import type { Action } from "@/store/actions";
import { initialState, type State } from "@/store/state";

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
        selectedEncounterId: null,
      };

    // Auto-select first campaign only when nothing is selected yet.
    // Keeps refreshAll stable without closing over state.selectedCampaignId.
    case "autoSelectFirstCampaign": {
      if (state.selectedCampaignId) return state;
      const first = action.campaigns[0];
      if (!first) return state;
      return {
        ...state,
        selectedCampaignId: first.id,
        selectedAdventureId: null,
        selectedEncounterId: null,
      };
    }

    // Deselect adventure if it no longer exists in the refreshed list.
    // Removes the need for refreshCampaign to close over selectedAdventureId.
    case "setAdventures": {
      const stillExists =
        state.selectedAdventureId != null &&
        action.adventures.some((a) => a.id === state.selectedAdventureId);
      return {
        ...state,
        adventures: action.adventures,
        selectedAdventureId: stillExists ? state.selectedAdventureId : null,
        selectedEncounterId: stillExists ? state.selectedEncounterId : null,
      };
    }

    case "selectAdventure":
      return { ...state, selectedAdventureId: action.adventureId, selectedEncounterId: null };

    case "setEncounters": {
      const encounterStillExists =
        state.selectedEncounterId != null &&
        action.encounters.some((e) => e.id === state.selectedEncounterId);
      return {
        ...state,
        encounters: action.encounters,
        selectedEncounterId: encounterStillExists ? state.selectedEncounterId : null,
      };
    }

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
          : [...state.expandedNoteIds, action.noteId],
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
