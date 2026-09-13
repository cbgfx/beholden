import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ effects: [] as Array<() => unknown>, api: vi.fn() }));
vi.mock("react", () => ({
  useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
  useEffect: (effect: () => unknown) => { h.effects.push(effect); },
}));
vi.mock("@/services/api", () => ({ api: h.api }));
vi.mock("./usePartyInventorySync", () => ({ usePartyInventorySync: () => ({}) }));
import { useCharacterInventorySync } from "./useCharacterInventorySync";

beforeEach(() => { h.effects = []; h.api.mockReset(); });
function useSetup(inventoryRev?: string) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  useCharacterInventorySync({ inventoryRev, inventory: [{ id: "one", itemId: "catalog", name: "Rope", source: "compendium", quantity: 1, equipped: false }], inventoryContainers: [], onSave });
  return onSave;
}
it("automatic container normalization includes its snapshot revision", async () => {
  const onSave = useSetup("seen-revision");
  h.effects[1]();
  expect(onSave).toHaveBeenCalledWith(expect.anything(), { expectedInventoryRev: "seen-revision" });
});
it("automatic enrichment includes its snapshot revision", async () => {
  const onSave = useSetup("seen-revision");
  h.api.mockResolvedValue({ rows: [{ id: "catalog", text: ["A length of rope."] }] });
  h.effects[4]();
  await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.anything(), { expectedInventoryRev: "seen-revision" }));
});
it("does not write automatic changes when no revision is available", async () => {
  const onSave = useSetup();
  h.api.mockResolvedValue({ rows: [{ id: "catalog", text: ["A length of rope."] }] });
  h.effects[1](); h.effects[4]();
  await Promise.resolve(); await Promise.resolve();
  expect(onSave).not.toHaveBeenCalled();
});
