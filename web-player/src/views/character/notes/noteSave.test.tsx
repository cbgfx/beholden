// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { deferred } from "@beholden/shared/tests/renderHook";
import "@/i18n";
const h = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/services/actorApi", () => ({ updateMyCharacter: h.save }));
vi.mock("@/views/character/state/characterApi", () => ({ upsertMySharedNote: h.save, deleteMySharedNote: vi.fn(), reorderMySharedNotes: vi.fn(), patchMyCharacter: vi.fn() }));
import { useCharacterActions } from "../state/useCharacterActions";
import { NoteEditDrawer } from "./CharacterViewNoteDrawer";
import type { Character } from "../CharacterViewHelpers";
import type { PlayerNote } from "../CharacterSheetTypes";
const note = { id: "n1", title: "Saved title", text: "Saved body" };
function Harness({ kind, fresh = false }: { kind: "player" | "shared" | "campaign"; fresh?: boolean }) {
  const [char, setChar] = useState<Character | null>({ id: "hero", name: "Hero", sharedNotes: JSON.stringify([note]), campaignSharedNotes: JSON.stringify([note]), characterData: { playerNotesList: [note] } } as Character);
  const [drawer, setDrawer] = useState<{ scope: "player" | "shared"; note: PlayerNote | null } | null>({ scope: kind === "player" ? "player" : "shared", note: fresh ? null : note });
  const actions = useCharacterActions({ char, setChar, playerNotesList: [note], allSharedNotes: [note], campaignNotesList: kind === "campaign" ? [note] : [], noteDrawer: drawer, setNoteDrawer: setDrawer, setExpandedNoteIds: vi.fn(), overridesDraft: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 }, abilityOverridesDraft: {}, colorDraft: "#abcdef", setInfoDrawerOpen: vi.fn(), setOverridesSaving: vi.fn() });
  return drawer ? <NoteEditDrawer {...drawer} accentColor="#abcdef" onSave={actions.handleNoteSave} onClose={() => setDrawer(null)} /> : <div>Saved successfully</div>;
}
let root: Root; let host: HTMLDivElement;
beforeEach(() => { h.save.mockReset(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function typeDraft() {
  const title = host.querySelector<HTMLInputElement>("input")!;
  const editor = host.querySelector<HTMLElement>('[contenteditable="true"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Unsaved title"); title.dispatchEvent(new Event("input", { bubbles: true }));
    editor.innerHTML = "<p>Unsaved body</p>"; editor.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return { title, editor };
}
it.each(["player", "shared", "campaign"] as const)("keeps %s note drafts on failed save, rejects duplicate clicks and retries", async kind => {
  h.save.mockRejectedValueOnce(new Error("temporarily offline"));
  await act(async () => root.render(<Harness kind={kind} />));
  const { title, editor } = await typeDraft();
  const button = [...host.querySelectorAll("button")].find(b => b.textContent === "Save")!;
  await act(async () => { button.click(); button.click(); });
  expect(h.save).toHaveBeenCalledTimes(1); expect(host.querySelector('[role="alert"]')?.textContent).toContain("temporarily offline");
  expect(host.querySelector("input")).toBe(title); expect(title.value).toBe("Unsaved title"); expect(editor.textContent).toBe("Unsaved body");
  h.save.mockResolvedValueOnce({ updatedAt: 2 });
  await act(async () => { button.click(); });
  expect(h.save).toHaveBeenCalledTimes(2); expect(host.textContent).toBe("Saved successfully");
});
it("keeps a stable new shared-note ID when a response fails and the user retries", async () => {
  h.save.mockRejectedValueOnce(new Error("response lost"));
  await act(async () => root.render(<Harness kind="shared" fresh />)); await typeDraft();
  const button = [...host.querySelectorAll("button")].find(b => b.textContent === "Save")!;
  await act(async () => button.click()); const id = h.save.mock.calls[0]![1];
  const pending = deferred<unknown>(); h.save.mockReturnValueOnce(pending.promise);
  await act(async () => button.click());
  expect(h.save.mock.calls[1]![1]).toBe(id); expect(button.disabled).toBe(true);
  await act(async () => pending.resolve({})); expect(host.textContent).toBe("Saved successfully");
});
