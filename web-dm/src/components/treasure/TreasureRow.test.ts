// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import type { TreasureEntry } from "@/domain/types/domain";
import { TreasureRow } from "./TreasureRow";
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function setup(qty: number) {
  const updateQty = vi.fn(), remove = vi.fn(), onAward = vi.fn(), onClick = vi.fn();
  act(() => root.render(createElement(I18nextProvider, { i18n }, createElement(TreasureRow, {
    item: { id: "loot", name: "Arrows", qty } as TreasureEntry, updateQty, remove, onAward, onClick,
  }))));
  const button = (text: string) => Array.from(host.querySelectorAll("button")).find(b => b.textContent?.trim() === text);
  return { updateQty, remove, onAward, onClick, button };
}
it("uses the same item ID for quantity, award and delete actions", () => {
  const view = setup(3);
  view.button("+")!.click(); view.button("-")!.click();
  host.querySelector<HTMLButtonElement>('button[title="Award to player"]')!.click();
  host.querySelector<HTMLButtonElement>('button[title="Remove"]')!.click();
  expect(view.updateQty.mock.calls).toEqual([["loot", 4], ["loot", 2]]);
  expect(view.remove).toHaveBeenCalledWith("loot");
  expect(view.onAward).toHaveBeenCalledOnce();
  expect(view.onClick).not.toHaveBeenCalled();
});
it("prevents decrementing below one and keeps action clicks out of the detail drawer", () => {
  const view = setup(1);
  expect(view.button("-")).toBeUndefined();
  view.button("+")!.click();
  expect(view.onClick).not.toHaveBeenCalled();
  Array.from(host.querySelectorAll("span")).find(s => s.textContent === "Arrows")!.click();
  expect(view.onClick).toHaveBeenCalledOnce();
});
