// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonsterPickerModal } from "./MonsterPickerModal";
const mocks = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (source: string) => source }));
vi.mock("@beholden/shared/views/statblock/MonsterStatblock", () => ({ MonsterStatblock: () => <div>Statblock</div> }));
vi.mock("./hooks/useMonsterPickerState", async () => {
  const { useRef, useState } = await import("react");
  return { useMonsterPickerState: () => {
    const [selectedMonsterId, setSelectedMonsterId] = useState("bird");
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [label, setLabel] = useState("Aarakocra");
    return {
      selectedMonsterId, setSelectedMonsterId, rows: [{ id: "bird", name: "Aarakocra", cr: 0.25, type: "humanoid", ruleset: "5e" }], totalRows: 1, loadingIndex: false, indexError: null,
      sortMode: "az", setSortMode: vi.fn(), envFilter: "all", setEnvFilter: vi.fn(), envOptions: ["all"], sizeFilter: "all", setSizeFilter: vi.fn(), sizeOptions: ["all"], typeFilter: "all", setTypeFilter: vi.fn(), typeOptions: ["all"], crMin: "", crMax: "", setCrMin: vi.fn(), setCrMax: vi.fn(), clearFilters: vi.fn(), rulesetFilter: "", setRulesetFilter: vi.fn(), showRulesetFilter: true,
      ensureRange: vi.fn(), lettersInList: [], onJumpToLetter: vi.fn(), qtyById: quantities, setQtyForId: (id: string, qty: number) => setQuantities((current) => ({ ...current, [id]: qty })), labelById: { bird: label }, acById: {}, acDetailById: {}, hpById: {}, hpDetailById: {}, friendlyById: {}, attackOverridesById: {}, handleAddMonster: mocks.add, listScrollToIndexRef: useRef(null),
      monster: {}, selectedLabel: label, setLabelForId: (_: string, value: string) => setLabel(value), selectedAc: "12", selectedAcDetail: "", selectedHp: "13", selectedHpDetail: "", selectedFriendly: false, setAcForId: vi.fn(), setHpForId: vi.fn(), setFriendlyForId: vi.fn(), onChangeAttack: vi.fn(),
    };
  } };
});
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  mocks.add.mockReset().mockResolvedValue(undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("shows one close control and keeps search, scroll, quantities and detail edits across mobile Back navigation", async () => {
  await act(async () => root.render(<MonsterPickerModal isOpen onClose={vi.fn()} onAddMonster={vi.fn()} />));
  expect(document.querySelectorAll('button[title="Close"]')).toHaveLength(1);
  const search = document.querySelector<HTMLInputElement>('input[placeholder="Search monsters..."]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "bird"); search.dispatchEvent(new Event("input", { bubbles: true })); });
  const row = document.querySelector<HTMLElement>('[role="button"][aria-label="Aarakocra"]')!;
  const scroller = row.parentElement!.parentElement!;
  scroller.scrollTop = 80;
  await act(async () => row.querySelector<HTMLButtonElement>('button[title="Increase"]')!.click());
  await act(async () => row.click());
  expect(row.closest("[hidden]")).not.toBeNull();
  const label = document.querySelector<HTMLInputElement>('input[placeholder="Label"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(label, "Scout"); label.dispatchEvent(new Event("input", { bubbles: true })); });
  const detailAdd = [...document.querySelectorAll<HTMLButtonElement>("button")].filter((button) => button.textContent === "Add").at(-1)!;
  await act(async () => detailAdd.click());
  expect(mocks.add).toHaveBeenCalledWith("bird", 2, { ruleset: "5e" });
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Back to list")!.click());
  expect(row.closest("[hidden]")).toBeNull();
  expect(search.value).toBe("bird"); expect(scroller.scrollTop).toBe(80);
  await act(async () => row.click());
  expect(label.value).toBe("Scout");
});
