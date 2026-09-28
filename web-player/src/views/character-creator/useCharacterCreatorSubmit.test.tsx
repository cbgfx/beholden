// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { useCharacterCreatorSubmit } from "./useCharacterCreatorSubmit";
import { initForm } from "./utils/CharacterCreatorFormUtils";
import type { ProgressionRequirement } from "@beholden/shared/domain/progressionRequirements";

const mocks = vi.hoisted(() => ({ create: vi.fn(), build: vi.fn(), api: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/services/actorApi", () => ({ createMyCharacter: mocks.create }));
vi.mock("@/services/api", () => ({ api: mocks.api, jsonInit: (method: string, body: unknown) => ({ method, body }) }));
vi.mock("./creatorSubmission", () => ({ buildCreatorSubmissionBody: mocks.build }));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  mocks.create.mockReset();
  mocks.build.mockReset();
  mocks.api.mockReset();
});

it("keeps the creation token in the URL so a refreshed draft retries idempotently", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const form = { ...initForm(null, new URLSearchParams()), characterName: "Diego", ruleset: "5.5e" as const, age: "30", gender: "male" };
  mocks.build.mockResolvedValue({ body: { level: 1 } });
  mocks.create.mockResolvedValue({ id: "diego" });
  const renderAndSubmit = async () => {
    const root = createRoot(document.createElement("div"));
    let submit!: () => Promise<boolean>;
    function Harness() {
      ({ handleSubmit: submit } = useCharacterCreatorSubmit({ requirements: [], form, classDetail: null, raceDetail: null, bgDetail: null, isEditing: false,
        existingClasses: [], initialCampaignIdsRef: { current: [] }, navigate: vi.fn(), setError: vi.fn() } as unknown as Parameters<typeof useCharacterCreatorSubmit>[0]));
      return null;
    }
    await act(async () => root.render(<Harness />));
    await act(async () => { await submit(); });
    await act(async () => root.unmount());
  };
  try {
    await renderAndSubmit();
    const firstToken = new URL(window.location.href).searchParams.get("creationToken");
    await renderAndSubmit();
    expect(firstToken).toBeTruthy();
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({ creationToken: firstToken });
    expect(mocks.create.mock.calls[1]?.[0]).toMatchObject({ creationToken: firstToken });
  } finally {
    vi.unstubAllGlobals();
  }
});

it("the submission callback enforces the displayed gate, including failed/loading states", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.createElement("div"));
  const setError = vi.fn();
  const navigate = vi.fn();
  let submit!: () => Promise<boolean>;
  const form = { ...initForm(null, new URLSearchParams()), characterName: "Diego", ruleset: "5.5e" as const, age: "30", gender: "male" };
  function Harness({ state }: { state: ProgressionRequirement["state"] }) {
    ({ handleSubmit: submit } = useCharacterCreatorSubmit({
      requirements: [{ id: "feat-spell", state, message: "Complete feat spell", step: 8 }],
      form, classDetail: null, raceDetail: null, bgDetail: null, isEditing: false,
      existingClasses: [], initialCampaignIdsRef: { current: [] }, navigate, setError,
    } as unknown as Parameters<typeof useCharacterCreatorSubmit>[0]));
    return null;
  }
  try {
    for (const state of ["loading", "failed", "incomplete"] as const) {
      await act(async () => root.render(<Harness state={state} />));
      await act(async () => { expect(await submit()).toBe(false); });
      expect(setError).toHaveBeenLastCalledWith("Complete feat spell");
    }
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.build.mockResolvedValue({ body: { level: 1 } });
    mocks.create.mockResolvedValue({ id: "diego" });
    await act(async () => root.render(<Harness state="complete" />));
    await act(async () => { expect(await submit()).toBe(true); });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it("retries failed follow-up work without creating a second character", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.createElement("div"));
  const setError = vi.fn();
  const navigate = vi.fn();
  let submit!: () => Promise<boolean>;
  const form = { ...initForm(null, new URLSearchParams()), characterName: "Diego", ruleset: "5.5e" as const, age: "30", gender: "male", campaignIds: ["campaign"] };
  mocks.build.mockResolvedValue({ body: { level: 1 } });
  mocks.create.mockResolvedValue({ id: "diego" });
  mocks.api.mockRejectedValueOnce(new Error("assignment offline")).mockResolvedValue({});
  function Harness() {
    ({ handleSubmit: submit } = useCharacterCreatorSubmit({
      requirements: [], form, classDetail: null, raceDetail: null, bgDetail: null, isEditing: false,
      existingClasses: [], initialCampaignIdsRef: { current: [] }, navigate, setError,
    } as unknown as Parameters<typeof useCharacterCreatorSubmit>[0]));
    return null;
  }
  try {
    await act(async () => root.render(<Harness />));
    await act(async () => { expect(await submit()).toBe(false); });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenLastCalledWith("Character saved, but a campaign assignment or portrait update failed. Retry to finish those updates.");
    await act(async () => { expect(await submit()).toBe(true); });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.api).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith("/characters/diego", { replace: true });
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it("does not repeat a completed campaign assignment when portrait upload is retried", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.createElement("div"));
  let submit!: () => Promise<boolean>;
  const form = { ...initForm(null, new URLSearchParams()), characterName: "Diego", ruleset: "5.5e" as const, age: "30", gender: "male", campaignIds: ["campaign"] };
  mocks.build.mockResolvedValue({ body: { level: 1 } });
  mocks.create.mockResolvedValue({ id: "diego" });
  mocks.api.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("portrait offline")).mockResolvedValueOnce({});
  function Harness() {
    ({ handleSubmit: submit } = useCharacterCreatorSubmit({ requirements: [], form, classDetail: null, raceDetail: null, bgDetail: null, isEditing: false,
      portraitFile: new File(["portrait"], "portrait.png", { type: "image/png" }),
      existingClasses: [], initialCampaignIdsRef: { current: [] }, navigate: vi.fn(), setError: vi.fn() } as unknown as Parameters<typeof useCharacterCreatorSubmit>[0]));
    return null;
  }
  try {
    await act(async () => root.render(<Harness />));
    await act(async () => { expect(await submit()).toBe(false); });
    await act(async () => { expect(await submit()).toBe(true); });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.api.mock.calls.filter(([path]) => String(path).endsWith("/assign"))).toHaveLength(1);
    expect(mocks.api.mock.calls.filter(([path]) => String(path).endsWith("/image"))).toHaveLength(2);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
