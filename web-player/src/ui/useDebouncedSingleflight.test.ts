// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderHook } from "@beholden/shared/tests/renderHook";
import { useDebouncedSingleflight } from "@beholden/shared/ui/useDebouncedSingleflight";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("recovers from a synchronous callback exception", async () => {
  const run = vi.fn().mockImplementationOnce(() => { throw new Error("failed"); });
  const hook = await renderHook(() => useDebouncedSingleflight(run));
  const enqueue = hook.result;
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  expect(run).toHaveBeenCalledTimes(2);
});

it("coalesces refreshes while a request is pending", async () => {
  let finish!: () => void;
  const run = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const hook = await renderHook(() => useDebouncedSingleflight(run));
  const enqueue = hook.result;
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  enqueue(); enqueue();
  await vi.advanceTimersByTimeAsync(150);
  expect(run).toHaveBeenCalledTimes(1);
  finish();
  await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(2);
});

it("does not run queued refreshes or accept new ones after unmount", async () => {
  let finish!: () => void;
  const run = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const hook = await renderHook(() => useDebouncedSingleflight(run));
  const enqueue = hook.result;
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  await hook.unmount();
  finish(); enqueue();
  await vi.advanceTimersByTimeAsync(1000);
  expect(run).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
