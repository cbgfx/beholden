// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { useUpdateCheck } from "@beholden/shared/ui/useUpdateCheck";
afterEach(() => vi.restoreAllMocks());
it("prevents a second update before React rerenders and permits retry after failure", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const pending = deferred<unknown>();
  const api = vi.fn().mockReturnValueOnce(pending.promise);
  const hook = await renderHook(() => useUpdateCheck(api, "test"));
  let first!: Promise<void>;
  act(() => { first = hook.result.startUpdate(); void hook.result.startUpdate(); });
  expect(api).toHaveBeenCalledTimes(1); expect(hook.result.updating).toBe(true);
  await act(async () => { pending.reject(new Error("unavailable")); await first; });
  expect(hook.result.message).toBe("unavailable"); expect(hook.result.updating).toBe(false);
  api.mockResolvedValue({ message: "started" });
  await act(async () => { await hook.result.startUpdate(); });
  expect(api).toHaveBeenCalledTimes(2); expect(hook.result.message).toBe("started");
});
