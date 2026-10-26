// @vitest-environment jsdom
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/services/api", () => ({ api: h.api }));
vi.mock("./usePartyInventorySync", () => ({ usePartyInventorySync: () => ({}) }));
import { useCharacterInventorySync } from "./useCharacterInventorySync";
beforeEach(() => { h.api.mockReset().mockResolvedValue({ rows: [] }); });
async function setup(inventoryRev?: string) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const props = { inventoryRev, inventory: [{ id: "one", itemId: "catalog", name: "Rope", source: "compendium" as const, quantity: 1, equipped: false }], inventoryContainers: [], onSave };
  const hook = await renderHook(useCharacterInventorySync, props);
  return { hook, onSave, props };
}
it("automatic container normalization includes its snapshot revision", async () => {
  const { onSave } = await setup("seen-revision");
  expect(onSave).toHaveBeenCalledWith(expect.anything(), { expectedInventoryRev: "seen-revision" });
});
it("automatic enrichment includes its snapshot revision", async () => {
  h.api.mockImplementation((_url: string, init: RequestInit) => Promise.resolve({ rows: JSON.parse(String(init.body)).includeText ? [{ id: "catalog", name: "Rope", text: ["A length of rope."] }] : [] }));
  const { onSave } = await setup("seen-revision");
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ inventory: [expect.objectContaining({ description: "A length of rope." })] }), { expectedInventoryRev: "seen-revision" });
});
it("does not write automatic changes when no revision is available", async () => {
  h.api.mockResolvedValue({ rows: [{ id: "catalog", name: "Rope", text: ["A length of rope."] }] });
  const { onSave } = await setup();
  expect(onSave).not.toHaveBeenCalled();
});
it("does not enrich a departed inventory from an old lookup", async () => {
  const lookup = deferred<unknown>(); h.api.mockReturnValue(lookup.promise);
  const { hook, onSave } = await setup("old-revision");
  await hook.unmount(); onSave.mockClear();
  await act(async () => lookup.resolve({ rows: [{ id: "catalog", name: "Rope", text: ["Stale description"] }] }));
  expect(onSave).not.toHaveBeenCalled();
});
