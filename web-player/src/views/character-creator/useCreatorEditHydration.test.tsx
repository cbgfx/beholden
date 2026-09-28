// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useCreatorEditHydration } from "./useCreatorEditHydration";
import { initForm, type FormState } from "./utils/CharacterCreatorFormUtils";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/services/actorApi", () => ({ fetchMyCharacter: mocks.fetch }));

it("hydrates scoped primary choices without adopting secondary legacy choices", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const scoped = {
    imported: { chosenSpells: ["bless"], chosenCantrips: [], chosenInvocations: [] },
    secondary: { chosenSpells: ["shield"] },
  };
  mocks.fetch.mockResolvedValue({ id: "hero", name: "Hero", className: "Cleric", level: 10,
    characterData: { classes: [{ id: "imported", classId: "cleric", level: 8 }, { id: "secondary", classId: "wizard", level: 2 }],
      chosenSpells: ["shield"], chosenCantrips: ["wizard-cantrip"], classSpellSelections: scoped,
      chosenLevelUpFeats: [
        { level: 8, classEntryId: "imported", classLevel: 8, characterLevel: 10, type: "asi", abilityBonuses: { wis: 2 } },
        { level: 2, classEntryId: "secondary", classLevel: 2, characterLevel: 9, type: "feat", featId: "observant" },
        { level: 4, type: "feat", featId: "legacy-ambiguous" },
      ],
      chosenFeatOptions: {
        "levelupfeat:10:primary-feat:choice": ["primary-option"],
        "levelupfeat:9:observant:choice": ["secondary-option"],
        "levelupfeat:4:legacy-ambiguous:choice": ["legacy-option"],
      } },
  });
  const hydrated = vi.fn();
  const root = createRoot(document.createElement("div"));
  let form!: FormState;
  function Harness() {
    const [value, setForm] = React.useState(() => initForm(null, new URLSearchParams()));
    const [, setLoading] = React.useState(true);
    const initialCampaignIdsRef = React.useRef<string[]>([]);
    form = value;
    useCreatorEditHydration({ editId: "hero", setForm, setEditLoading: setLoading, initialCampaignIdsRef, onHydrated: hydrated });
    return null;
  }
  try {
    await act(async () => root.render(<Harness />));
    expect(form.chosenSpells).toEqual(["bless"]);
    expect(form.chosenCantrips).toEqual([]);
    expect(form.chosenLevelUpFeats).toEqual([expect.objectContaining({ level: 8, classEntryId: "imported", characterLevel: 10 })]);
    // The fixture's primary record is an ASI, so an unrelated key is retained as inert data.
    expect(form.chosenFeatOptions["levelupfeat:10:primary-feat:choice"]).toEqual(["primary-option"]);
    expect(hydrated).toHaveBeenCalledWith(expect.objectContaining({
      existingClassSpellSelections: scoped,
      preservedLevelUpFeats: [
        expect.objectContaining({ level: 2, classEntryId: "secondary", featId: "observant" }),
        expect.objectContaining({ level: 4, featId: "legacy-ambiguous" }),
      ],
      preservedLevelUpFeatOptions: {
        "levelupfeat:9:observant:choice": ["secondary-option"],
        "levelupfeat:4:legacy-ambiguous:choice": ["legacy-option"],
      },
    }));
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
