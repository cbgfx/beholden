// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), put: vi.fn() }));
vi.mock("@/services/actorApi", () => ({ fetchMyCharacter: mocks.fetch }));
vi.mock("@/views/character/state/characterApi", () => ({ putMyCharacter: mocks.put }));
vi.mock("@/services/ws", () => ({ useWs: () => {} }));
import { useCharacterSnapshot } from "./useCharacterSnapshot";
import { useCharacterSyncEffects } from "./useCharacterSyncEffects";
import type { Character } from "../CharacterViewHelpers";
let root: Root;
let host: HTMLDivElement;
let snapshot: ReturnType<typeof useCharacterSnapshot>;
const char = (name: string) => ({ id: "hero", name, campaigns: [] } as unknown as Character);
function Snapshot() { snapshot = useCharacterSnapshot("hero"); return <div>{snapshot.char?.name}</div>; }
const setChar = vi.fn(); const fetchChar = vi.fn();
function Stats({ hp }: { hp: number }) {
  useCharacterSyncEffects({ char: char("Hero"), setChar, fetchChar, syncedAcValue: 12, syncedHpMaxValue: hp }); return null;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.fetch.mockReset(); mocks.put.mockReset().mockResolvedValue({});
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("StrictMode effect replay leaves derived-stat synchronization active", async () => {
  await act(async () => root.render(<StrictMode><Stats hp={10} /></StrictMode>));
  await act(async () => root.render(<StrictMode><Stats hp={12} /></StrictMode>));
  expect(mocks.put).toHaveBeenLastCalledWith("hero", expect.objectContaining({ syncedHpMax: 12 }));
});

it("batched local snapshot updates retire an old fetch without impure state updaters", async () => {
  mocks.fetch.mockResolvedValue(char("loaded"));
  await act(async () => root.render(<StrictMode><Snapshot /></StrictMode>));
  let resolve!: (value: Character) => void;
  mocks.fetch.mockReturnValue(new Promise<Character>(done => { resolve = done; }));
  let pending!: Promise<void>;
  await act(async () => {
    pending = snapshot.fetchChar();
    snapshot.setChar(previous => previous ? { ...previous, name: "first" } : previous);
    snapshot.setChar(previous => previous ? { ...previous, name: previous.name + " second" } : previous);
  });
  await act(async () => { resolve(char("old response")); await pending; });
  expect(host.textContent).toBe("first second");
});
