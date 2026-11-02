// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CharacterCountersPanel } from "./CharacterCountersPanel";
import { SkillsPanel } from "./CharacterSkillsPanel";
import { ALL_SKILLS } from "./CharacterSheetConstants";
import { CharacterPermanentBuffsDrawer } from "./CharacterPermanentBuffsDrawer";
import { CharacterSpellRow } from "./spells/CharacterSpellRow";
import { CharacterHudXpPopup } from "./combat/CharacterHudXpPopup";
import { CharacterHudDeathSaves } from "./combat/CharacterHudDeathSaves";
import { CharacterInfoDrawer } from "./CharacterInfoDrawer";
import { InventoryCurrencyBar } from "./inventory/CharacterInventoryCurrencyBar";
import type { SheetOverrides } from "./CharacterViewTypes";
const mocks = vi.hoisted(() => ({ translate: (source: string, values?: Record<string, unknown>) => source.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values?.[key] ?? "")) }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => mocks.translate, useUiMessages: () => mocks.translate }));
vi.mock("@/services/api", () => ({ api: async () => ({ binderId: "binder", id: "mortal", name: "Hero", gender: "female", age: 20, backstory: "Biography" }), jsonInit: () => ({}) }));
vi.mock("@/services/actorApi", () => ({ fetchMyCharacter: async () => ({}) }));
let root: Root; let host: HTMLDivElement;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  localStorage.clear(); media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }; vi.stubGlobal("matchMedia", () => media);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(element: React.ReactNode) { await act(async () => root.render(element)); }
async function enter(input: HTMLInputElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function click(text: string) { await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === text)!.click(); }); }
async function resize(matches: boolean) { media.matches = matches; await act(async () => { media.addEventListener.mock.calls.forEach(([, fn]) => fn()); }); }

it("keeps counter increment/deletion persistence and restores the desktop row after resizing", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  await render(<CharacterCountersPanel counters={[{ id: "one", title: "Arrows", numCount: 2 }]} accentColor="#fff" onSave={save} />);
  const row = host.querySelector<HTMLElement>(".character-counter-row")!;
  expect(row.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Increase Arrows"]')!.click());
  expect(save).toHaveBeenLastCalledWith([{ id: "one", title: "Arrows", numCount: 3 }]);
  await resize(false); expect(row.style.gridTemplateColumns).toBe("minmax(0, 1fr) auto auto auto auto");
  await act(async () => host.querySelector<HTMLButtonElement>('button[title="Delete Arrows"]')!.click());
  expect(save).toHaveBeenLastCalledWith([]);
});

it("shows all skills in reading order on phones without changing bonuses on desktop", async () => {
  await render(<SkillsPanel scores={{ str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 }} pb={2} accentColor="#fff" stealthDisadvantage={false} nonProficientArmorPenalty={false} fmtMod={(value) => String(value)} />);
  const rows = [...host.querySelectorAll<HTMLElement>(".character-hover-row")];
  expect(rows).toHaveLength(ALL_SKILLS.length);
  ALL_SKILLS.forEach((skill, index) => expect(rows[index].textContent).toContain(skill.name));
  const before = new Map(ALL_SKILLS.map((skill, index) => [skill.name, rows[index].textContent]));
  await resize(false);
  for (const row of host.querySelectorAll(".character-hover-row")) expect([...before.values()]).toContain(row.textContent);
});

it("retains permanent AC and ability bonuses when editing the compact buffs drawer", async () => {
  const save = vi.fn();
  function Harness() {
    const [overrides, setOverrides] = useState<SheetOverrides>({ tempHp: 0, acBonus: 0, hpMaxBonus: 0 });
    const [abilities, setAbilities] = useState({});
    return <CharacterPermanentBuffsDrawer open accentColor="#fff" overridesDraft={overrides} abilityOverridesDraft={abilities} saving={false} onOverridesChange={setOverrides} onAbilityOverridesChange={setAbilities} onClose={() => {}} onSave={() => save(overrides, abilities)} />;
  }
  await render(<Harness />);
  const inputs = host.querySelectorAll<HTMLInputElement>('input[type="number"]');
  await enter(inputs[0], "2"); await enter(inputs[2], "1"); await click("Save buffs");
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ acBonus: 2, permanent: expect.objectContaining({ acBonus: true, abilityScores: true }) }), { str: 1 });
});

