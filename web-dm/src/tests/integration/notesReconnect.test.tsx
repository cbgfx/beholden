// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferred } from "@beholden/shared/tests/renderHook";
import "@/i18n";
const h = vi.hoisted(() => ({ bootstrap: vi.fn(), detail: vi.fn(), api: vi.fn(), handlers: new Set<(m: { type: string }) => void>() }));
vi.mock("@/services/api", () => ({ api: h.api, apiCoalesced: h.api, jsonInit: (method: string, body: unknown) => ({ method, body }) }));
vi.mock("@/services/campaignBootstrapApi", () => ({ fetchCampaignBootstrap: h.bootstrap }));
vi.mock("@/services/collectionApi", async importOriginal => ({ ...await importOriginal<object>(), fetchNoteById: h.detail }));
vi.mock("@/services/ws", () => ({ useWs: (handler: (m: { type: string }) => void) => {
  useEffect(() => { h.handlers.add(handler); return () => { h.handlers.delete(handler); }; }, [handler]);
} }));
// Layout and metrics are outside this regression; the note panel and editor remain real.
vi.mock("@/layout/workspace/DmWorkspace", () => ({ DmWorkspace: ({ panels }: { panels: Array<{ id: string; content: React.ReactNode }> }) => <>{panels.filter(p => p.id === "campaign-notes").map(p => <div key={p.id}>{p.content}</div>)}</> }));
vi.mock("@/views/CampaignView/hooks/useOpenEncounterMetrics", () => ({ useOpenEncounterMetrics: () => ({ encountersForPanel: [] }) }));
import { StoreProvider, useStore } from "@/store";
import { useCampaignDataRefresh } from "@/app/useCampaignDataRefresh";
import { useAppWebSocket } from "@/app/useAppWebSocket";
import { CampaignView } from "@/views/CampaignView/CampaignView";
import { NoteDrawer } from "@/drawers/drawers/NoteDrawer";
import type { Note } from "@/domain/types/domain";
const note = (text = "Saved body", updatedAt = 10): Note => ({ id: "n1", scope: "campaign", scopeId: "c1", title: "Table notes", titleIsDerived: false, text, order: 0, updatedAt, bodyLoaded: true });
const noop = () => {};
const callbacks = { onCreateAdventure: noop, onCreateEncounter: noop, onEditAdventure: noop, onDeleteAdventure: noop, onEditEncounter: noop, onDuplicateEncounter: noop, onDeleteEncounter: noop, onAddCampaignNote: noop, onAddAdventureNote: noop, onEditCampaignNote: noop, onDeleteCampaignNote: noop, onEditAdventureNote: noop, onDeleteAdventureNote: noop, onFullRest: noop, onCreatePlayer: noop, onEditPlayer: noop, onDeletePlayer: noop, onAddPlayerToEncounter: noop, onAddINpcFromMonster: noop, onEditINpc: noop, onDeleteINpc: noop, onAddINpcToEncounter: noop, onReorderAdventures: noop, onReorderEncounters: noop, onExportAdventure: noop, onImportAdventure: noop, onReorderCampaignNotes: noop, onReorderAdventureNotes: noop };
let store: ReturnType<typeof useStore>;
function Editor() {
  const { state } = useStore();
  const drawer = NoteDrawer({ drawer: state.drawer as never, close: noop, refreshCampaign: async () => {}, refreshAdventure: async () => {} });
  return <>{drawer.body}{drawer.footer}</>;
}
function Screen() {
  store = useStore(); const { state, dispatch } = store;
  const refresh = useCampaignDataRefresh(dispatch);
  useAppWebSocket({ selectedCampaignId: state.selectedCampaignId, selectedAdventureId: null, selectedEncounterId: null, viewedEncounterId: null, dispatch, refreshAll: async () => {}, ...refresh });
  useEffect(() => { dispatch({ type: "selectCampaign", campaignId: "c1" }); dispatch({ type: "setCampaignNotes", notes: [note()] }); }, [dispatch]);
  return <><CampaignView {...callbacks} onEditCampaignNote={noteId => dispatch({ type: "openDrawer", drawer: { type: "editNote", noteId } })} />{state.drawer && <Editor />}</>;
}
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  vi.useFakeTimers(); h.handlers.clear(); localStorage.clear();
  h.bootstrap.mockReset(); h.detail.mockReset().mockResolvedValue(note()); h.api.mockReset().mockResolvedValue([]);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
async function reconnect() { await act(async () => { for (const handler of h.handlers) handler({ type: "ws:reconnected" }); await vi.advanceTimersByTimeAsync(250); }); }
const bootstrap = (notes: Note[]) => ({ adventures: [], players: [], inpcs: [], notes, treasure: [] });
async function openDraft() {
  await act(async () => root.render(<MemoryRouter><StoreProvider><Screen /></StoreProvider></MemoryRouter>));
  await act(async () => { [...host.querySelectorAll("button")].find(b => b.textContent === "Table notes")!.click(); });
  expect(host.textContent).toContain("Saved body");
  await act(async () => host.querySelector<HTMLButtonElement>('button[title="Edit"]')!.click());
  const input = host.querySelector<HTMLInputElement>("input")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Unsaved title"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  const editor = host.querySelector<HTMLElement>('[contenteditable="true"]')!;
  await act(async () => { editor.innerHTML = "<p>Unsaved body</p>"; editor.dispatchEvent(new Event("input", { bubbles: true })); });
  return input;
}
it.each([10, 11])("keeps note expansion and editor draft during reconnect at revision %s", async revision => {
  const input = await openDraft();
  h.bootstrap.mockResolvedValue(bootstrap([{ ...note("", revision), bodyLoaded: false }]));
  h.detail.mockResolvedValue(note("Remote body", revision)); await reconnect();
  expect(host.querySelector(".noteInteractiveRow--expanded")?.textContent).toContain(revision === 10 ? "Saved body" : "Remote body");
  expect(store.state.expandedNoteIds).toContain("n1"); expect(host.querySelector("input")).toBe(input); expect(input.value).toBe("Unsaved title"); expect(host.querySelector('[contenteditable="true"]')?.textContent).toBe("Unsaved body");
});
it("preserves the note and draft after a failed refresh, then recovers", async () => {
  const input = await openDraft(); h.bootstrap.mockRejectedValueOnce(new Error("offline")); await reconnect();
  expect(host.textContent).toContain("Saved body"); expect(host.querySelector("input")).toBe(input);
  h.bootstrap.mockResolvedValueOnce(bootstrap([{ ...note("", 11), bodyLoaded: false }])); h.detail.mockResolvedValueOnce(note("Recovered body", 11)); await reconnect();
  expect(host.querySelector(".noteInteractiveRow--expanded")?.textContent).toContain("Recovered body"); expect(input.value).toBe("Unsaved title"); expect(host.querySelector('[contenteditable="true"]')?.textContent).toBe("Unsaved body");
});
it("does not apply a pending campaign refresh after leaving the screen", async () => {
  await openDraft(); const pending = deferred<ReturnType<typeof bootstrap>>(); h.bootstrap.mockReturnValue(pending.promise); await reconnect();
  await act(async () => root.render(<div>Another campaign</div>));
  await act(async () => pending.resolve(bootstrap([note("Late body")])));
  expect(host.textContent).toBe("Another campaign");
});
