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
