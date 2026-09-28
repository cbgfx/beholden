// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useSpellChoiceOptions, type ChoiceLoadState } from "./useChoiceDataLoaders";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/services/api", () => ({ api: mocks.api }));

it("reports a retry failure without erasing the last loaded spell choices", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.api.mockResolvedValue([{ id: "bless", name: "Bless", level: 1 }]);
  const root = createRoot(document.createElement("div"));
  let options: ReturnType<typeof useSpellChoiceOptions> = {};
  let state: ChoiceLoadState = "loading";
  const choices = [{ key: "feat:spell", title: "Spell", count: 1, level: 1, listNames: ["Cleric"] }];
  function Harness({ retryKey }: { retryKey: number }) {
    options = useSpellChoiceOptions({ choices, retryKey, onLoadState: (next) => { state = next; } });
    return null;
  }
  try {
    await act(async () => { root.render(<Harness retryKey={0} />); });
    expect(options["feat:spell"]?.map((entry) => entry.id)).toEqual(["bless"]);
    expect(state).toBe("complete");

    mocks.api.mockReset().mockRejectedValue(new Error("offline"));
    await act(async () => { root.render(<Harness retryKey={1} />); });
    expect(state).toBe("failed");
    expect(options["feat:spell"]?.map((entry) => entry.id)).toEqual(["bless"]);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
