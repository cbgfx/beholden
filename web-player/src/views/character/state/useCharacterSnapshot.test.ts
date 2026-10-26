// @vitest-environment jsdom
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
const h = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/services/actorApi", () => ({ fetchMyCharacter: h.fetch }));
import { useCharacterSnapshot } from "./useCharacterSnapshot";
import type { Character } from "../CharacterViewHelpers";
const character = (name: string) => ({ id: "hero", name } as Character);
beforeEach(() => { h.fetch.mockReset(); });

it("ignores an older response after a newer refresh", async () => {
  const first = deferred<Character>();
  h.fetch.mockReturnValueOnce(first.promise).mockResolvedValueOnce(character("new"));
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  await act(async () => { await hook.result.fetchChar(); first.resolve(character("old")); });
  expect(hook.result.char).toEqual(character("new"));
});
it("does not overwrite a local save with an earlier snapshot", async () => {
  const first = deferred<Character>(); h.fetch.mockReturnValue(first.promise);
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  await act(async () => { hook.result.setChar(character("saved")); first.resolve(character("old")); });
  expect(hook.result.char).toEqual(character("saved"));
});
it("a no-op state updater does not retire the initial request", async () => {
  const first = deferred<Character>(); h.fetch.mockReturnValue(first.promise);
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  await act(async () => { hook.result.setChar(previous => previous); first.resolve(character("loaded")); });
  expect(hook.result.char).toEqual(character("loaded")); expect(hook.result.loading).toBe(false);
});
it("clears an earlier load error after successful recovery", async () => {
  h.fetch.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(character("loaded"));
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  expect(hook.result.error).toBe("offline");
  await act(async () => { await hook.result.fetchChar(); });
  expect(hook.result.error).toBeNull();
});
it("ignores responses after unmount", async () => {
  const first = deferred<Character>(); h.fetch.mockReturnValue(first.promise);
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  await hook.unmount();
  await act(async () => { first.resolve(character("old")); });
  expect(hook.result.char).toBeNull();
});
it("propagates a read failure to an explicit recovery reload", async () => {
  h.fetch.mockResolvedValueOnce(character("loaded")).mockRejectedValueOnce(new Error("offline"));
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  await act(async () => { await expect(hook.result.reloadChar()).rejects.toThrow("offline"); });
  expect(hook.result.error).toBe("offline");
});
it("a reload superseded by a newer refresh neither overwrites state nor throws", async () => {
  const slow = deferred<Character>();
  h.fetch.mockResolvedValueOnce(character("loaded")).mockReturnValueOnce(slow.promise).mockResolvedValueOnce(character("fresh"));
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  await act(async () => {
    const stale = hook.result.reloadChar(); await hook.result.fetchChar();
    slow.resolve(character("stale")); await expect(stale).resolves.toBeUndefined();
  });
  expect(hook.result.char).toEqual(character("fresh"));
});
it("a superseded reload swallows its own read failure", async () => {
  const slow = deferred<Character>();
  h.fetch.mockResolvedValueOnce(character("loaded")).mockReturnValueOnce(slow.promise).mockResolvedValueOnce(character("fresh"));
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  await act(async () => {
    const stale = hook.result.reloadChar(); await hook.result.fetchChar();
    slow.reject(new Error("late offline")); await expect(stale).resolves.toBeUndefined();
  });
  expect(hook.result.char).toEqual(character("fresh")); expect(hook.result.error).toBeNull();
});
it("keeps the newer of two recovery reloads resolved in reverse order", async () => {
  const a = deferred<Character>(); const b = deferred<Character>();
  h.fetch.mockResolvedValueOnce(character("loaded")).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  await act(async () => {
    const first = hook.result.reloadChar(); const second = hook.result.reloadChar();
    b.resolve(character("B")); await second; a.resolve(character("A")); await first;
  });
  expect(hook.result.char).toEqual(character("B"));
});
it("keeps loaded note bodies visible while a background refresh is pending or fails", async () => {
  const refresh = deferred<Character>();
  const loaded = { ...character("loaded"), sharedNotes: '[{"id":"n1","text":"Shared body"}]', campaignSharedNotes: '[{"id":"n2","text":"Campaign body"}]', characterData: { playerNotesList: [{ id: "n3", text: "Private body" }] } } as Character;
  h.fetch.mockResolvedValueOnce(loaded).mockReturnValueOnce(refresh.promise);
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  let pending!: Promise<void>;
  await act(async () => { pending = hook.result.fetchChar(); });
  expect(hook.result.char).toBe(loaded); expect(hook.result.loading).toBe(false);
  await act(async () => { refresh.reject(new Error("temporarily offline")); await pending; });
  expect(hook.result.char).toBe(loaded); expect(hook.result.error).toBeNull();
});
it("refreshes note bodies without clearing the loaded sheet", async () => {
  const loaded = { ...character("loaded"), sharedNotes: '[{"id":"n1","text":"Old body"}]' } as Character;
  const refreshed = { ...loaded, sharedNotes: '[{"id":"n1","text":"Updated body"}]' };
  const refresh = deferred<Character>();
  h.fetch.mockResolvedValueOnce(loaded).mockReturnValueOnce(refresh.promise);
  const hook = await renderHook(() => useCharacterSnapshot("hero"));
  let pending!: Promise<void>;
  await act(async () => { pending = hook.result.fetchChar(); });
  expect(hook.result.char).toBe(loaded); expect(hook.result.loading).toBe(false);
  await act(async () => { refresh.resolve(refreshed); await pending; });
  expect(hook.result.char).toBe(refreshed); expect(hook.result.error).toBeNull();
});
it("retires an old character read when navigating to another character", async () => {
  const old = deferred<Character>();
  h.fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...character("Other"), id: "other" });
  const hook = await renderHook(useCharacterSnapshot, "hero");
  await hook.rerender("other");
  await act(async () => { old.resolve(character("Old")); });
  expect(hook.result.char?.id).toBe("other");
});
