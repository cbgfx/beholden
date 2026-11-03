// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CombatantHeader } from "./components/CombatantHeader";
import { CombatRosterHeader } from "../CombatRosterView/components/CombatRosterHeader";
import { CombatDeltaControls } from "./components/CombatDeltaControls";
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => (source: string) => source,
}));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("retains the complete roster title and a working Back action on compact screens", async () => {
  const name = "Combat Roster: An exceptionally long encounter name";
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <CombatRosterHeader title={name} backTo="/campaign" totalXp={1234} />
      ),
    },
    { path: "/campaign", element: <div>Campaign</div> },
  ]);
  await act(async () => root.render(<RouterProvider router={router} />));
  expect(host.textContent).toContain(name);
  const title = [...host.querySelectorAll("span")].find(
    (element) => element.textContent === name,
  )!;
  expect(title.style.whiteSpace).toBe("normal");
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('button[title="Back to Campaign"]')!
      .click(),
  );
  expect(router.state.location.pathname).toBe("/campaign");
});
it("keeps initiative, rewards, spells and notes available in the compact combat header", async () => {
  const roll = vi.fn();
  const rewards = vi.fn();
  const spells = vi.fn();
  const notes = vi.fn();
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <CombatantHeader
          title="A very long combat name"
          backTo="/roster"
          started={false}
          rollLabel="Roll Initiative"
          onRollOrReset={roll}
          onOpenRewards={rewards}
          onOpenSpellBook={spells}
          onOpenAdventureNotes={notes}
          onEndCombat={vi.fn()}
        />
      ),
    },
  ]);
  await act(async () => root.render(<RouterProvider router={router} />));
  const buttons = [...host.querySelectorAll("button")];
  for (const title of [
    "Encounter rewards: XP and loot",
    "Spell Book",
    "Adventure Notes",
  ])
    await act(async () =>
      buttons.find((button) => button.title === title)!.click(),
    );
  const initiative = buttons.find(
    (button) => button.title === "Roll Initiative",
  )!;
  expect(initiative.textContent?.trim()).toBe("");
  await act(async () => initiative.click());
  expect(roll).toHaveBeenCalledOnce();
  expect(rewards).toHaveBeenCalledOnce();
  expect(spells).toHaveBeenCalledOnce();
  expect(notes).toHaveBeenCalledOnce();
});
it("retains damage, healing, conditions and bulk callbacks with the compact controls", async () => {
  const damage = vi.fn();
  const heal = vi.fn();
  const conditions = vi.fn();
  const bulk = vi.fn();
  const change = vi.fn();
  await act(async () =>
    root.render(
      <CombatDeltaControls
        value="12"
        onChange={change}
        onApplyDamage={damage}
        onApplyHeal={heal}
        onOpenConditions={conditions}
        onToggleBulkMode={bulk}
      />,
    ),
  );
  for (const title of [
    "Apply damage",
    "Apply heal",
    "Conditions",
    "Bulk Damage - select multiple targets",
  ])
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(`button[title="${title}"]`)!
        .click(),
    );
  expect(damage).toHaveBeenCalledOnce();
  expect(heal).toHaveBeenCalledOnce();
  expect(conditions).toHaveBeenCalledOnce();
  expect(bulk).toHaveBeenCalledOnce();
  const input = host.querySelector("input")!;
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  expect(damage).toHaveBeenCalledTimes(2);
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(change).toHaveBeenCalledWith("");
});
it("does not focus the mobile math field when selecting a target or applying damage", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  await act(async () =>
    root.render(
      <CombatDeltaControls
        targetId="target"
        value="12"
        onChange={vi.fn()}
        onApplyDamage={vi.fn()}
        onApplyHeal={vi.fn()}
      />,
    ),
  );
  const input = host.querySelector("input")!;
  expect(document.activeElement).not.toBe(input);
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('button[title="Apply damage"]')!
      .click(),
  );
  expect(document.activeElement).not.toBe(input);
});
