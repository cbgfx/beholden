// @vitest-environment jsdom
import { act } from "react";
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
