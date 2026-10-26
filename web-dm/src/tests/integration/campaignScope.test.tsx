// @vitest-environment jsdom
import { act, useEffect, useReducer } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
const h = vi.hoisted(() => ({ handler: null as null | ((message: { type: string; payload: unknown }) => void), read: vi.fn() }));
vi.mock("@/services/ws", () => ({ useWs: (handler: typeof h.handler) => { useEffect(() => { h.handler = handler; }, [handler]); } }));
vi.mock("@/services/api", () => ({ api: h.read, apiCoalesced: h.read }));
vi.mock("@/services/collectionApi", async original => ({ ...await original<object>(), fetchNoteById: h.read }));
vi.mock("@/services/actorApi", () => ({ fetchCampaignCharacter: h.read, fetchCampaignCharacters: h.read, fetchEncounterActor: h.read }));
vi.mock("@/services/campaignBootstrapApi", () => ({ fetchCampaignBootstrap: h.read }));
import { useCampaignDataRefresh } from "@/app/useCampaignDataRefresh";
import { useAppWebSocket } from "@/app/useAppWebSocket";
import { reducer } from "@/store/reducer";
import { initialState } from "@/store/state";
import type { State } from "@/store/state";
const scenarios = [
  ["notes:delta", { noteId: "old-note", adventureId: null }, "campaignNotes"],
  ["adventures:delta", { adventureId: "old-adventure" }, "adventures"],
  ["players:delta", { playerId: "old-player" }, "players"],
  ["inpcs:delta", { inpcId: "old-inpc" }, "inpcs"],
  ["encounters:delta", { encounterId: "old-encounter", adventureId: "adv-a" }, "encounters"],
  ["encounter:combatantsDelta", { combatantId: "old-combatant", encounterId: "enc-a" }, "combatants"],
] as const;
beforeEach(() => { vi.useFakeTimers(); h.read.mockReset(); h.handler = null; });
afterEach(() => vi.useRealTimers());
async function setup() {
  const noop = async () => {};
  return renderHook(() => {
    const [state, dispatch] = useReducer(reducer, { ...initialState, selectedCampaignId: "a", selectedAdventureId: "adv-a", selectedEncounterId: "enc-a" });
    useAppWebSocket({ selectedCampaignId: state.selectedCampaignId, selectedAdventureId: state.selectedAdventureId, selectedEncounterId: state.selectedEncounterId, viewedEncounterId: null, dispatch, refreshAll: noop, refreshCampaign: noop, refreshAdventure: noop, refreshEncounter: noop });
    const refresh = useCampaignDataRefresh(dispatch, JSON.stringify([state.selectedCampaignId, state.selectedAdventureId]));
    return { state, dispatch, refresh };
  });
}
it.each(scenarios)("retires a delayed %s response after switching campaigns", async (type, payload, field) => {
  const pending = deferred<unknown>(); h.read.mockReturnValue(pending.promise);
  const hook = await setup();
  await act(async () => { h.handler!({ type, payload: { campaignId: "a", action: "upsert", ...payload } }); await vi.advanceTimersByTimeAsync(80); });
  expect(h.read).toHaveBeenCalledTimes(1);
  await act(async () => hook.result.dispatch({ type: "selectCampaign", campaignId: "b" }));
  await act(async () => pending.resolve({ id: "old", scope: "campaign", scopeId: "a", title: "Old plot", text: "old", order: 0 }));
  expect(hook.result.state[field as keyof State]).toEqual([]);
});
it("does not start a queued old-scope request after navigation", async () => {
  const hook = await setup();
  await act(async () => { h.handler!({ type: "notes:delta", payload: { campaignId: "a", action: "upsert", noteId: "n1" } }); hook.result.dispatch({ type: "selectCampaign", campaignId: "b" }); });
  await act(async () => vi.advanceTimersByTimeAsync(80)); expect(h.read).not.toHaveBeenCalled();
});
it("does not accept a response from the first visit after returning to the same campaign", async () => {
  const pending = deferred<unknown>(); h.read.mockReturnValue(pending.promise); const hook = await setup();
  await act(async () => { h.handler!({ type: "notes:delta", payload: { campaignId: "a", action: "upsert", noteId: "n1" } }); await vi.advanceTimersByTimeAsync(80); });
  await act(async () => hook.result.dispatch({ type: "selectCampaign", campaignId: "b" }));
  await act(async () => hook.result.dispatch({ type: "selectCampaign", campaignId: "a" }));
  await act(async () => pending.resolve({ id: "n1", scope: "campaign", scopeId: "a", text: "stale" }));
  expect(hook.result.state.campaignNotes).toEqual([]);
});

it("retires bootstrap reads on scope change even before the new campaign starts a load", async () => {
  const pending = deferred<unknown>(); h.read.mockReturnValue(pending.promise); const hook = await setup();
  let request!: Promise<void>;
  await act(async () => { request = hook.result.refresh.refreshCampaign("a"); });
  await act(async () => hook.result.dispatch({ type: "selectCampaign", campaignId: "b" }));
  await act(async () => {
    pending.resolve({ adventures: [{ id: "old" }], players: [], inpcs: [], notes: [], treasure: [] }); await request;
  });
  expect(hook.result.state.adventures).toEqual([]);
});
