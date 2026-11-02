// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CharacterColumnHeading, CharacterColumnTabs, useSheetColumnNavigation } from "./CharacterColumnNavigation";
import type { SheetViewDef } from "./panelRegistry";
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (source: string, values?: Record<string, unknown>) => source.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values?.[key] ?? "")) }));
vi.mock("@beholden/shared/ui/gameIconsCollection", () => ({ useGameIconNames: () => ["sword", "shield"], normalizeIconSearchText: (value: string) => value, toGameIconId: (name: string) => `game-icons:${name}` }));
let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const view: SheetViewDef = { id: "all", name: "All", columns: 4, layout: [[], [], [], []], columnHeaders: [{ name: "Stats", icon: "stats" }, { name: "Magic", icon: "spells" }] };
function Harness({ current = view, compact = true }: { current?: SheetViewDef; compact?: boolean }) {
  const scroll = useRef<HTMLDivElement>(null);
  const page = useSheetColumnNavigation(current.id, current.columns, compact, scroll);
  return <><div ref={scroll} data-scroll>{page.active}</div><CharacterColumnTabs view={current} active={page.active} onSelect={page.select} accent="#aabbcc" /></>;
}
const render = async (current = view, compact = true) => { await act(async () => root.render(<Harness current={current} compact={compact} />)); };
const select = async (number: number) => { await act(async () => host.querySelectorAll("nav button")[number - 1].dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
it("shows icons without numbers, falls back to numbers for empty columns, and restores independent scroll positions", async () => {
  await render();
  expect(host.querySelectorAll("nav button")).toHaveLength(4);
  expect(host.querySelector('button[aria-label="Column 2: Magic"]')).not.toBeNull();
  const tabs = host.querySelectorAll("nav button");
  expect(tabs[1].textContent).toBe("");
  expect(tabs[1].querySelector("svg")).not.toBeNull();
  expect(tabs[2].textContent).toBe("3");
  expect(tabs[1].parentElement!.style.borderInlineStart).toContain("1px");
  const scroll = host.querySelector<HTMLElement>("[data-scroll]")!;
  scroll.scrollTop = 240; scroll.dispatchEvent(new Event("scroll"));
  await select(2); expect(scroll.scrollTop).toBe(0);
  scroll.scrollTop = 90; scroll.dispatchEvent(new Event("scroll"));
  await select(1); expect(scroll.scrollTop).toBe(240);
  await select(2); expect(scroll.scrollTop).toBe(90);
  expect(host.querySelector('[aria-current="page"]')!.getAttribute("aria-label")).toBe("Column 2: Magic");
});
it("isolates views and clamps selection when columns are removed without mutating layouts", async () => {
  const original = JSON.stringify(view);
  await render(); await select(4);
  await render({ ...view, id: "other", columns: 2 });
  expect(host.querySelector("[data-scroll]")!.textContent).toBe("0");
  await render(); expect(host.querySelector("[data-scroll]")!.textContent).toBe("3");
  await render(view, false); await render(view, true);
  expect(host.querySelector("[data-scroll]")!.textContent).toBe("3");
  await render({ ...view, columns: 2 });
  expect(host.querySelector("[data-scroll]")!.textContent).toBe("1");
  expect(JSON.stringify(view)).toBe(original);
});
it("edits names and icons separately and keeps custom names verbatim", async () => {
  const change = vi.fn();
  await act(async () => root.render(<CharacterColumnHeading view={view} index={1} editing accent="#aabbcc" onChange={change} />));
  const input = host.querySelector("input")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "My spells"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(change).toHaveBeenCalledWith({ name: "My spells", icon: "spells" });
  expect(host.querySelector("select")).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Column 2 icon"]')!.click());
  await act(async () => document.querySelector<HTMLButtonElement>('button[title="sword"]')!.click());
  expect(change).toHaveBeenLastCalledWith({ name: "Magic", icon: "game-icons:sword" });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
