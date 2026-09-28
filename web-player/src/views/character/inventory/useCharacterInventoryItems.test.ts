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

// Coins are ordinary inventory items named after the currency code, and the currency bar shows the
// total of every matching stack.
function useCoinSetup(items: Array<Partial<InventoryItem> & { id: string }>) {
  const persist = vi.fn().mockResolvedValue(undefined);
  const actions = useCharacterInventoryItems({ sync: { items }, containers: { persist } } as unknown as Parameters<typeof useCharacterInventoryItems>[0]);
  return { actions, persist, saved: () => persist.mock.calls[0]?.[0] as InventoryItem[] };
}

it("replaces every stack of a coin, not just the first", async () => {
  // A class and a background can each grant GP, leaving two stacks that the bar adds up to 58.
  const { actions, persist, saved } = useCoinSetup([
    { id: "class-gp", name: "GP", quantity: 50 },
    { id: "rope", name: "Rope", quantity: 1 },
    { id: "bg-gp", name: "GP", quantity: 8 },
  ]);
  await actions.saveCurrencyAmount("GP", 100);
  expect(persist).toHaveBeenCalledOnce();
  expect(saved().filter((item) => item.name === "GP").map((item) => item.quantity)).toEqual([100]);
  expect(saved().map((item) => item.id)).toEqual(["class-gp", "rope"]);
});

it("removes every stack of a coin when it is set to zero", async () => {
  const { actions, saved } = useCoinSetup([
    { id: "class-gp", name: "GP", quantity: 50 },
    { id: "bg-gp", name: "GP", quantity: 8 },
    { id: "rope", name: "Rope", quantity: 1 },
  ]);
  await actions.saveCurrencyAmount("GP", 0);
  expect(saved().map((item) => item.id)).toEqual(["rope"]);
});

it("starts a stack when the character has none of that coin", async () => {
  const { actions, saved } = useCoinSetup([{ id: "rope", name: "Rope", quantity: 1 }]);
  await actions.saveCurrencyAmount("SP", 12);
  expect(saved().map((item) => ({ name: item.name, quantity: item.quantity }))).toContainEqual({ name: "SP", quantity: 12 });
});
