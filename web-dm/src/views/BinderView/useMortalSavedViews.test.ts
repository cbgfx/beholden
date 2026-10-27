// @vitest-environment jsdom
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderHook } from "@beholden/shared/tests/renderHook";
import { emptyMortalFilters, useMortalSavedViews } from "./useMortalSavedViews";

beforeEach(() => { localStorage.clear(); });

it("saves, restores, updates and deletes a view without secure-context crypto", async () => {
  const randomUUID = vi.spyOn(crypto, "randomUUID").mockImplementation(() => { throw new Error("Unavailable over HTTP"); });
  try {
    const hook = await renderHook(useMortalSavedViews, "binder-one");
    const filters = { ...emptyMortalFilters(), status: ["alive"], linked: ["false"] };
    await act(async () => hook.result.setViewName("Living NPCs"));
    await act(async () => hook.result.save("guard", filters));
    const id = hook.result.selectedViewId;
    expect(id).toBeTruthy();
    expect(randomUUID).not.toHaveBeenCalled();
    await hook.unmount();
    const restored = await renderHook(useMortalSavedViews, "binder-one");
    let applied;
    await act(async () => { applied = restored.result.apply(id); });
    expect(applied).toMatchObject({ name: "Living NPCs", query: "guard", filters });
    await act(async () => restored.result.setViewName("Living NPCs"));
    await act(async () => restored.result.save("captain", filters));
    expect(restored.result.savedViews).toHaveLength(1);
    expect(restored.result.savedViews[0]).toMatchObject({ id, query: "captain" });
    await act(async () => restored.result.removeSelected());
    expect(JSON.parse(localStorage.getItem("binder:binder-one:mortal-views")!)).toEqual([]);
  } finally { randomUUID.mockRestore(); }
});
