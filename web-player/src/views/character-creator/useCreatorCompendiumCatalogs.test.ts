// @vitest-environment jsdom
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
const h = vi.hoisted(() => ({ catalog: vi.fn() }));
vi.mock("@/services/api", () => ({ api: () => Promise.resolve([]) }));
vi.mock("@/services/compendiumApi", () => ({ fetchClassCatalog: h.catalog, fetchRaceCatalog: h.catalog, fetchBackgroundCatalog: h.catalog, fetchFeatCatalog: h.catalog }));
import { useCreatorCompendiumCatalogs } from "./useCreatorCompendiumCatalogs";
beforeEach(() => h.catalog.mockReset());
it("ignores all four old catalogs after switching rulesets", async () => {
  const old = deferred<unknown[]>();
  h.catalog.mockImplementation((ruleset: string) => ruleset === "5e" ? old.promise : Promise.resolve([{ id: "2024", name: "New rules" }]));
  const hook = await renderHook(useCreatorCompendiumCatalogs, "5e" as "5e" | "5.5e" | undefined);
  await hook.rerender("5.5e");
  await act(async () => old.resolve([{ id: "2014", name: "Old rules" }]));
  for (const rows of [hook.result.classes, hook.result.races, hook.result.bgs, hook.result.featSummaries]) expect(rows).toEqual([{ id: "2024", name: "New rules" }]);
});
it("clears old catalog choices when no ruleset is selected", async () => {
  h.catalog.mockResolvedValue([{ id: "old" }]);
  const hook = await renderHook(useCreatorCompendiumCatalogs, "5e" as "5e" | undefined);
  expect(hook.result.classes).toHaveLength(1);
  h.catalog.mockClear(); await hook.rerender(undefined);
  expect([hook.result.classes, hook.result.races, hook.result.bgs, hook.result.featSummaries]).toEqual([[], [], [], []]);
  expect(h.catalog).not.toHaveBeenCalled();
});
