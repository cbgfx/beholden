// @vitest-environment jsdom
import { act, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/services/api", () => ({ api: mocks.api }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "dm" } }),
}));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => (text: string) => text,
}));
import { DmWorkspace } from "./DmWorkspace";
import { WorkspaceNavigationContext } from "./WorkspaceBottomBar";
import personSvg from "@beholden/shared/icons/svg/person.svg?raw";
import encounterSvg from "@beholden/shared/icons/svg/encounter.svg?raw";
import adventureSvg from "@beholden/shared/icons/svg/adventure.svg?raw";
let host: HTMLDivElement;
let root: Root;
const panels = [
  { id: "players", title: "Players", column: 0, content: <div>Party</div> },
  { id: "notes", title: "Notes", column: 1, content: <div>Notes content</div> },
];
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  mocks.api.mockReset().mockResolvedValue(null);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function click(name: string) {
  const button = [...host.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === name || b.textContent === name,
  );
  expect(button, name).toBeTruthy();
  await act(async () => button!.click());
}
const columnOf = (id: string) =>
  host
    .querySelector(`[data-workspace-panel="${id}"]`)
    ?.parentElement?.getAttribute("data-workspace-column");
it("uses adventure.svg and person.svg for campaign column headings and tabs", async () => {
  await act(async () => root.render(<DmWorkspace workspace="campaign" panels={[{ ...panels[0], id: "adventures", title: "Adventures" }, { ...panels[1], id: "players", title: "Players" }]} defaultColumns={2} compact />));
  const path = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("path")?.getAttribute("d");
  const tabs = host.querySelectorAll("nav button");
  expect(tabs[0].querySelector("path")?.getAttribute("d")).toBe(path(adventureSvg));
  expect(tabs[1].querySelector("path")?.getAttribute("d")).toBe(path(personSvg));
  expect(host.querySelector('[data-workspace-column="0"] path')?.getAttribute("d")).toBe(path(adventureSvg));
  expect(host.querySelector('[data-workspace-column="1"] path')?.getAttribute("d")).toBe(path(personSvg));
});
it("uses person and crossed-swords icons and pages fixed combat layouts without loading preferences", async () => {
  const rosterPanels = [
    { ...panels[0], id: "players", title: "Players", column: 0 },
    { ...panels[1], id: "encounter-roster", title: "Encounter", column: 1 },
    { ...panels[1], id: "treasure", title: "Treasure", column: 2 },
  ];
  await act(async () => root.render(<DmWorkspace workspace="combat" panels={rosterPanels} defaultColumns={3} fixedLayout compact />));
  const tabs = host.querySelectorAll<HTMLButtonElement>("nav button");
  expect(tabs).toHaveLength(3);
  const path = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("path")?.getAttribute("d");
  expect(tabs[0].querySelector("path")?.getAttribute("d")).toBe(path(personSvg));
  expect(tabs[1].querySelector("path")?.getAttribute("d")).toBe(path(encounterSvg));
  await act(async () => tabs[1].click());
  expect(host.querySelector<HTMLElement>('[data-workspace-column="1"]')!.hidden).toBe(false);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("uses Player-style title cards while editing and saves column names", async () => {
  await act(async () => root.render(<DmWorkspace workspace="campaign" panels={panels} defaultColumns={2} />));
  await click("Customize layout");
  expect(host.textContent).not.toContain("Notes content");
  expect(host.querySelector('[aria-label="Columns"]')).toBeNull();
  expect([...host.querySelectorAll("button")].some((button) => button.textContent === "+ Column")).toBe(true);
  expect(host.querySelector('[aria-label="Column {{number}} icon"]')).not.toBeNull();
  const name = host.querySelector<HTMLInputElement>('[aria-label="Column {{number}} name"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "Party"); name.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => name.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  await click("Done");
  expect(JSON.parse(mocks.api.mock.calls[1][1].body).views[0].columnHeaders[0].name).toBe("Party");
  expect(host.textContent).toContain("Notes content");
});
it("pages saved mobile columns in the shell bottom slot without preference writes and restores desktop columns", async () => {
  let notify = () => {};
  const media = { matches: true, addEventListener: (_: string, callback: () => void) => { notify = callback; }, removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", () => media);
  function Shell() {
    const [target, setTarget] = useState<HTMLDivElement | null>(null);
    const [active, setActive] = useState(false);
    const slot = useMemo(() => ({ target, setActive }), [target]);
    return <WorkspaceNavigationContext.Provider value={slot}><div className="shellLayout"><DmWorkspace workspace="campaign" panels={panels} defaultColumns={2} /></div><div ref={setTarget} data-bottom />{!active && <footer>Copyright</footer>}</WorkspaceNavigationContext.Provider>;
  }
  await act(async () => root.render(<Shell />));
  expect(host.querySelectorAll("[data-bottom] nav button")).toHaveLength(2);
  expect(host.querySelector("footer")).toBeNull();
  expect(host.querySelector<HTMLElement>('[data-workspace-column="1"]')!.hidden).toBe(true);
  await act(async () => host.querySelectorAll<HTMLButtonElement>("[data-bottom] nav button")[1].click());
  expect(host.querySelector<HTMLElement>('[data-workspace-column="0"]')!.hidden).toBe(true);
  expect(host.querySelector<HTMLElement>('[data-workspace-column="1"]')!.hidden).toBe(false);
  expect(mocks.api).toHaveBeenCalledTimes(1);
  await act(async () => { media.matches = false; notify(); });
  expect(host.querySelectorAll("[data-workspace-column][hidden]")).toHaveLength(0);
  expect(host.querySelector("[data-bottom] nav")).toBeNull();
  expect(host.querySelector("footer")).not.toBeNull();
});
it("previews panel moves and persists them when editing is done", async () => {
  await act(async () =>
    root.render(
      <DmWorkspace workspace="campaign" panels={panels} defaultColumns={2} />,
    ),
  );
  await click("Customize layout");
  await click("Move right: Players");
  expect(columnOf("players")).toBe("1");
  expect(mocks.api).toHaveBeenCalledTimes(1);
  await click("Done");
  const body = JSON.parse(mocks.api.mock.calls[1][1].body);
  expect(body.views[0].columns).toEqual([[], ["notes", "players"]]);
  expect(host.querySelector('[aria-label="Customize layout"]')).toBeTruthy();
});
it("keeps a failed save editable and retries without discarding the layout", async () => {
  await act(async () =>
    root.render(
      <DmWorkspace workspace="combat" panels={panels} defaultColumns={2} />,
    ),
  );
  await click("Customize layout");
  await click("Move right: Players");
  mocks.api.mockRejectedValueOnce(new Error("offline"));
  await click("Done");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Could not save",
  );
  expect(columnOf("players")).toBe("1");
  await click("Done");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});
it("can render a workspace without layout editing controls", async () => {
  await act(async () =>
    root.render(
      <DmWorkspace workspace="combat" panels={panels} defaultColumns={2} allowLayoutEditing={false} />,
    ),
  );
  expect(host.querySelector('[aria-label="Customize layout"]')).toBeNull();
  expect(host.querySelector('[aria-label="Layout"]')).toBeTruthy();
});
it("uses only the default layout when the workspace is fixed", async () => {
  mocks.api.mockResolvedValue({
    activeId: "custom",
    views: [{ id: "custom", name: "Custom", columns: [["notes"], ["players"]] }],
  });
  await act(async () =>
    root.render(
      <DmWorkspace workspace="combat" panels={panels} defaultColumns={2} fixedLayout />,
    ),
  );
  expect(mocks.api).not.toHaveBeenCalled();
  expect(host.querySelector('[aria-label="Layout"]')).toBeNull();
  expect(columnOf("players")).toBe("0");
});
it("does not allow a late read from another workspace to replace the active layout", async () => {
  let resolve!: (value: unknown) => void;
  mocks.api.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () =>
    root.render(
      <DmWorkspace workspace="campaign" panels={panels} defaultColumns={2} />,
    ),
  );
  await act(async () =>
    root.render(
      <DmWorkspace workspace="combat" panels={panels} defaultColumns={2} />,
    ),
  );
  await act(async () =>
    resolve({
      activeId: "other",
      views: [{ id: "other", name: "Wrong", columns: [["notes", "players"]] }],
    }),
  );
  expect(columnOf("players")).toBe("0");
  expect(host.textContent).not.toContain("Wrong");
});
