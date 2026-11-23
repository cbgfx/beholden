// @vitest-environment jsdom
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { deferred, renderHook } from "@beholden/shared/tests/renderHook";
import { useChoicePreview } from "./useChoicePreview";
import { useItemChoiceDetails } from "./useItemChoiceDetails";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/services/api", () => ({ api: mocks.api }));
beforeEach(() => { mocks.api.mockReset(); });

it("keeps a filtered-out preview but resets it when an option is removed", async () => {
  const items = [{ id: "first" }, { id: "second" }];
  const hook = await renderHook(({ all, visible }: { all: typeof items; visible: typeof items }) => useChoicePreview(all, visible), { all: items, visible: items });
  await act(async () => hook.result.setActiveId("second"));
  await hook.rerender({ all: items, visible: [items[0]] });
  expect(hook.result.activeItem?.id).toBe("second");
  await hook.rerender({ all: [items[0]], visible: [items[0]] });
  expect(hook.result.activeItem?.id).toBe("first");
  await hook.rerender({ all: [], visible: [] });
  expect(hook.result.activeItem).toBeNull();
  await hook.rerender({ all: [items[1]], visible: [items[1]] });
  expect(hook.result.activeItem?.id).toBe("second");
});

it("loads descriptions in bounded batches and reuses them after filtering", async () => {
  mocks.api.mockImplementation(async (_url, options) => ({
    rows: (JSON.parse(options.body).ids as string[]).map((id) => ({ id, text: [id] })),
  }));
  const items = Array.from({ length: 50 }, (_, i) => ({ id: String(i) }));
  const hook = await renderHook((rows: typeof items) => useItemChoiceDetails(rows), items);
  expect(mocks.api.mock.calls.map(([, options]) => JSON.parse(options.body).ids.length)).toEqual([48, 2]);
  expect(hook.result["49"].text).toEqual(["49"]);
  await hook.rerender([items[0]]);
  await hook.rerender(items);
  expect(mocks.api).toHaveBeenCalledTimes(2);
});

it("ignores an old response after switching options and retains cached details on failure", async () => {
  const old = deferred<{ rows: Array<{ id: string; text: string[] }> }>();
  mocks.api.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ rows: [{ id: "new", text: ["Current"] }] });
  const hook = await renderHook((rows: Array<{ id: string }>) => useItemChoiceDetails(rows), [{ id: "old" }]);
  await hook.rerender([{ id: "new" }]);
  await act(async () => old.resolve({ rows: [{ id: "old", text: ["Stale"] }] }));
  expect(hook.result.old).toBeUndefined();
  expect(hook.result.new.text).toEqual(["Current"]);
  mocks.api.mockRejectedValueOnce(new Error("offline"));
  await hook.rerender([{ id: "missing" }]);
  expect(hook.result.new.text).toEqual(["Current"]);
});
