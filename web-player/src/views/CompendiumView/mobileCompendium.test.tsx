// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompendiumView } from "@beholden/shared/views/compendium/CompendiumView";
import { BrowserFilters } from "@beholden/shared/views/compendium/BrowserFilters";
import type { CompendiumPanelProps } from "@beholden/shared/views/compendium/CompendiumHost";

vi.mock("@beholden/shared/ui/webSocket", () => ({ useWs: () => {} }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (s: string) => s }));
vi.mock("@beholden/shared/views/compendium/MonsterBrowser", () => ({ MonsterBrowser: (props: { onSelectMonster: Select }) => <Browser select={props.onSelectMonster} /> }));
vi.mock("@beholden/shared/views/compendium/SpellBrowser", () => ({ SpellBrowser: (props: { onSelectSpell: Select }) => <Browser select={props.onSelectSpell} /> }));
vi.mock("@beholden/shared/views/compendium/ItemBrowser", () => ({ ItemBrowser: (props: { onSelectItem: Select }) => <Browser select={props.onSelectItem} /> }));
vi.mock("@beholden/shared/views/compendium/FeatPanels", () => ({ FeatBrowser: (props: { onSelectFeat: Select }) => <Browser select={props.onSelectFeat} />, FeatDetail: () => <div>Feat detail</div> }));
vi.mock("@beholden/shared/views/compendium/MonsterDetail", () => ({ MonsterDetail: (props: { monsterId: string; ruleset: string }) => <div>Monster detail {props.monsterId} {props.ruleset}</div> }));
vi.mock("@beholden/shared/views/compendium/SpellDetail", () => ({ SpellDetail: () => <div>Spell detail</div> }));
vi.mock("@beholden/shared/views/compendium/ItemDetail", () => ({ ItemDetail: () => <div>Item detail</div> }));
vi.mock("@beholden/shared/views/compendium/RulesReference", () => ({ RulesReference: () => <div>Rules content</div> }));

type Select = (id: string, ruleset: "5e") => void;
function Browser({ select }: { select: Select }) {
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState(1);
  return <div data-list style={{ overflow: "auto" }}>
    <input aria-label="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
    <button onClick={() => setPages((value) => value + 1)}>Load page</button><span>Pages {pages}</span>
    <button onClick={() => select("duplicate-id", "5e")}>Open entry</button>
  </div>;
}
function Panel(props: CompendiumPanelProps) { return <section style={props.style}>{props.title}{props.children}</section>; }
let root: Root;
let host: HTMLDivElement;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", () => media);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function setup(url = "/compendium") {
  const router = createMemoryRouter([{ path: "/compendium", element: <CompendiumView Panel={Panel} extraSections={[{ id: "guide", label: "Guide", icon: null, render: () => <div>Guide content</div> }]} /> }], { initialEntries: [url] });
  await act(async () => root.render(<RouterProvider router={router} />));
  return router;
}
async function click(text: string) {
  await act(async () => { Array.from(host.querySelectorAll("button")).find((button) => button.textContent === text)!.click(); });
}
async function resize(matches: boolean) {
  media.matches = matches;
  await act(async () => { media.addEventListener.mock.calls.forEach(([, listener]) => listener()); });
}

it("preserves search, loaded pages and the list DOM/scroll through Back and Forward", async () => {
  const router = await setup();
  const list = host.querySelector<HTMLElement>("[data-list]")!;
  list.scrollTop = 520;
  const input = list.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "dragon");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Load page");
  await click("Open entry");
  expect(router.state.location.search).toContain("compendiumRuleset=5e");
  expect(host.textContent).toContain("Monster detail duplicate-id 5e");
  expect(list.parentElement!.style.display).toBe("none");
  await click("Back to list");
  expect(host.querySelector("[data-list]")).toBe(list);
  expect(input.value).toBe("dragon");
  expect(list.scrollTop).toBe(520);
  expect(list.textContent).toContain("Pages 2");
  expect(list.parentElement!.style.display).toBe("flex");
  await act(async () => router.navigate(1));
  expect(list.parentElement!.style.display).toBe("none");
  await act(async () => router.navigate(-1));
  expect(list.parentElement!.style.display).toBe("flex");
});

it("preserves selection when resizing and restores the original desktop columns", async () => {
  await setup();
  await click("Open entry");
  await resize(false);
  expect(host.querySelector<HTMLElement>("[data-list]")!.parentElement!.style.display).toBe("flex");
  expect(host.textContent).toContain("Monster detail duplicate-id 5e");
  expect(host.innerHTML).toContain("180px minmax(320px, 400px) minmax(420px, 1fr)");
  await resize(true);
  expect(host.querySelector<HTMLElement>("[data-list]")!.parentElement!.style.display).toBe("none");
  expect(host.querySelector('button[aria-label="Reference"]')!.textContent).toContain("Monsters");
});

it("opens Rules and extra sections without a detail column and handles a direct detail link", async () => {
  const router = await setup("/compendium?compendiumSection=monsters&compendiumEntry=duplicate-id&compendiumRuleset=5e");
  await click("Back to list");
  expect(router.state.location.search).not.toContain("compendiumEntry");
  for (const section of ["rules", "guide", "spells", "items", "feats"]) {
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Reference"]')!.click());
    const labels: Record<string, string> = { rules: "Rules Reference", guide: "Guide", spells: "Spells", items: "Items", feats: "Feats" };
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')].find((button) => button.textContent?.includes(labels[section]))!.click());
    expect(router.state.location.search).toContain(`compendiumSection=${section}`);
    expect(host.textContent).not.toContain("Back to list");
    if (section === "rules") expect(host.textContent).toContain("Rules content");
    else if (section === "guide") expect(host.textContent).toContain("Guide content");
    else { await click("Open entry"); expect(host.textContent).toContain("Back to list"); await click("Back to list"); }
  }
});

it("collapses filters only in compact mode", async () => {
  await act(async () => root.render(<BrowserFilters><input aria-label="Filter" /></BrowserFilters>));
  expect(host.querySelector("details")!.open).toBe(false);
  await act(async () => { host.querySelector("summary")!.click(); });
  expect(host.querySelector("details")!.open).toBe(true);
  await resize(false);
  expect(host.querySelector("details")).toBeNull();
  expect(host.querySelector("input")).not.toBeNull();
});

it("returns to the initial section when Back follows a section change from detail", async () => {
  const router = await setup();
  await click("Open entry");
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Reference"]')!.click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')].find((button) => button.textContent === "Spells")!.click());
  expect(host.querySelector('button[aria-label="Reference"]')!.textContent).toContain("Spells");
  await act(async () => router.navigate(-1));
  expect(host.querySelector('button[aria-label="Reference"]')!.textContent).toContain("Monsters");
});


it("uses themed category buttons with keyboard navigation and Escape dismissal", async () => {
  await setup();
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Reference"]')!;
  expect(host.querySelector("select")).toBeNull();
  await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
  expect(document.activeElement?.getAttribute("aria-checked")).toBe("true");
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
  expect(document.activeElement?.textContent).toBe("Spells");
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(host.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
