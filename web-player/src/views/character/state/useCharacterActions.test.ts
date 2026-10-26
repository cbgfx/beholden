// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ update: vi.fn() }));
import { act } from "react";
import { renderHook } from "@beholden/shared/tests/renderHook";
vi.mock("@/services/actorApi", () => ({ updateMyCharacter: mocks.update }));
import { useCharacterActions } from "./useCharacterActions";

async function setup() {
  const initial = { id: "hero", name: "Hero", inventoryRev: "old", characterData: { inventory: [{ id: "rope" }] } };
  let current = initial;
  const hook = await renderHook(() => useCharacterActions({ char: initial, setChar: (apply: (prev: typeof initial) => typeof initial) => { current = apply(current); } } as unknown as Parameters<typeof useCharacterActions>[0]));
  return { actions: hook.result, current: () => current };
}

it("does not pair an unrelated save's fresh revision with stale local inventory", async () => {
  mocks.update.mockResolvedValue({ inventoryRev: "new", characterData: { inventory: [{ id: "rope" }, { id: "award" }] } });
  const { actions, current } = await setup();
  await act(async () => { await actions.saveCharacterData({ playerNotesList: [] }); });
  expect(current().inventoryRev).toBe("old");
  expect(current().characterData.inventory).toEqual([{ id: "rope" }]);
});

it("updates the revision together with an inventory save", async () => {
  mocks.update.mockResolvedValue({ inventoryRev: "new" });
  const { actions, current } = await setup();
  await act(async () => { await actions.saveCharacterData({ inventory: [] }, { expectedInventoryRev: "old" }); });
  expect(current().inventoryRev).toBe("new");
  expect(current().characterData.inventory).toEqual([]);
  expect(mocks.update).toHaveBeenLastCalledWith("hero", expect.objectContaining({ expectedInventoryRev: "old" }));
});
