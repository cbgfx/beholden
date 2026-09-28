import { expect, it, vi } from "vitest";
import { createPartyInventorySync } from "./partyInventorySync";
import type { PartyCurrencyMap, PartyInventoryResult } from "@/services/inventoryApi";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
type Item = PartyInventoryResult["items"][number];
const item = (id: string, quantity = 1) => ({ id, quantity } as Item);
const snapshot: PartyInventoryResult = { items: [item("one")], partyCapacityLbs: 50 };
function setup() {
  const io = {
    inventory: vi.fn<() => Promise<PartyInventoryResult>>().mockResolvedValue(snapshot),
    item: vi.fn<(id: string) => Promise<Item>>().mockResolvedValue(item("one")),
    currency: vi.fn<() => Promise<PartyCurrencyMap>>().mockResolvedValue({ PP: 0, GP: 0, SP: 0, CP: 0 }),
    patchCurrency: vi.fn<(patch: Partial<PartyCurrencyMap>) => Promise<PartyCurrencyMap>>(),
    snapshot: vi.fn(), upsert: vi.fn(), remove: vi.fn(), setCurrency: vi.fn(), scheduleRefresh: vi.fn(),
  };
  return { io, sync: createPartyInventorySync(io) };
}
it("does not restore an item deleted while its lookup was pending", async () => {
  const { io, sync } = setup();
  const request = deferred<Item>(); io.item.mockReturnValue(request.promise);
  const pending = sync.delta("upsert", "one");
  await sync.delta("delete", "one");
  request.resolve(item("one")); await pending;
  expect(io.remove).toHaveBeenCalledWith("one");
  expect(io.upsert).not.toHaveBeenCalled();
});
it("keeps the newest same-item response without dropping other items", async () => {
  const { io, sync } = setup();
  const first = deferred<Item>(); io.item.mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(item("one", 3)).mockResolvedValueOnce(item("two"));
  const pending = sync.delta("upsert", "one");
  await sync.delta("upsert", "one"); await sync.delta("upsert", "two");
  first.resolve(item("one", 1)); await pending;
  expect(io.upsert.mock.calls.map(([value]) => value)).toEqual([item("one", 3), item("two")]);
});
it("rejects a snapshot overtaken by a delta and schedules reconciliation", async () => {
  const { io, sync } = setup();
  const request = deferred<PartyInventoryResult>(); io.inventory.mockReturnValueOnce(request.promise);
  const pending = sync.refresh();
  await sync.delta("delete", "one"); request.resolve(snapshot); await pending;
  expect(io.snapshot).not.toHaveBeenCalled();
  expect(io.scheduleRefresh).toHaveBeenCalledOnce();
  await sync.refresh(); expect(io.snapshot).toHaveBeenCalledOnce();
});
it("a newer snapshot retires older item lookups", async () => {
  const { io, sync } = setup();
  const request = deferred<Item>(); io.item.mockReturnValue(request.promise);
  const pending = sync.delta("upsert", "one");
  await sync.refresh(); request.resolve(item("one")); await pending;
  expect(io.upsert).not.toHaveBeenCalled();
  expect(io.snapshot).toHaveBeenCalledOnce();
});
it("ignores out-of-order currency responses", async () => {
  const { io, sync } = setup();
  const request = deferred<PartyCurrencyMap>(); io.currency.mockReturnValueOnce(request.promise);
  const pending = sync.refreshCurrency(); await sync.refreshCurrency();
  request.resolve({ PP: 0, GP: 99, SP: 0, CP: 0 }); await pending;
  expect(io.setCurrency).toHaveBeenCalledExactlyOnceWith({ PP: 0, GP: 0, SP: 0, CP: 0 });
});
it("retires all pending reads when leaving a campaign", async () => {
  const { io, sync } = setup();
  const pending = [sync.refresh(), sync.refreshCurrency(), sync.delta("upsert", "one")];
  sync.dispose(); await Promise.all(pending);
  expect(io.snapshot).not.toHaveBeenCalled(); expect(io.setCurrency).not.toHaveBeenCalled();
  expect(io.upsert).not.toHaveBeenCalled();
  await sync.refresh(); expect(io.inventory).toHaveBeenCalledOnce();
});
it("falls back to a full refresh when the current item lookup fails", async () => {
  const { io, sync } = setup(); io.item.mockRejectedValue(new Error("offline"));
  await sync.delta("upsert", "one"); expect(io.scheduleRefresh).toHaveBeenCalledOnce();
});

it("currency writes retire older reads and reject overlapping submissions", async () => {
  const { io, sync } = setup();
  const oldRead = deferred<PartyCurrencyMap>();
  const write = deferred<PartyCurrencyMap>();
  const balance = { PP: 0, GP: 42, SP: 0, CP: 0 };
  io.currency.mockReturnValueOnce(oldRead.promise).mockResolvedValue(balance);
  io.patchCurrency.mockReturnValue(write.promise);
  const read = sync.refreshCurrency();
  const save = sync.saveCurrency({ GP: 42 });
  expect(await sync.saveCurrency({ GP: 99 })).toBe(false);
  await sync.refreshCurrency();
  oldRead.resolve({ ...balance, GP: 1 }); await read;
  expect(io.setCurrency).not.toHaveBeenCalled();
  write.resolve(balance); expect(await save).toBe(true);
  expect(io.patchCurrency).toHaveBeenCalledExactlyOnceWith({ GP: 42 });
  expect(io.setCurrency.mock.calls.every(([value]) => value.GP === 42)).toBe(true);
  expect(io.currency).toHaveBeenCalledTimes(2);
});

it("failed writes reconcile instead of restoring a stale balance and allow retry", async () => {
  const { io, sync } = setup();
  const balance = { PP: 0, GP: 17, SP: 0, CP: 0 };
  io.currency.mockResolvedValue(balance);
  io.patchCurrency.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(balance);
  await expect(sync.saveCurrency({ GP: 42 })).rejects.toThrow("offline");
  expect(io.setCurrency).toHaveBeenCalledWith(balance);
  expect(await sync.saveCurrency({ GP: 17 })).toBe(true);
});

it("does not apply a currency write after leaving its campaign", async () => {
  const { io, sync } = setup();
  const write = deferred<PartyCurrencyMap>(); io.patchCurrency.mockReturnValue(write.promise);
  const pending = sync.saveCurrency({ GP: 42 }); sync.dispose();
  write.resolve({ PP: 0, GP: 42, SP: 0, CP: 0 });
  expect(await pending).toBe(false);
  expect(io.setCurrency).not.toHaveBeenCalled();
  expect(io.currency).not.toHaveBeenCalled();
});