it("keeps info-drawer overrides and save actions available after resizing", async () => {
  const change = vi.fn(); const save = vi.fn();
  await render(<CharacterInfoDrawer open characterId="character" accentColor="#fff" identityFields={[["Name", "Hero"]]} editableOverrideFields={[{ key: "acBonus", label: "AC bonus", help: "Adjust armor class" }]} overridesDraft={{ tempHp: 0, acBonus: 0, hpMaxBonus: 0 }} abilityOverridesDraft={{}} overridesSaving={false} onClose={() => {}} onSave={save} onOverrideChange={change} onAbilityOverrideChange={() => {}} />);
  const input = [...host.querySelectorAll<HTMLInputElement>('input[type="number"]')].find((node) => node.parentElement!.textContent!.includes("AC bonus"))!;
  await enter(input, "3"); expect(change).toHaveBeenCalledWith("acBonus", 3);
  await resize(false); await resize(true);
  const saveButton = [...host.querySelectorAll("button")].find((node) => node.textContent!.startsWith("Save"))!;
  await act(async () => saveButton.click()); expect(save).toHaveBeenCalledOnce();
});

it("keeps preparation and cast controls separate from opening compact spell details", async () => {
  const prepare = vi.fn(); const cast = vi.fn(); const select = vi.fn();
  await render(<CharacterSpellRow entry={{ key: "armor", searchName: "Mage Armor", source: "Wizard", forcedPrepared: false }} detail={{ id: "armor", name: "Mage Armor", level: 1, time: "1 action", school: "Abjuration" }} isCantrip={false} accentColor="#fff" spellRowGrid="24px 1fr 108px 68px 92px" usesFlexiblePreparedList usesPreparedSpellSelection isPrepared={false} preparedLocked={false} preparedLimit={4} entrySpellAtk={3} scaledDamageText={null} scaledDamageTypes={[]} dmgColor={null} spellcastingBlocked={false} castToggle={{ active: false, onToggle: cast }} onTogglePrepared={prepare} onSelect={select} />);
  await act(async () => host.querySelector<HTMLButtonElement>('button[title="Mark prepared"]')!.click());
  await click("Cast"); expect(prepare).toHaveBeenCalledOnce(); expect(cast).toHaveBeenCalledOnce(); expect(select).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLElement>(".character-hover-row")!.click()); expect(select).toHaveBeenCalledOnce();
  await resize(false); expect(host.querySelector<HTMLElement>(".character-hover-row")!.style.gridTemplateColumns).toBe("24px 1fr 108px 68px 92px");
});

it("keeps XP quick-add and manual currency saves usable in viewport-bound popups", async () => {
  const xp = vi.fn().mockResolvedValue(undefined); const currency = vi.fn().mockResolvedValue(undefined);
  function Harness() {
    const [open, setOpen] = useState(true); const [value, setValue] = useState("100");
    return <><CharacterHudXpPopup xpEarned={100} xpNeeded={300} xpLevelStart={0} xpInput={value} xpPopupOpen={open} setXpInput={setValue} setXpPopupOpen={setOpen} saveXp={xp} accentColor="#fff" /><InventoryCurrencyBar currencyTotals={{ PP: 0, GP: 10, EP: 0, SP: 0, CP: 0 }} carriedWeight={0} carryCapacity={100} overCapacity={false} accentColor="#fff" onSaveCurrency={currency} /></>;
  }
  await render(<Harness />); await click("+100"); expect(xp).toHaveBeenCalledWith(200);
  await click("Close"); expect(host.textContent).not.toContain("Edit XP");
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent!.includes("GP"))!.click());
  const input = host.querySelector<HTMLInputElement>('input[inputmode="numeric"]')!;
  expect(input.closest<HTMLElement>('[style*="position: fixed"]')).not.toBeNull();
  await enter(input, "25"); await click("Save"); expect(currency).toHaveBeenCalledWith("GP", 25);
});

it("retains success/failure death-save values in the wrapping phone controls", async () => {
  const save = vi.fn();
  await render(<CharacterHudDeathSaves hpCurrent={0} dsSaving={false} deathSaves={{ success: 1, fail: 0 }} saveDeathSaves={save} />);
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Failure 2"]')!.click());
  expect(save).toHaveBeenCalledWith({ success: 1, fail: 2 });
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Success 1"]')!.click());
  expect(save).toHaveBeenLastCalledWith({ success: 0, fail: 0 });
});
