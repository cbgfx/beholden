// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CharacterViewSwitcher } from "./CharacterViewSwitcher";
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (s: string) => s }));
it("keeps saved view selection available when creation is disabled for phones", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const select = vi.fn();
  const views = [{ id: "first", name: "First", columns: 2, layout: [[], []] }, { id: "second", name: "Second", columns: 3, layout: [[], [], []] }];
  try {
    await act(async () => root.render(<CharacterViewSwitcher sheetViews={views} activeViewId="first" accentColor="#fff" onSelectView={select} />));
    await act(async () => host.querySelector("button")!.click());
    expect(document.body.textContent).not.toContain("+ Add View");
    const second = [...document.body.querySelectorAll("button")].find((button) => button.textContent === "Second")!;
    await act(async () => second.click());
    expect(select).toHaveBeenCalledWith("second");
    expect(views.map((view) => view.columns)).toEqual([2, 3]);
    const create = vi.fn();
    await act(async () => root.render(<CharacterViewSwitcher sheetViews={views} activeViewId="first" accentColor="#fff" onSelectView={select} onCreateView={create} />));
    await act(async () => host.querySelector("button")!.click());
    const add = [...document.body.querySelectorAll("button")].find((button) => button.textContent === "+ Add View")!;
    await act(async () => add.click());
    expect(create).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
