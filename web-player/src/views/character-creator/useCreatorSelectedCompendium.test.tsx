// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useCreatorSelectedCompendium } from "./useCreatorSelectedCompendium";
import type { FormState } from "./utils/CharacterCreatorFormUtils";

const mocks = vi.hoisted(() => ({ detail: vi.fn(), spells: vi.fn() }));
vi.mock("@/services/compendiumApi", () => ({ fetchGrandClassDetail: mocks.detail, fetchGrandSpeciesDetail: async () => ({}), fetchGrandBackgroundDetail: async () => ({}) }));
vi.mock("@/views/level-up/fetchLevelUpSpellOptions", () => ({ fetchLevelUpSpellOptions: mocks.spells }));
vi.mock("@/services/spellLookup", () => ({ fetchSpellsByName: async () => [], mergeSpellsById: (base: unknown) => base }));

it("keeps failed class options blocked, retries them, and preserves choices", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.detail.mockResolvedValue({ name: "Cleric", autolevels: [] });
  mocks.spells.mockRejectedValue(new Error("offline"));
  const root = createRoot(document.createElement("div"));
  let result!: ReturnType<typeof useCreatorSelectedCompendium>;
  let form!: FormState;
  function Harness() {
    const [value, setForm] = React.useState({ classId: "cleric", raceId: "human", bgId: "sage", ruleset: "5.5e", level: 8, subclass: "Light", chosenSpells: ["bless", "fireball"], chosenFeatOptions: {} } as FormState);
    form = value;
    result = useCreatorSelectedCompendium({ form: value, setForm, isEditing: true });
    return null;
  }
  try {
    await act(async () => { root.render(<Harness />); });
    expect(result.classSpellOptionsLoaded).toBe(false);
    expect(result.loadRequirements.find((entry) => entry.id === "load:class-options")?.state).toBe("failed");
    expect(form.chosenSpells).toEqual(["bless", "fireball"]);
    mocks.spells.mockResolvedValue([]);
    await act(async () => { result.retryOptions(); });
    expect(result.classSpellOptionsLoaded).toBe(true);
    expect(result.loadRequirements.every((entry) => entry.state === "complete")).toBe(true);
    expect(form.chosenSpells).toEqual(["bless", "fireball"]);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
