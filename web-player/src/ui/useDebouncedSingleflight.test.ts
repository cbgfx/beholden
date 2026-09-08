import { afterEach, beforeEach, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({ cleanups: [] as Array<() => void> }));
vi.mock("react", () => ({ default: {
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) harness.cleanups.push(cleanup);
  },
} }));
import { useDebouncedSingleflight } from "@beholden/shared/ui/useDebouncedSingleflight";

beforeEach(() => {
  harness.cleanups = [];
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});
afterEach(() => { harness.cleanups.forEach((cleanup) => cleanup()); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("recovers from a synchronous callback exception", async () => {
  const run = vi.fn().mockImplementationOnce(() => { throw new Error("failed"); });
  const enqueue = useDebouncedSingleflight(run);
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  expect(run).toHaveBeenCalledTimes(2);
});

it("coalesces refreshes while a request is pending", async () => {
  let finish!: () => void;
  const run = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const enqueue = useDebouncedSingleflight(run);
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
  const enqueue = useDebouncedSingleflight(run);
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  enqueue();
  await vi.advanceTimersByTimeAsync(150);
  harness.cleanups.forEach((cleanup) => cleanup());
  finish(); enqueue();
  await vi.advanceTimersByTimeAsync(1000);
  expect(run).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
