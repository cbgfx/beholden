// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useLevelUpSubmit } from "./useLevelUpSubmit";

const mocks = vi.hoisted(() => ({ api: vi.fn(), build: vi.fn(() => ({})) }));
vi.mock("@/services/api", () => ({ api: mocks.api, jsonInit: () => ({}) }));
vi.mock("./buildLevelUpPayload", () => ({ buildLevelUpPayload: mocks.build }));

it("submits once for simultaneous confirmations and permits retry after failure", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  const navigate = vi.fn();
  const setError = vi.fn();
  let reject!: (error: Error) => void;
  mocks.api.mockReset().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue({});
  let confirm!: () => Promise<void>;
  function Harness() {
    ({ confirm } = useLevelUpSubmit({
      char: { id: "hero", characterData: {} }, canConfirm: true, extraFeatSpellSelectionsValid: true,
      classCantrips: [], classSpells: [], classInvocations: [], effectiveChosenCantrips: [], effectiveChosenSpells: [], effectiveChosenInvocations: [],
      classFeatureResolvedSpellChoices: [], classFeatureProficiencyChoices: [], invocationResolvedSpellChoices: [],
      maneuverChoiceEntries: [], planChoiceEntries: [], navigate, setError,
    } as unknown as Parameters<typeof useLevelUpSubmit>[0]));
    return null;
  }
  try {
    await act(async () => root.render(<Harness />));
    let first!: Promise<void>;
    await act(async () => {
      first = confirm();
      await confirm();
    });
    expect(mocks.api).toHaveBeenCalledTimes(1);
    await act(async () => { reject(new Error("offline")); await first; });
    expect(setError).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { await confirm(); });
    expect(mocks.api).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith("/characters/hero");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
