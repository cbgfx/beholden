// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferred } from "@beholden/shared/tests/renderHook";
const h = vi.hoisted(() => ({ fetch: vi.fn(), handlers: new Set<(m: { type: string }) => void>() }));
vi.mock("@/services/actorApi", () => ({ fetchMyCharacter: h.fetch }));
vi.mock("@/views/character/state/characterApi", () => ({ putMyCharacter: vi.fn() }));
vi.mock("@/services/ws", () => ({ useWs: (handler: (m: { type: string }) => void) => {
  useEffect(() => { h.handlers.add(handler); return () => { h.handlers.delete(handler); }; }, [handler]);
} }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (text: string) => text }));
import "@/i18n";
import { useCharacterSnapshot } from "./useCharacterSnapshot";
import { useCharacterSyncEffects } from "./useCharacterSyncEffects";
import { useCharacterViewUiState } from "../useCharacterViewUiState";
import { useCharacterViewNotes } from "../notes/useCharacterViewNotes";
import { PlayerNotesPanel } from "../notes/CharacterPlayerNotesPanel";
import { NoteEditDrawer } from "../notes/CharacterViewNoteDrawer";
import type { Character } from "../CharacterViewHelpers";
const character = (text: string) => ({ id: "hero", name: "Hero", campaigns: [], characterData: { playerNotesList: [{ id: "n1", title: "Table notes", text }] } } as unknown as Character);
function Sheet() {
  const { char, setChar, fetchChar, loading, error } = useCharacterSnapshot("hero");
  const ui = useCharacterViewUiState();
  useCharacterSyncEffects({ char, setChar, fetchChar, syncedAcValue: null, syncedHpMaxValue: null });
  const notes = useCharacterViewNotes({ char, setChar, currentCharacterData: char?.characterData ?? {}, ui });
  if (loading || error || !char) return <div>Unavailable</div>;
  return <>
    <PlayerNotesPanel accentColor="#abcdef" playerNotesList={notes.playerNotesList} expandedNoteIds={ui.expandedNoteIds}
      onOpenPlayerNoteCreate={() => ui.setNoteDrawer({ scope: "player", note: null })} onToggleNoteExpanded={notes.toggleNoteExpanded}
      onOpenPlayerNoteEdit={note => ui.setNoteDrawer({ scope: "player", note })} onDeletePlayerNote={() => {}} onSavePlayerNotesOrder={() => {}} />
    {ui.noteDrawer && <NoteEditDrawer {...ui.noteDrawer} accentColor="#abcdef" onSave={() => {}} onClose={() => ui.setNoteDrawer(null)} />}
  </>;
}
let host: HTMLDivElement; let root: Root;
beforeEach(() => { vi.useFakeTimers(); h.handlers.clear(); h.fetch.mockReset().mockResolvedValue(character("Saved body")); localStorage.clear(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
async function reconnect() { await act(async () => { for (const handler of h.handlers) handler({ type: "ws:reconnected" }); await vi.advanceTimersByTimeAsync(80); }); }
async function openDraft() {
  await act(async () => root.render(<Sheet />));
  await act(async () => { [...host.querySelectorAll("button")].find(b => b.textContent?.includes("Table notes"))!.click(); });
  expect(host.textContent).toContain("Saved body");
  await act(async () => { host.querySelector<HTMLButtonElement>('button[title="Edit"]')!.click(); });
  const input = host.querySelector<HTMLInputElement>('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Unsaved title"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  const editor = host.querySelector<HTMLElement>('[contenteditable="true"]')!;
  await act(async () => { editor.innerHTML = "<p>Unsaved body</p>"; editor.dispatchEvent(new Event("input", { bubbles: true })); });
  return input;
}
it.each(["Saved body", "Remote body"])("keeps an expanded note and unsaved editor through reconnect (%s)", async text => {
  const input = await openDraft();
  h.fetch.mockResolvedValueOnce(character(text)); await reconnect();
  expect(host.querySelector(".noteInteractiveRow--expanded")?.textContent).toContain(text);
  expect(host.querySelector('input')).toBe(input); expect(input.value).toBe("Unsaved title"); expect(host.querySelector('[contenteditable="true"]')?.textContent).toBe("Unsaved body");
});
it("keeps the draft on background failure and recovers on the next reconnect", async () => {
  const input = await openDraft(); h.fetch.mockRejectedValueOnce(new Error("offline")); await reconnect();
  expect(host.textContent).toContain("Saved body"); expect(host.querySelector('input')).toBe(input);
  h.fetch.mockResolvedValueOnce(character("Recovered body")); await reconnect();
  expect(host.querySelector(".noteInteractiveRow--expanded")?.textContent).toContain("Recovered body"); expect(input.value).toBe("Unsaved title"); expect(host.querySelector('[contenteditable="true"]')?.textContent).toBe("Unsaved body");
});
it("does not reload the character on hello or disconnect", async () => {
  await act(async () => root.render(<Sheet />)); h.fetch.mockClear();
  await act(async () => { for (const handler of h.handlers) { handler({ type: "hello" }); handler({ type: "ws:disconnected" }); } await vi.advanceTimersByTimeAsync(200); });
  expect(h.fetch).not.toHaveBeenCalled();
});
it("retires a reconnect read when the sheet unmounts", async () => {
  await openDraft(); const pending = deferred<Character>(); h.fetch.mockReturnValueOnce(pending.promise); await reconnect();
  await act(async () => root.render(<div>Another screen</div>));
  await act(async () => pending.resolve(character("Late body")));
  expect(host.textContent).toBe("Another screen");
});
