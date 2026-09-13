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
import { useBastionAutosave } from "../../tools/bastions/useBastionAutosave";
import type { Bastion } from "../../tools/bastions/types";
let root: Root;
let host: HTMLDivElement;
let combat: ReturnType<typeof useServerCombatState>;
let autosave: ReturnType<typeof useBastionAutosave>;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function CombatState({ id }: { id: string }) { combat = useServerCombatState(id); return <div>{combat.round}:{combat.error}</div>; }
function Combat({ id }: { id: string }) { return <I18nextProvider i18n={i18n}><CombatState id={id} /></I18nextProvider>; }
const row = (id: string, notes = "old") => ({ id, name: id, notes, facilities: [], assignedPlayerIds: [], assignedCharacterIds: [] } as unknown as Bastion);
const setSaving = vi.fn(); const setMessage = vi.fn();
function Bastions({ campaign = "c", open = true, selected = "a" }: { campaign?: string; open?: boolean; selected?: string }) {
  autosave = useBastionAutosave({ campaignId: campaign, isOpen: open, selectedBastion: row(selected), setSaving, setMessage }); return null;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  mocks.get.mockReset(); mocks.put.mockReset().mockResolvedValue(undefined); mocks.api.mockReset().mockResolvedValue({});
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

it("flushes an edit when the mounted Bastion modal closes before debounce", async () => {
  vi.useFakeTimers();
  await act(async () => root.render(<Bastions />));
  autosave.registerLoadedBastions([row("a")]);
  await act(async () => { autosave.updateDraft(row("a", "new")); });
  await act(async () => root.render(<Bastions open={false} />));
  expect(mocks.api).toHaveBeenCalledWith("/api/campaigns/c/bastions/a", expect.objectContaining({ body: expect.objectContaining({ notes: "new" }) }));
});

it("flushes the departing Bastion and campaign without changing the destination of pending writes", async () => {
  vi.useFakeTimers();
  await act(async () => root.render(<Bastions />));
  autosave.registerLoadedBastions([row("a")]); autosave.updateDraft(row("a", "draft a"));
  await act(async () => root.render(<Bastions selected="b" />));
  autosave.registerLoadedBastions([row("b")]); autosave.updateDraft(row("b", "draft b"));
  await act(async () => root.render(<Bastions campaign="other" />));
  expect(mocks.api.mock.calls.map(call => call[0])).toEqual(["/api/campaigns/c/bastions/a", "/api/campaigns/c/bastions/b"]);
});

it("closing a conflicted Bastion does not bypass explicit retry", async () => {
  vi.useFakeTimers();
  await act(async () => root.render(<Bastions />));
  autosave.registerLoadedBastions([row("a")]);
  autosave.updateDraft(row("a", "mine"));
  autosave.acceptRemote(row("a", "theirs"));
  await act(async () => root.render(<Bastions open={false} />));
  expect(mocks.api).not.toHaveBeenCalled();
  await act(async () => autosave.retry());
  expect(mocks.api).toHaveBeenCalledWith("/api/campaigns/c/bastions/a", expect.objectContaining({ body: expect.objectContaining({ notes: "mine" }) }));
});
