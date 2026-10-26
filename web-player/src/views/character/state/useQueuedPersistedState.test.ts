// @vitest-environment jsdom
import { act } from "react";
import { expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
import { useQueuedPersistedState } from "./useQueuedPersistedState";
it("reconciles an external update received while a save was pending", async () => {
  const pending = deferred<void>(); const save = vi.fn(() => pending.promise);
  const hook = await renderHook((external: number) => useQueuedPersistedState(external, save), 0);
  await act(async () => hook.result[1](() => 1)); await hook.rerender(9);
  expect(hook.result[0]).toBe(1);
  await act(async () => pending.resolve()); expect(hook.result[0]).toBe(9);
});
it("preserves a failed final draft, consumes the rejection, and exposes a working retry", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});
  const hook = await renderHook(() => useQueuedPersistedState<number>(0, save));
  await act(async () => hook.result[1](() => 2));
  expect(hook.result[0]).toBe(2); expect(hook.result[2].error).toBe("offline"); expect(hook.result[2].busy).toBe(false);
  await act(async () => hook.result[2].retry());
  expect(save).toHaveBeenLastCalledWith(2); expect(hook.result[2].error).toBeNull();
});
it("serializes queued writes and does not apply an older server acknowledgement", async () => {
  const first = deferred<unknown>(); const second = deferred<unknown>();
  const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const hook = await renderHook(({ value, version }: { value: number; version: number }) => useQueuedPersistedState(value, save, version), { value: 0, version: 0 });
  await act(async () => { hook.result[1](() => 1); hook.result[1](() => 2); });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => first.resolve({ updatedAt: 1 }));
  await hook.rerender({ value: 1, version: 1 });
  await act(async () => second.resolve({ updatedAt: 2 }));
  expect(save.mock.calls.map(call => call[0])).toEqual([1, 2]); expect(hook.result[0]).toBe(2);
  await hook.rerender({ value: 0, version: 0 }); expect(hook.result[0]).toBe(2);
});
it("retires queued work and local completions after unmount", async () => {
  const pending = deferred<void>(); const save = vi.fn(() => pending.promise);
  const hook = await renderHook(() => useQueuedPersistedState<number>(0, save));
  await act(async () => { hook.result[1](() => 1); hook.result[1](() => 2); });
  await hook.unmount(); await act(async () => pending.resolve()); expect(save).toHaveBeenCalledTimes(1);
});

it("does not replace a newer local snapshot with an earlier echo sharing its timestamp", async () => {
  const first = deferred<unknown>(); const second = deferred<unknown>();
  const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const hook = await renderHook(({ value, version }: { value: number; version: number }) => useQueuedPersistedState(value, save, version), { value: 0, version: 0 });
  await act(async () => { hook.result[1](() => 1); hook.result[1](() => 2); });
  await act(async () => first.resolve({ updatedAt: 1 })); await hook.rerender({ value: 1, version: 1 });
  await act(async () => second.resolve({ updatedAt: 1 })); expect(hook.result[0]).toBe(2);
});
