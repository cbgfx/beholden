// @vitest-environment jsdom
import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n, loadLanguage } from "@/i18n";
import { applyLanguage } from "@beholden/shared/i18n/config";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), api: vi.fn() }));
vi.mock("@/services/ws", () => ({ useWs: () => {} }));
vi.mock("@/services/encounterApi", () => ({ fetchEncounterCombatState: mocks.get, putEncounterCombatState: mocks.put }));
vi.mock("@/services/api", () => ({ api: mocks.api, jsonInit: (method: string, body: unknown) => ({ method, body }) }));
import { useServerCombatState } from "@/views/CombatView/hooks/useServerCombatState";
import { CommittedTextArea } from "../../tools/bastions/CommittedFields";
let root: Root;
let host: HTMLDivElement;
let combat: ReturnType<typeof useServerCombatState>;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function CombatState({ id }: { id: string }) { combat = useServerCombatState(id); return <div>{combat.round}:{combat.error}</div>; }
function Combat({ id }: { id: string }) { return <I18nextProvider i18n={i18n}><CombatState id={id} /></I18nextProvider>; }

/**
 * The Bastion modal's notes field, as the modal mounts it: keyed per bastion, committing to the
 * bastion it was rendered for. `commit` records which bastion each save went to.
 */
const commit = vi.fn(async (_bastionId: string, _notes: string) => true);
function BastionNotes({ open = true, selected = "a" }: { open?: boolean; selected?: string }) {
  if (!open) return null;
  return <CommittedTextArea key={`${selected}:notes`} value="old" onCommit={(notes) => commit(selected, notes)} />;
}
const typeNotes = (text: string) => act(async () => {
  const field = host.querySelector("textarea")!;
  // React tracks the input's value itself, so set it through the native setter before dispatching.
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, text);
  field.dispatchEvent(new Event("input", { bubbles: true }));
});

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  mocks.get.mockReset(); mocks.put.mockReset().mockResolvedValue(undefined); mocks.api.mockReset().mockResolvedValue({});
  commit.mockClear();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("retires an old encounter read after navigation with real React effects", async () => {
  const old = deferred<{ round: number; activeCombatantId: string | null }>();
  mocks.get.mockReturnValueOnce(old.promise).mockResolvedValue({ round: 7, activeCombatantId: "b" });
  await act(async () => root.render(<Combat id="a" />));
  await act(async () => root.render(<Combat id="b" />));
  await act(async () => old.resolve({ round: 2, activeCombatantId: "a" }));
  expect(combat.round).toBe(7); expect(combat.activeId).toBe("b"); expect(combat.loaded).toBe(true);
});

it("changes language without fetching or writing combat state again", async () => {
  mocks.get.mockResolvedValue({ round: 3, activeCombatantId: "hero" });
  await act(async () => root.render(<Combat id="encounter" />));
  expect(mocks.get).toHaveBeenCalledOnce();
  await act(async () => applyLanguage(i18n, loadLanguage, "fr"));
  expect(combat.round).toBe(3);
  expect(mocks.get).toHaveBeenCalledOnce();
  expect(mocks.put).not.toHaveBeenCalled();
  await act(async () => applyLanguage(i18n, loadLanguage, "en"));
});

it("keeps newer reads and local writes ahead of older refresh responses", async () => {
  mocks.get.mockResolvedValue({ round: 1, activeCombatantId: null });
  await act(async () => root.render(<Combat id="a" />));
  const old = deferred<{ round: number; activeCombatantId: string | null }>();
  mocks.get.mockReturnValueOnce(old.promise).mockResolvedValue({ round: 4, activeCombatantId: "new" });
  let pending!: Promise<void>;
  await act(async () => { pending = combat.refresh(); await combat.persist({ round: 4, activeId: "new" }); });
  await act(async () => { old.resolve({ round: 1, activeCombatantId: null }); await pending; });
  expect(combat.round).toBe(4);
});

it("contains failed background reads and exposes a retryable error", async () => {
  mocks.get.mockRejectedValue(new Error("offline"));
  await act(async () => root.render(<Combat id="a" />));
  expect(host.textContent).toContain("offline");
  mocks.get.mockResolvedValue({ round: 3, activeCombatantId: null });
  await act(async () => combat.refresh());
  expect(combat.error).toBeNull(); expect(combat.round).toBe(3);
});

it("ignores a completed write for the encounter that was left", async () => {
  mocks.get.mockResolvedValue({ round: 1, activeCombatantId: null });
  await act(async () => root.render(<Combat id="a" />));
  const write = deferred<void>(); mocks.put.mockReturnValueOnce(write.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = combat.persist({ round: 9, activeId: "a" }); });
  mocks.get.mockResolvedValue({ round: 3, activeCombatantId: "b" });
  await act(async () => root.render(<Combat id="b" />));
  await act(async () => { write.resolve(); await pending; });
  expect(combat.round).toBe(3); expect(combat.activeId).toBe("b");
});

it("preserves write failure feedback after reconciling an optimistic turn", async () => {
  mocks.get.mockResolvedValue({ round: 1, activeCombatantId: null });
  mocks.put.mockRejectedValue(new Error("save rejected"));
  await act(async () => root.render(<Combat id="a" />));
  await act(async () => { combat.setRound(5); await combat.persist({ round: 5, activeId: "a" }).catch(() => {}); });
  expect(combat.round).toBe(1); expect(combat.error).toBe("save rejected");
});

it("saves a Bastion notes edit when the modal closes before typing pauses", async () => {
  vi.useFakeTimers();
  await act(async () => root.render(<BastionNotes />));
  await typeNotes("new");
  expect(commit).not.toHaveBeenCalled();
  await act(async () => root.render(<BastionNotes open={false} />));
  expect(commit).toHaveBeenCalledWith("a", "new");
});

it("saves the departing Bastion's notes to that Bastion when switching to another", async () => {
  vi.useFakeTimers();
  await act(async () => root.render(<BastionNotes />));
  await typeNotes("draft a");
  await act(async () => root.render(<BastionNotes selected="b" />));
  await typeNotes("draft b");
  await act(async () => root.render(<BastionNotes open={false} />));
  expect(commit.mock.calls).toEqual([["a", "draft a"], ["b", "draft b"]]);
});
