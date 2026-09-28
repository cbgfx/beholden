// @vitest-environment jsdom
//
// The note editor is filled from the campaign's note list, and that list is refetched whenever
// anything in the campaign changes - including another DM saving a different note. The editor used
// to refill itself every time the list arrived, so whoever was typing lost what they had written.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  fetchNoteById: vi.fn(),
  state: { campaignNotes: [] as unknown[], adventureNotes: [] as unknown[] },
}));

vi.mock("@/services/api", () => ({ api: mocks.api, jsonInit: (method: string, body: unknown) => ({ method, body }) }));
vi.mock("@/services/collectionApi", () => ({
  fetchNoteById: mocks.fetchNoteById,
  createCampaignNote: vi.fn(),
  createAdventureNote: vi.fn(),
}));
vi.mock("@/store", () => ({ useStore: () => ({ state: mocks.state }) }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => (text: string) => text,
}));

import { NoteDrawer } from "./NoteDrawer";

let host: HTMLDivElement;
let root: Root;

const note = (over: Partial<{ id: string; title: string; titleIsDerived: boolean; text: string }> = {}) => ({
  id: "note-1",
  scope: "campaign" as const,
  scopeId: "camp-1",
  title: "The cult",
  titleIsDerived: false,
  text: "They meet at midnight.",
  order: 1,
  ...over,
});

/** The drawer is a hook returning a body and a footer, so a tiny host component renders it. */
function Harness(props: { onClose?: () => void } = {}) {
  const drawer = NoteDrawer({
    drawer: { type: "editNote", noteId: "note-1" } as never,
    close: props.onClose ?? (() => {}),
    refreshCampaign: async () => {},
    refreshAdventure: async () => {},
  });
  return <div>{drawer.body}{drawer.footer}</div>;
}

const saveButton = () =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === "Save") as HTMLButtonElement;

async function typeTitle(value: string) {
  await act(async () => {
    const input = titleInput();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const titleInput = () => host.querySelector("input") as HTMLInputElement;
const textBox = () => host.querySelector("[contenteditable], textarea") as HTMLElement | null;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  mocks.api.mockReset().mockResolvedValue(null);
  mocks.fetchNoteById.mockReset().mockResolvedValue(note());
  mocks.state = { campaignNotes: [note()], adventureNotes: [] };
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("keeps what the DM has typed when the note list is refreshed underneath them", async () => {
  await act(async () => { root.render(<Harness />); });
  expect(titleInput().value).toBe("The cult");

  // The DM renames the note but has not saved yet.
  await typeTitle("The cult of the drowned god");
  expect(titleInput().value).toBe("The cult of the drowned god");

  // Something else in the campaign changes: a new list arrives, same note, old title.
  await act(async () => {
    mocks.state = { campaignNotes: [note(), note({ id: "note-2", title: "Somebody else's note" })], adventureNotes: [] };
    root.render(<Harness />);
  });

  expect(titleInput().value).toBe("The cult of the drowned god");
});

it("fills the boxes once the note list arrives, rather than showing an empty editor", async () => {
  mocks.state = { campaignNotes: [], adventureNotes: [] };
  await act(async () => { root.render(<Harness />); });
  expect(titleInput().value).toBe("");

  await act(async () => {
    mocks.state = { campaignNotes: [note()], adventureNotes: [] };
    root.render(<Harness />);
  });
  expect(titleInput().value).toBe("The cult");
});

it("leaves the title box empty for a note that has none of its own", async () => {
  mocks.state = { campaignNotes: [note({ title: "Ambush at the ford", titleIsDerived: true })], adventureNotes: [] };
  await act(async () => { root.render(<Harness />); });

  // The first line of the text is what the list shows, so it belongs in the placeholder: typing
  // nothing and saving must not turn it into a title the note then keeps for good.
  expect(titleInput().value).toBe("");
  expect(titleInput().placeholder).toBe("Ambush at the ford");
  expect(textBox()?.textContent ?? "").toContain("They meet at midnight.");
});


it("sends only the field that changed, so a save cannot undo somebody else's edit", async () => {
  await act(async () => { root.render(<Harness />); });
  await typeTitle("The cult of the drowned god");
  await act(async () => { saveButton().click(); });

  expect(mocks.api).toHaveBeenCalledTimes(1);
  const [url, init] = mocks.api.mock.calls[0]!;
  expect(url).toBe("/api/notes/note-1");
  expect(init.body).toEqual({ title: "The cult of the drowned god" });
  expect(init.body).not.toHaveProperty("text");
});

it("keeps the drawer open with the text intact when the save is refused", async () => {
  const close = vi.fn();
  mocks.api.mockRejectedValue(new Error("Network request failed"));

  await act(async () => { root.render(<Harness onClose={close} />); });
  await typeTitle("The cult of the drowned god");
  await act(async () => { saveButton().click(); });

  expect(close).not.toHaveBeenCalled();
  expect(titleInput().value).toBe("The cult of the drowned god");
  expect(host.querySelector("[role=alert]")?.textContent).toBe("Network request failed");
});

it("says nothing to the server when nothing was changed", async () => {
  const close = vi.fn();
  await act(async () => { root.render(<Harness onClose={close} />); });
  await act(async () => { saveButton().click(); });

  expect(mocks.api).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});
