// @vitest-environment jsdom
import { act } from "react";
import { expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
const h = vi.hoisted(() => ({ api: vi.fn(), binders: vi.fn() }));
vi.mock("@/services/api", () => ({ api: h.api }));
vi.mock("@/services/binderApi", () => ({ fetchBinders: h.binders }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiMessages: () => (s: string) => s }));
import { useBinderActions } from "./useBinderActions";
it("shows campaigns before slow metadata and Binders finish, coalescing concurrent refreshes", async () => {
  const meta = deferred<unknown>(); const binders = deferred<never[]>();
  const campaigns = [{ id: "c1", name: "Campaign" }];
  h.api.mockImplementation((path: string) => path === "/api/meta" ? meta.promise : Promise.resolve(campaigns));
  h.binders.mockReturnValue(binders.promise);
  const dispatch = vi.fn(); const confirm = vi.fn();
  const hook = await renderHook(() => useBinderActions(dispatch, confirm));
  let pending!: Promise<void>;
  await act(async () => { pending = hook.result.refreshAll(); expect(hook.result.refreshAll()).toBe(pending); });
  expect(dispatch).toHaveBeenCalledWith({ type: "setCampaigns", campaigns });
  expect(hook.result.bindersLoaded).toBe(false);
  await act(async () => { meta.resolve({ ok: true }); binders.resolve([]); await pending; });
  expect(hook.result.bindersLoaded).toBe(true);
  expect(h.api).toHaveBeenCalledTimes(2);
});
it("a failed Binder request preserves successful campaign data", async () => {
  h.api.mockResolvedValue([]); h.binders.mockRejectedValue(new Error("Binder unavailable"));
  const dispatch = vi.fn(); const confirm = vi.fn();
  const hook = await renderHook(() => useBinderActions(dispatch, confirm));
  await act(async () => { await expect(hook.result.refreshAll()).rejects.toThrow("Binder unavailable"); });
  expect(dispatch).toHaveBeenCalledWith({ type: "setCampaigns", campaigns: [] });
  expect(hook.result.bindersLoaded).toBe(false);
});
