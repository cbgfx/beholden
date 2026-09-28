import { expect, it, vi } from "vitest";
import { createDerivedStatSync, type DerivedStats } from "./derivedStatSync";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const stats = (over: Partial<DerivedStats> = {}): DerivedStats => ({ charId: "hero", ac: 15, hpMax: 30, speed: 30, ...over });

function harness() {
  const calls: Array<{ body: Record<string, number>; resolve: () => void; reject: () => void }> = [];
  const put = vi.fn((_charId: string, body: Record<string, number>) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ body, resolve: () => resolve(), reject: () => reject(new Error("net")) });
    }));
  const timers: Array<() => void> = [];
  const sync = createDerivedStatSync(put, {
    retryMs: 1000,
    maxRetries: 3,
    schedule: (fn) => { timers.push(fn); return timers.length; },
    cancel: (handle) => { timers[(handle as number) - 1] = () => {}; },
  });
  const runTimers = () => timers.splice(0).forEach((fn) => fn());
  return { put, calls, sync, runTimers };
}

it("retries after a failed push and stops once the server acknowledges", async () => {
  const { calls, sync, runTimers, put } = harness();
  sync.set(stats());
  expect(calls).toHaveLength(1);

  calls[0].reject(); await tick();
  runTimers();
  expect(calls).toHaveLength(2);

  calls[1].resolve(); await tick();
  sync.set(stats());               // identical + acknowledged → no new request
  expect(put).toHaveBeenCalledTimes(2);
});

it("does not let an older completion acknowledge newer desired values", async () => {
  const { calls, sync, put } = harness();
  sync.set(stats({ hpMax: 30 }));  // request A
  sync.set(stats({ hpMax: 40 }));  // desired advances while A is still in flight
  expect(calls).toHaveLength(1);

  calls[0].resolve(); await tick();
  expect(calls).toHaveLength(2);
  expect(calls[1].body.syncedHpMax).toBe(40);

  calls[1].resolve(); await tick();
  sync.set(stats({ hpMax: 40 }));  // now acknowledged
  expect(put).toHaveBeenCalledTimes(2);
});

it("sends only one request at a time", async () => {
  const { calls, sync } = harness();
  sync.set(stats({ ac: 15 }));
  sync.set(stats({ ac: 16 }));
  sync.set(stats({ ac: 17 }));
  expect(calls).toHaveLength(1);
});

it("skips the push when desired already matches acknowledged", async () => {
  const { calls, sync } = harness();
  sync.set(stats());
  calls[0].resolve(); await tick();
  sync.set(stats());
  expect(calls).toHaveLength(1);
});

it("poke re-attempts a pending failed push immediately", async () => {
  const { calls, sync } = harness();
  sync.set(stats());
  calls[0].reject(); await tick();
  sync.poke();
  expect(calls).toHaveLength(2);
});

it("stops retrying after maxRetries and produces no unhandled rejection", async () => {
  const { calls, sync, runTimers } = harness();
  sync.set(stats());
  for (let i = 0; i < 6; i += 1) {
    calls[calls.length - 1].reject();
    await tick();
    runTimers();
  }
  expect(calls).toHaveLength(4); // initial + 3 retries
});

it("dispose cancels a pending retry and sends nothing further", async () => {
  const { calls, sync, runTimers } = harness();
  sync.set(stats());
  calls[0].reject(); await tick();
  sync.dispose();
  runTimers();
  expect(calls).toHaveLength(1);
});
