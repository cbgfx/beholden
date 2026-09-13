import { expect, it, vi } from "vitest";
import { useCharacterInventoryItems } from "./useCharacterInventoryItems";
import type { InventoryItem } from "./CharacterInventory";

function useSetup() {
  const items = ["a", "other", "b"].map((id) => ({ id, name: id, quantity: 1, equipped: false }));
  const persist = vi.fn().mockResolvedValue(undefined);
  const actions = useCharacterInventoryItems({ sync: { items }, containers: { persist } } as unknown as Parameters<typeof useCharacterInventoryItems>[0]);
  return { actions, persist, items };
}
const inContainer = (item: InventoryItem) => item.id !== "other";

it("rejects duplicate IDs that would duplicate one item and erase another", async () => {
  const { actions, persist } = useSetup();
  await actions.reorderItemsByIds(["a", "a"], inContainer);
  expect(persist).not.toHaveBeenCalled();
});

it("reorders only the selected subset and preserves other inventory slots", async () => {
  const { actions, persist, items } = useSetup();
  await actions.reorderItemsByIds(["b", "a"], inContainer);
  expect(persist).toHaveBeenCalledExactlyOnceWith([items[2], items[1], items[0]]);
});

it("does not save unchanged, incomplete or foreign-ID orders", async () => {
  const { actions, persist } = useSetup();
  for (const ids of [["a", "b"], ["a"], ["a", "missing"]]) {
    await actions.reorderItemsByIds(ids, inContainer);
  }
  expect(persist).not.toHaveBeenCalled();
});
