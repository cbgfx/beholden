// @vitest-environment jsdom
import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CharacterFeatPickerModal } from "./CharacterFeatPickerModal";
import { InventoryItemPickerModal } from "./inventory/CharacterInventoryPickerModal";
const mocks = vi.hoisted(() => ({ api: vi.fn(), refresh: vi.fn(), translate: (source: string, values?: Record<string, unknown>) => source.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values?.[key] ?? "")) }));
vi.mock("@/services/api", () => ({ api: mocks.api }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => mocks.translate, useUiMessages: () => mocks.translate }));
vi.mock("@/views/CompendiumView/hooks/useItemSearch", () => ({ useItemSearch: useSearchStub }));
vi.mock("@/lib/monsterPicker/useVirtualList", () => ({ useVirtualList: () => ({ scrollRef: useRef(null), onScroll: () => {}, getRange: (length: number) => ({ start: 0, end: length, padTop: 0, padBottom: 0 }) }) }));
function useSearchStub() {
  const [q, setQ] = useState("");
  return { q, setQ, rarityFilter: "all", setRarityFilter: () => {}, rarityOptions: ["all"], typeFilter: "all", setTypeFilter: () => {}, typeOptions: ["all"], filterAttunement: false, setFilterAttunement: () => {}, filterMagic: false, setFilterMagic: () => {}, hasActiveFilters: false, clearFilters: () => {}, rows: [{ id: "relic", name: "Relic", rarity: "common", type: "Gear" }], busy: false, error: null, totalCount: 1, loadingMore: false, hasMore: false, loadMore: () => {}, refresh: mocks.refresh };
}
let root: Root; let host: HTMLDivElement;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  localStorage.clear(); mocks.api.mockReset();
  media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }; vi.stubGlobal("matchMedia", () => media);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function click(text: string) { await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === text)!.click(); }); }
async function enter(input: HTMLInputElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function resize(matches: boolean) { media.matches = matches; await act(async () => { media.addEventListener.mock.calls.forEach(([, fn]) => fn()); }); }

it("keeps the feat list/search/scroll while previewing, and validates ability choices before adding", async () => {
  mocks.api.mockImplementation(async (path: string) => path.includes("lookup") ? { rows: [{ feat: { id: "boon", name: "Physical Boon", text: "A boon.", parsed: { choices: [{ type: "ability_score", count: 1, options: ["Strength", "Dexterity"], amount: 1 }] } } }] } : [{ id: "boon", name: "Physical Boon" }]);
  const add = vi.fn(); const close = vi.fn();
  await act(async () => root.render(<CharacterFeatPickerModal isOpen ruleset="5.5e" accentColor="#fff" currentFeatIds={[]} existingFeatureNames={[]} onAdd={add} onClose={close} />));
  const input = host.querySelector<HTMLInputElement>('input[placeholder="Search feats..."]')!;
  await enter(input, "Physical");
  const row = [...host.querySelectorAll("button")].find((b) => b.textContent === "Physical Boon")!;
  const list = row.parentElement!; list.scrollTop = 90;
  await click("Physical Boon");
  expect(list.style.display).toBe("none");
  expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Choose ability increase")!.disabled).toBe(true);
  await click("Back to list"); expect(input.value).toBe("Physical"); expect(list.scrollTop).toBe(90);
  await click("Physical Boon"); await click("Strength");
  await resize(false); expect(list.style.display).toBe("flex");
  await resize(true);
  await click("Add Physical Boon");
  expect(add).toHaveBeenCalledWith({ id: "boon", name: "Physical Boon" }, ["str"]); expect(close).toHaveBeenCalledOnce();
});

it("preserves inventory search/list state on Back and passes quantity and description when adding", async () => {
  mocks.api.mockResolvedValue({ id: "relic", name: "Relic", text: ["Description"], properties: [], type: "Gear", rarity: "common" });
  const add = vi.fn(); const close = vi.fn();
  await act(async () => root.render(<InventoryItemPickerModal isOpen accentColor="#fff" onClose={close} onAdd={add} />));
  const search = host.querySelector<HTMLInputElement>('input[placeholder="Search items..."]')!;
  await enter(search, "Relic");
  const row = [...host.querySelectorAll("button")].find((b) => b.textContent!.startsWith("Relic"))!;
  const list = row.closest<HTMLElement>('[style*="overflow-y"]') ?? row.parentElement!;
  list.scrollTop = 120;
  await act(async () => row.click());
  await click("Back to list"); expect(search.value).toBe("Relic"); expect(list.scrollTop).toBe(120);
  expect(host.contains(row)).toBe(true);
  await act(async () => row.click());
  await enter(host.querySelector<HTMLInputElement>('input[type="number"]')!, "3");
  await resize(false); await resize(true);
  await click("Add");
  expect(add).toHaveBeenCalledWith(expect.objectContaining({ name: "Relic", quantity: 3, description: "Description", source: "compendium" }));
  await click("Back to list"); await click("Close"); expect(close).toHaveBeenCalledOnce();
});
