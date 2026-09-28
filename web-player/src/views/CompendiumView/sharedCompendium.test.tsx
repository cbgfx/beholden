// @vitest-environment jsdom
/**
 * The compendium is one shared implementation in both apps. The player app renders it read-only;
 * the DM app turns on editing. These tests pin that split: without editing there are no add, edit
 * or delete controls, and with editing the controls appear and act on the right spell (id and
 * ruleset together, since spell ids repeat across rulesets).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@beholden/shared/api/browserClient", () => ({ api: mocks.api }));
vi.mock("@beholden/shared/ui/webSocket", () => ({ useWs: () => {} }));

import { CompendiumHostProvider, type CompendiumEntryEditing, type CompendiumPanelProps } from "@beholden/shared/views/compendium/CompendiumHost";
import { SpellBrowser } from "@beholden/shared/views/compendium/SpellBrowser";

const SPELLS = [
  { id: "sp_fireball", ruleset: "5.5e", name: "Fireball", level: 3, school: "EV", time: "1 action", ritual: false, concentration: false, components: "V, S, M", classes: "Wizard" },
  { id: "sp_fireball", ruleset: "5e", name: "Fireball", level: 3, school: "EV", time: "1 action", ritual: false, concentration: false, components: "V, S, M", classes: "Wizard" },
];

function Panel(props: CompendiumPanelProps) {
  return <section><header>{props.title}{props.actions}</header>{props.children}</section>;
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mocks.api.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/spells/search")) return { rows: SPELLS, total: SPELLS.length };
    if (path.startsWith("/api/spells/facets")) return { schools: ["EV"], classes: ["Wizard"] };
    if (path.startsWith("/api/compendium/rulesets")) return { spells: ["5e", "5.5e"] };
    throw new Error(`unexpected request ${path}`);
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  mocks.api.mockReset();
});

async function render(editing?: CompendiumEntryEditing) {
  await act(async () => {
    root.render(
      <CompendiumHostProvider value={{ Panel, revision: 0, editing: editing ? { spells: editing } : undefined }}>
        <SpellBrowser selectedSpellId={null} onSelectSpell={() => {}} />
      </CompendiumHostProvider>,
    );
  });
  // Let the debounced search fire and its response settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
}

const buttonsTitled = (title: string) => [...host.querySelectorAll(`button[title="${title}"]`)] as HTMLButtonElement[];

it("is read-only without editing", async () => {
  await render();
  expect(host.textContent).toContain("Fireball");
  expect(buttonsTitled("New spell")).toHaveLength(0);
  expect(buttonsTitled("Edit spell")).toHaveLength(0);
  expect(buttonsTitled("Delete spell")).toHaveLength(0);
  // Tooltips are shown in both apps.
  expect(host.querySelector('select[title="Filter by level"]')).not.toBeNull();
});

it("labels each row with its ruleset when the compendium holds more than one", async () => {
  await render();
  const subtitles = [...host.querySelectorAll("button > div:nth-child(2)")].map((element) => element.textContent ?? "");
  expect(subtitles.filter((text) => text.includes("Fireball") || text.startsWith("L3"))).toEqual([
    "L3 • Evocation • 1 action • 5.5e",
    "L3 • Evocation • 1 action • 5e",
  ]);
});

it("shows add, edit and delete controls with editing, and deletes the chosen ruleset's spell", async () => {
  const editing: CompendiumEntryEditing = { create: vi.fn(), edit: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
  await render(editing);

  expect(buttonsTitled("New spell")).toHaveLength(1);
  expect(buttonsTitled("Edit spell")).toHaveLength(2);

  // Delete the second row (the 5e Fireball), confirming inline.
  await act(async () => buttonsTitled("Delete spell")[1]!.click());
  await act(async () => buttonsTitled("Yes, delete")[0]!.click());
  expect(editing.remove).toHaveBeenCalledWith("sp_fireball", "5e");

  await act(async () => buttonsTitled("New spell")[0]!.click());
  expect(editing.create).toHaveBeenCalledTimes(1);
});
