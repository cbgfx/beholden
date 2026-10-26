// @vitest-environment jsdom
import { act } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
import { useDebouncedTaskQueue } from "@beholden/shared/ui/useDebouncedTaskQueue";
beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
it("retires a pending rerun when unmounted with a request in flight", async () => {
  const pending = deferred<void>(); const run = vi.fn(() => pending.promise);
  const hook = await renderHook(useDebouncedTaskQueue);
  hook.result("read", run, 10); await act(async () => vi.advanceTimersByTimeAsync(10));
  hook.result("read", run, 10); await act(async () => vi.advanceTimersByTimeAsync(10));
  await hook.unmount(); await act(async () => pending.resolve());
  hook.result("read", run, 10); await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(run).toHaveBeenCalledTimes(1);
});
it("recovers from synchronous errors and uses the most recent queued callback", async () => {
  const hook = await renderHook(useDebouncedTaskQueue); const bad = vi.fn(() => { throw new Error("sync"); }); const fresh = vi.fn();
  hook.result("read", bad, 10); await act(async () => vi.advanceTimersByTimeAsync(10));
  hook.result("read", bad, 10); hook.result("read", fresh, 10); await act(async () => vi.advanceTimersByTimeAsync(10));
  expect(bad).toHaveBeenCalledTimes(1); expect(fresh).toHaveBeenCalledTimes(1);
});
