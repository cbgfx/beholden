// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { i18n } from "@/i18n";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transfer: vi.fn() }));
vi.mock("@/services/inventoryApi", () => ({ transferPartyInventoryItem: mocks.transfer }));
import { useCharacterInventoryContainers } from "./useCharacterInventoryContainers";
import type { CharacterInventorySyncState } from "./useCharacterInventorySync";

function useSetup() {
  const sync = { items: [], containers: [], partyStashItems: [], setItems: vi.fn(), setContainers: vi.fn(), setSaving: vi.fn(), setConflict: vi.fn() };
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onReload = vi.fn().mockResolvedValue(undefined);
  const actions = mountActions({ sync: sync as unknown as CharacterInventorySyncState, campaignId: "party", characterId: "hero", inventoryRev: "seen", onSave, onReload });
  return { actions, sync, onSave, onReload };
}
beforeEach(() => { mocks.transfer.mockReset().mockResolvedValue({ inventoryRev: "next" }); });

it("reloads on conflict but still rejects so editors do not close", async () => {
  const { actions, sync, onSave, onReload } = useSetup();
  const error = Object.assign(new Error("conflict"), { status: 409 });
  onSave.mockRejectedValue(error);
  await expect(actions.persist([])).rejects.toBe(error);
  expect(onReload).toHaveBeenCalledOnce();
  expect(sync.setItems).not.toHaveBeenCalled();
  expect(sync.setConflict).toHaveBeenLastCalledWith(expect.stringContaining("has been reloaded"));
});

it("does not claim reload succeeded when recovery fails", async () => {
  const { actions, sync, onSave, onReload } = useSetup();
  onSave.mockRejectedValue({ status: 409 }); onReload.mockRejectedValue(new Error("offline"));
  await expect(actions.persist([])).rejects.toEqual({ status: 409 });
  expect(sync.setConflict).toHaveBeenLastCalledWith(expect.stringContaining("reloading failed"));
});

it("shows a stash-specific message (not a character reload) when the stash row moved", async () => {
  const { actions, sync, onReload } = useSetup();
  mocks.transfer.mockRejectedValue(Object.assign(new Error("stale"), { status: 409, code: "stale-stash" }));
  await expect(actions.transferItem([], { action: "delete", itemId: "s", expectedQuantity: 1 })).rejects.toMatchObject({ code: "stale-stash" });
  expect(onReload).not.toHaveBeenCalled();
  expect(sync.setConflict).toHaveBeenLastCalledWith(expect.stringContaining("party stash changed"));
});

it("reloads after a transfer without writing inventory a second time", async () => {
  const { actions, onSave, onReload } = useSetup();
  await actions.transferItem([], { action: "create", item: { name: "Rope" } });
  expect(mocks.transfer).toHaveBeenCalledOnce(); expect(onReload).toHaveBeenCalledOnce();
  expect(onSave).not.toHaveBeenCalled();
});

it("reports a completed transfer separately from a failed reload", async () => {
  const { actions, sync, onSave, onReload } = useSetup();
  onReload.mockRejectedValue(new Error("offline"));
  await expect(actions.transferItem([], { action: "create", item: { name: "Rope" } })).resolves.toBeUndefined();
  expect(sync.setConflict).toHaveBeenLastCalledWith(expect.stringContaining("Transfer completed"));
  expect(onSave).not.toHaveBeenCalled();
});

function useDepositSetup(item: Record<string, unknown>, partyStashItems: Array<Record<string, unknown>> = []) {
  const sync = {
    items: [{ id: "x", equipped: false, ...item }],
    containers: [], partyStashItems,
    setItems: vi.fn(), setContainers: vi.fn(), setSaving: vi.fn(), setConflict: vi.fn(), setExpandedItemId: vi.fn(),
  };
  const actions = mountActions({
    sync: sync as unknown as CharacterInventorySyncState,
    campaignId: "party", characterId: "hero", inventoryRev: "seen",
    onSave: vi.fn().mockResolvedValue(undefined), onReload: vi.fn().mockResolvedValue(undefined),
  });
  return { actions };
}

it("deposits a customized item as its own stash row carrying the full payload", async () => {
  const { actions } = useDepositSetup(
    { name: "Wand", quantity: 1, type: "wand", notes: "half used", chargesMax: 5, charges: 2 },
    [{ id: "s1", name: "Wand", quantity: 1, notes: "", type: "wand" }],
  );
  await actions.moveItemToContainer("x", "party-stash");
  const op = mocks.transfer.mock.calls[0][1].stash;
  expect(op.action).toBe("create");
  expect(op.item.payload).toMatchObject({ notes: "half used", chargesMax: 5, charges: 2 });
});

it("folds a plain stackable deposit into a matching plain stash stack", async () => {
  const { actions } = useDepositSetup(
    { name: "Arrows", quantity: 20, type: "ammunition" },
    [{ id: "s2", name: "Arrows", quantity: 20, notes: "", type: "ammunition", payload: null }],
  );
  await actions.moveItemToContainer("x", "party-stash");
  const op = mocks.transfer.mock.calls[0][1].stash;
  expect(op).toMatchObject({ action: "setQuantity", itemId: "s2", quantity: 40, expectedQuantity: 20 });
});

const mounted: Array<{ root: Root; host: HTMLDivElement }> = [];
function mountActions(props: Parameters<typeof useCharacterInventoryContainers>[0]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  let actions!: ReturnType<typeof useCharacterInventoryContainers>;
  function Harness() { actions = useCharacterInventoryContainers(props); return null; }
  act(() => root.render(createElement(I18nextProvider, { i18n }, createElement(Harness))));
  return actions;
}
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); });
afterEach(() => {
  for (const { root, host } of mounted.splice(0)) { act(() => root.unmount()); host.remove(); }
  vi.unstubAllGlobals();
});
