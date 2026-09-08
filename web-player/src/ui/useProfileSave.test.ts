import { beforeEach, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({ api: vi.fn(), cleanup: undefined as (() => void) | undefined }));
vi.mock("@beholden/shared/api/browserClient", () => ({
  api: harness.api, jsonInit: (method: string, body: unknown) => ({ method, body: JSON.stringify(body) }),
}));
vi.mock("react", () => ({ default: {
  useState: (value: unknown) => [value, vi.fn()],
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => () => void) => { harness.cleanup = effect(); },
  useCallback: (fn: unknown) => fn,
} }));
import { useProfileSave } from "@beholden/shared/ui/useProfileSave";

beforeEach(() => { harness.api.mockReset(); harness.cleanup = undefined; });

it("serializes separate account forms before any rerender", async () => {
  let resolve!: (value: unknown) => void;
  harness.api.mockReturnValue(new Promise((yes) => { resolve = yes; }));
  const onSaved = vi.fn();
  const { save } = useProfileSave(onSaved);
  const first = save({ name: "New name" });
  expect(await save({ textScale: 1.2 })).toBe(false);
  expect(harness.api).toHaveBeenCalledTimes(1);
  resolve({ user: { name: "New name" }, token: "updated" });
  expect(await first).toBe(true);
  expect(onSaved).toHaveBeenCalledExactlyOnceWith({ name: "New name" }, "updated");
});

it("does not restore an account from a save completed after the profile closes", async () => {
  let resolve!: (value: unknown) => void;
  harness.api.mockReturnValue(new Promise((yes) => { resolve = yes; }));
  const onSaved = vi.fn();
  const { save } = useProfileSave(onSaved);
  const pending = save({ name: "Old account" });
  harness.cleanup!();
  expect(harness.api.mock.calls[0][1].signal.aborted).toBe(true);
  resolve({ user: { name: "Old account" }, token: "old" });
  expect(await pending).toBe(false);
  expect(onSaved).not.toHaveBeenCalled();
});

it("surfaces save failures and allows a later retry", async () => {
  harness.api.mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ user: {}, token: "new" });
  const { save } = useProfileSave(vi.fn());
  await expect(save({ textScale: 1.1 })).rejects.toThrow("offline");
  expect(await save({ textScale: 1.1 })).toBe(true);
});
