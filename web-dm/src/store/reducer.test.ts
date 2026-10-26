import { describe, expect, it } from "vitest";
import { reducer } from "./reducer";
import { initialState, type State } from "./state";

// A campaign's data must not outlive a switch to another one: until the new campaign loads, the
// old players would sit under its name, and removing one there would remove it from the old one.
describe("switching campaigns", () => {
  const campaignA: State = {
    ...initialState,
    selectedCampaignId: "camp-a",
    selectedAdventureId: "adv-a",
    players: [{ id: "p-a" } as State["players"][number]],
    adventures: [{ id: "adv-a" } as State["adventures"][number]],
    inpcs: [{ id: "npc-a" } as State["inpcs"][number]],
    campaignNotes: [{ id: "note-a" } as State["campaignNotes"][number]],
    campaignTreasure: [{ id: "t-a" } as State["campaignTreasure"][number]],
  };

  it("clears the previous campaign's data", () => {
    const next = reducer(campaignA, { type: "selectCampaign", campaignId: "camp-b" });
    expect(next.selectedCampaignId).toBe("camp-b");
    expect(next.selectedAdventureId).toBeNull();
    expect(next.players).toEqual([]);
    expect(next.adventures).toEqual([]);
    expect(next.inpcs).toEqual([]);
    expect(next.campaignNotes).toEqual([]);
    expect(next.campaignTreasure).toEqual([]);
  });

  it("keeps the data when the same campaign is selected again", () => {
    const next = reducer(campaignA, { type: "selectCampaign", campaignId: "camp-a" });
    expect(next.players).toBe(campaignA.players);
    expect(next.campaignNotes).toBe(campaignA.campaignNotes);
  });
});


describe("note summary refreshes", () => {
  const note = { id: "n1", scope: "campaign", scopeId: "c1", title: "Notes", titleIsDerived: false, text: "Open body", order: 0, updatedAt: 10, bodyLoaded: true } as const;
  for (const [field, type] of [["campaignNotes", "setCampaignNotes"], ["adventureNotes", "setAdventureNotes"]] as const) {
    it(`preserves a loaded body and expansion during ${type}`, () => {
      const state = { ...initialState, [field]: [note], expandedNoteIds: [note.id] };
      const next = reducer(state, { type, notes: [{ ...note, text: "", bodyLoaded: false }] });
      expect(next[field][0].text).toBe("Open body");
      expect(next[field][0].bodyLoaded).toBe(true);
      expect(next.expandedNoteIds).toEqual([note.id]);
    });
    it(`invalidates changed bodies during ${type} so the view reloads them`, () => {
      const state = { ...initialState, [field]: [note], expandedNoteIds: [note.id] };
      const next = reducer(state, { type, notes: [{ ...note, text: "", updatedAt: 11, bodyLoaded: false }] });
      expect(next[field][0].bodyLoaded).toBe(false);
      expect(next.expandedNoteIds).toEqual([note.id]);
    });
    it(`accepts an explicitly emptied body during ${type}`, () => {
      const state = { ...initialState, [field]: [note] };
      expect(reducer(state, { type, notes: [{ ...note, text: "" }] })[field][0].text).toBe("");
    });
  }
});
