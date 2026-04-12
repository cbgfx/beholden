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

    case "upsertAdventure": {
      const idx = state.adventures.findIndex((a) => a.id === action.adventure.id);
      if (idx === -1) return { ...state, adventures: [...state.adventures, action.adventure] };
      const next = state.adventures.slice();
      next[idx] = action.adventure;
      return { ...state, adventures: next };
    }

    case "removeAdventure": {
      const adventures = state.adventures.filter((a) => a.id !== action.adventureId);
      const selectedAdventureId =
        state.selectedAdventureId === action.adventureId ? null : state.selectedAdventureId;
      const selectedEncounterId = selectedAdventureId ? state.selectedEncounterId : null;
      return { ...state, adventures, selectedAdventureId, selectedEncounterId };
    }

    case "upsertEncounter": {
      const idx = state.encounters.findIndex((e) => e.id === action.encounter.id);
      if (idx === -1) return { ...state, encounters: [...state.encounters, action.encounter] };
      const next = state.encounters.slice();
      next[idx] = action.encounter;
      return { ...state, encounters: next };
    }

    case "removeEncounter": {
      const nextEncounters = state.encounters.filter((e) => e.id !== action.encounterId);
      const selectedEncounterId =
        state.selectedEncounterId === action.encounterId ? null : state.selectedEncounterId;
      return { ...state, encounters: nextEncounters, selectedEncounterId };
    }

    case "selectEncounter":
      return { ...state, selectedEncounterId: action.encounterId };

    case "setPlayers":
      return { ...state, players: action.players };

    case "upsertPlayer": {
      const idx = state.players.findIndex((p) => p.id === action.player.id);
      if (idx === -1) return { ...state, players: [...state.players, action.player] };
      const next = state.players.slice();
      next[idx] = action.player;
      return { ...state, players: next };
    }

    case "removePlayer":
      return { ...state, players: state.players.filter((p) => p.id !== action.playerId) };

    case "setINpcs":
      return { ...state, inpcs: action.inpcs };

    case "upsertINpc": {
      const idx = state.inpcs.findIndex((i) => i.id === action.inpc.id);
      if (idx === -1) return { ...state, inpcs: [...state.inpcs, action.inpc] };
      const next = state.inpcs.slice();
      next[idx] = action.inpc;
      return { ...state, inpcs: next };
    }

    case "removeINpc":
      return { ...state, inpcs: state.inpcs.filter((i) => i.id !== action.inpcId) };

    case "setCombatants":
      return { ...state, combatants: action.combatants };

    case "upsertCombatant": {
      const idx = state.combatants.findIndex((c) => c.id === action.combatant.id);
      if (idx === -1) return { ...state, combatants: [...state.combatants, action.combatant] };
      const next = state.combatants.slice();
      next[idx] = action.combatant;
      return { ...state, combatants: next };
    }

    case "removeCombatant":
      return { ...state, combatants: state.combatants.filter((c) => c.id !== action.combatantId) };

    case "mergeMonsterDetails":
      return { ...state, monsterDetails: { ...state.monsterDetails, ...action.patch } };

    case "setCampaignNotes":
      return { ...state, campaignNotes: action.notes };

    case "setAdventureNotes":
      return { ...state, adventureNotes: action.notes };

    case "upsertCampaignNote": {
      const idx = state.campaignNotes.findIndex((n) => n.id === action.note.id);
      if (idx === -1) return { ...state, campaignNotes: [...state.campaignNotes, action.note] };
      const next = state.campaignNotes.slice();
      next[idx] = action.note;
      return { ...state, campaignNotes: next };
    }

    case "removeCampaignNote":
      return { ...state, campaignNotes: state.campaignNotes.filter((n) => n.id !== action.noteId) };

    case "upsertAdventureNote": {
      const idx = state.adventureNotes.findIndex((n) => n.id === action.note.id);
      if (idx === -1) return { ...state, adventureNotes: [...state.adventureNotes, action.note] };
      const next = state.adventureNotes.slice();
      next[idx] = action.note;
      return { ...state, adventureNotes: next };
    }

    case "removeAdventureNote":
      return { ...state, adventureNotes: state.adventureNotes.filter((n) => n.id !== action.noteId) };

    case "setCampaignTreasure":
      return { ...state, campaignTreasure: action.treasure };

    case "setAdventureTreasure":
      return { ...state, adventureTreasure: action.treasure };

    case "upsertCampaignTreasure": {
      const idx = state.campaignTreasure.findIndex((t) => t.id === action.entry.id);
      if (idx === -1) return { ...state, campaignTreasure: [...state.campaignTreasure, action.entry] };
      const next = state.campaignTreasure.slice();
      next[idx] = action.entry;
      return { ...state, campaignTreasure: next };
    }

    case "removeCampaignTreasure":
      return { ...state, campaignTreasure: state.campaignTreasure.filter((t) => t.id !== action.treasureId) };

    case "upsertAdventureTreasure": {
      const idx = state.adventureTreasure.findIndex((t) => t.id === action.entry.id);
      if (idx === -1) return { ...state, adventureTreasure: [...state.adventureTreasure, action.entry] };
      const next = state.adventureTreasure.slice();
      next[idx] = action.entry;
      return { ...state, adventureTreasure: next };
    }

    case "removeAdventureTreasure":
      return { ...state, adventureTreasure: state.adventureTreasure.filter((t) => t.id !== action.treasureId) };

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
