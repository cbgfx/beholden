// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@beholden/shared/api/browserClient", () => ({
  api: harness.api, jsonInit: (method: string, body: unknown) => ({ method, body: JSON.stringify(body) }),
}));
import { act } from "react";
import { renderHook } from "@beholden/shared/tests/renderHook";
import { useProfileSave } from "@beholden/shared/ui/useProfileSave";

beforeEach(() => { harness.api.mockReset(); });

it("serializes separate account forms before any rerender", async () => {
  let resolve!: (value: unknown) => void;
  harness.api.mockReturnValue(new Promise((yes) => { resolve = yes; }));
  const onSaved = vi.fn();
  const hook = await renderHook(() => useProfileSave(onSaved));
  const save = (...args: Parameters<typeof hook.result.save>) => act(async () => hook.result.save(...args));
  let first!: Promise<boolean>;
  act(() => { first = hook.result.save({ name: "New name" }); });
  expect(await save({ textScale: 1.2 })).toBe(false);
  expect(harness.api).toHaveBeenCalledTimes(1);
  resolve({ user: { name: "New name" }, csrfToken: "updated" });
  await act(async () => { expect(await first).toBe(true); });
  expect(onSaved).toHaveBeenCalledExactlyOnceWith({ name: "New name" }, "updated");
});

it("does not restore an account from a save completed after the profile closes", async () => {
  let resolve!: (value: unknown) => void;
  harness.api.mockReturnValue(new Promise((yes) => { resolve = yes; }));
  const onSaved = vi.fn();
  const hook = await renderHook(() => useProfileSave(onSaved));
  let pending!: Promise<boolean>;
  act(() => { pending = hook.result.save({ name: "Old account" }); });
  await hook.unmount();
  expect(harness.api.mock.calls[0][1].signal.aborted).toBe(true);
  resolve({ user: { name: "Old account" }, token: "old" });
  expect(await pending).toBe(false);
  expect(onSaved).not.toHaveBeenCalled();
});

it("surfaces save failures and allows a later retry", async () => {
  harness.api.mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ user: {}, token: "new" });
  const onSaved = vi.fn();
  const hook = await renderHook(() => useProfileSave(onSaved));
  const save = (...args: Parameters<typeof hook.result.save>) => act(async () => hook.result.save(...args));
  await expect(save({ textScale: 1.1 })).rejects.toThrow("offline");
  expect(await save({ textScale: 1.1 })).toBe(true);
});
