import { beforeEach, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as Array<() => void | (() => void)>,
  catalog: vi.fn(),
}));
vi.mock("react", () => ({ default: {
  useState(initial: unknown) {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [harness.slots[index], (value: unknown) => { harness.slots[index] = value; }];
  },
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
} }));
vi.mock("@/services/api", () => ({ api: () => Promise.resolve([]) }));
vi.mock("@/services/compendiumApi", () => ({
  fetchClassCatalog: harness.catalog, fetchRaceCatalog: harness.catalog,
  fetchBackgroundCatalog: harness.catalog, fetchFeatCatalog: harness.catalog,
}));
import { useCreatorCompendiumCatalogs } from "./useCreatorCompendiumCatalogs";

beforeEach(() => { harness.slots = []; harness.cursor = 0; harness.effects = []; harness.catalog.mockReset(); });

function Render(ruleset: "5e" | "5.5e" | undefined) {
  harness.cursor = 0;
  harness.effects = [];
  return useCreatorCompendiumCatalogs(ruleset);
}

it("ignores all four old catalogs after switching rulesets", async () => {
  const oldResolvers: Array<(value: unknown) => void> = [];
  harness.catalog.mockImplementation((ruleset: string) => ruleset === "5e"
    ? new Promise((resolve) => oldResolvers.push(resolve))
    : Promise.resolve([{ id: "2024", name: "New rules" }]));
  Render("5e");
  const cleanups = harness.effects.map((effect) => effect());
  cleanups.forEach((cleanup) => cleanup?.());
  Render("5.5e");
  harness.effects.forEach((effect) => effect());
  await Promise.resolve();
  oldResolvers.forEach((resolve) => resolve([{ id: "2014", name: "Old rules" }]));
  await Promise.resolve();
  const result = Render("5.5e");
  for (const rows of [result.classes, result.races, result.bgs, result.featSummaries]) {
    expect(rows).toEqual([{ id: "2024", name: "New rules" }]);
  }
});

it("clears old catalog choices when no ruleset is selected", () => {
  harness.slots = [[{ id: "old" }], [{ id: "old" }], [{ id: "old" }], [{ id: "old" }], []];
  Render(undefined);
  harness.effects[0]();
  const result = Render(undefined);
  expect([result.classes, result.races, result.bgs, result.featSummaries]).toEqual([[], [], [], []]);
  expect(harness.catalog).not.toHaveBeenCalled();
});
