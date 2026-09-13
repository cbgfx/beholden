import { afterEach, expect, it, vi } from "vitest";
import { createDraftSaver } from "./draftSaver";
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
afterEach(() => vi.useRealTimers());

it("preserves multiple resource drafts and submits the newest draft after an in-flight write", async () => {
  vi.useFakeTimers();
  const first = deferred();
  const put = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
  const saver = createDraftSaver<{ id: string; notes: string }>({ put, signature: JSON.stringify, status: vi.fn() });
  saver.accept("campaign", { id: "a", notes: "saved" });
  saver.edit("campaign", { id: "a", notes: "first" }); saver.flush();
  const version = saver.version();
  saver.edit("campaign", { id: "a", notes: "newest" });
  saver.edit("campaign", { id: "b", notes: "other" });
  saver.flush();
  expect(saver.accept("campaign", { id: "a", notes: "first" })).toMatchObject({ notes: "newest" });
  first.resolve(); await vi.runAllTimersAsync();
  expect(put.mock.calls.map(call => call[1])).toEqual([{ id: "a", notes: "first" }, { id: "b", notes: "other" }, { id: "a", notes: "newest" }]);
  expect(saver.accept("campaign", { id: "a", notes: "first" }, version).notes).toBe("newest");
});

it("keeps failed drafts across reloads and retries only on request", async () => {
  vi.useFakeTimers();
  const put = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const status = vi.fn();
  const saver = createDraftSaver<{ id: string; notes: string }>({ put, signature: JSON.stringify, status });
  saver.accept("c", { id: "a", notes: "old" }); saver.edit("c", { id: "a", notes: "draft" });
  await vi.runAllTimersAsync();
  expect(put).toHaveBeenCalledTimes(1);
  expect(status).toHaveBeenLastCalledWith(false, "offline");
  expect(saver.merge("c", [{ id: "a", notes: "old" }])[0]?.notes).toBe("draft");
  saver.flush(); await vi.runAllTimersAsync();
  expect(put).toHaveBeenCalledTimes(1);
  saver.retry(); await vi.runAllTimersAsync();
  expect(put).toHaveBeenCalledTimes(2);
  expect(status).toHaveBeenLastCalledWith(false, null);
});

it("pauses a dirty draft on an external conflict and retains a visible retry message after reload", async () => {
  vi.useFakeTimers();
  const put = vi.fn().mockResolvedValue(undefined);
  const status = vi.fn();
  const saver = createDraftSaver<{ id: string; notes: string }>({ put, signature: JSON.stringify, status });
  saver.accept("c", { id: "a", notes: "old" }); saver.edit("c", { id: "a", notes: "mine" });
  expect(saver.merge("c", [{ id: "a", notes: "theirs" }])[0]?.notes).toBe("mine");
  await vi.runAllTimersAsync();
  expect(put).not.toHaveBeenCalled();
  expect(status).toHaveBeenLastCalledWith(false, expect.stringContaining("changed elsewhere"));
  saver.edit("c", { id: "a", notes: "mine revised" });
  saver.flush(); await vi.runAllTimersAsync();
  expect(put).not.toHaveBeenCalled();
  saver.retry(); await vi.runAllTimersAsync();
  expect(put).toHaveBeenCalledWith("c", { id: "a", notes: "mine revised" });
});
