import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as Array<() => unknown>, fetch: vi.fn() }));
vi.mock("react", () => ({ default: {
  useState(initial: unknown) {
    const i = h.cursor++; h.slots[i] = initial;
    return [initial, (value: unknown) => { h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value; }];
  },
  useRef: (current: unknown) => ({ current }),
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => unknown) => { h.effects.push(effect); },
} }));
vi.mock("@/services/actorApi", () => ({ fetchMyCharacter: h.fetch }));
import { useCharacterSnapshot } from "./useCharacterSnapshot";
import type { Character } from "../CharacterViewHelpers";
const character = (name: string) => ({ id: "hero", name } as Character);
function deferred() {
  let resolve!: (value: Character) => void;
  const promise = new Promise<Character>((yes) => { resolve = yes; });
  return { resolve, promise };
}
beforeEach(() => { h.slots = []; h.cursor = 0; h.effects = []; h.fetch.mockReset(); });

it("ignores an older response after a newer refresh", async () => {
  const first = deferred(); h.fetch.mockReturnValueOnce(first.promise).mockResolvedValueOnce(character("new"));
  const { fetchChar } = useCharacterSnapshot("hero");
  const pending = fetchChar(); await fetchChar(); first.resolve(character("old")); await pending;
  expect(h.slots[0]).toEqual(character("new"));
});
it("does not overwrite a local save with an earlier snapshot", async () => {
  const first = deferred(); h.fetch.mockReturnValue(first.promise);
  const { fetchChar, setChar } = useCharacterSnapshot("hero");
  const pending = fetchChar(); setChar(character("saved")); first.resolve(character("old")); await pending;
  expect(h.slots[0]).toEqual(character("saved"));
});
it("a no-op state updater does not retire the initial request", async () => {
  h.fetch.mockResolvedValue(character("loaded"));
  const { fetchChar, setChar } = useCharacterSnapshot("hero");
  const pending = fetchChar(); setChar((previous) => previous); await pending;
  expect(h.slots[0]).toEqual(character("loaded")); expect(h.slots[1]).toBe(false);
});
it("clears an earlier load error after successful recovery", async () => {
  h.fetch.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(character("loaded"));
  const { fetchChar } = useCharacterSnapshot("hero");
  await fetchChar(); expect(h.slots[2]).toBe("offline");
  await fetchChar(); expect(h.slots[2]).toBeNull();
});
it("ignores responses after unmount", async () => {
  h.fetch.mockResolvedValue(character("old"));
  const { fetchChar } = useCharacterSnapshot("hero");
  const cleanup = h.effects[0]() as () => void;
  const pending = fetchChar(); cleanup(); await pending;
  expect(h.slots[0]).toBeNull();
});

it("propagates a read failure to an explicit recovery reload", async () => {
  h.fetch.mockRejectedValueOnce(new Error("offline"));
  const { reloadChar } = useCharacterSnapshot("hero");
  await expect(reloadChar()).rejects.toThrow("offline");
  expect(h.slots[2]).toBe("offline");
});

it("a reload superseded by a newer refresh neither overwrites state nor throws", async () => {
  const slow = deferred();
  h.fetch.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(character("fresh"));
  const { reloadChar, fetchChar } = useCharacterSnapshot("hero");
  const stale = reloadChar();
  await fetchChar();
  slow.resolve(character("stale"));
  await expect(stale).resolves.toBeUndefined();
  expect(h.slots[0]).toEqual(character("fresh"));
});

it("a superseded reload swallows its own read failure", async () => {
  let rejectSlow!: (cause: Error) => void;
  const slow = new Promise<Character>((_resolve, reject) => { rejectSlow = reject; });
  h.fetch.mockReturnValueOnce(slow).mockResolvedValueOnce(character("fresh"));
  const { reloadChar, fetchChar } = useCharacterSnapshot("hero");
  const stale = reloadChar();
  await fetchChar();
  rejectSlow(new Error("late offline"));
  await expect(stale).resolves.toBeUndefined();
  expect(h.slots[0]).toEqual(character("fresh"));
  expect(h.slots[2]).toBeNull();
});

it("keeps the newer of two recovery reloads resolved in reverse order", async () => {
  const a = deferred(); const b = deferred();
  h.fetch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const { reloadChar } = useCharacterSnapshot("hero");
  const first = reloadChar();
  const second = reloadChar();
  b.resolve(character("B")); await second;
  a.resolve(character("A")); await first;
  expect(h.slots[0]).toEqual(character("B"));
});
