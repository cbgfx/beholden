// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/services/api", async original => ({ ...await original<object>(), api: h.api }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (s: string) => s }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }));
vi.mock("@/store", () => ({ useStore: () => ({ dispatch: h.dispatch }) }));
import { PlayersPanel } from "./PlayersPanel";
it("expands a player's background on demand without opening the stats editor", async () => {
  h.api.mockResolvedValue({ text: "Raised in **Dalamere**." });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const edit = vi.fn(); const noop = () => {};
  try {
    await act(async () => root.render(<PlayersPanel players={[{ id: "p1", campaignId: "c1", characterName: "Hero", playerName: "Pat", class: "Wizard", species: "Elf", level: 8, ac: 11, hpMax: 51, hpCurrent: 51 }] as never} combatants={[]} selectedEncounterId={null} onCreatePlayer={noop} onEditPlayer={edit} onDeletePlayer={noop} onAddPlayerToEncounter={noop} onFullRest={noop} />));
    expect([...host.querySelectorAll("button")].some(b => b.textContent === "Background")).toBe(false);
    await act(async () => host.querySelector<HTMLButtonElement>('button[title="More actions"]')!.click());
    const button = [...host.querySelectorAll("button")].find(b => b.textContent === "Background")!;
    expect(h.api).not.toHaveBeenCalled();
    await act(async () => button.click());
    expect(h.api).toHaveBeenCalledWith("/api/campaigns/c1/players/p1/background", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(host.textContent).toContain("Raised in Dalamere.");
    expect(edit).not.toHaveBeenCalled();
    expect(host.contains(button)).toBe(false);
    await act(async () => host.querySelector<HTMLButtonElement>('button[title="More actions"]')!.click());
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Background")!.click());
    expect(host.textContent).not.toContain("Raised in");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("keeps confirmed dead players behind the muted count and offers Revive instead of combat add", async () => {
  h.api.mockClear(); h.dispatch.mockClear();
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const noop = () => {};
  const player = { id:"dead",campaignId:"c1",characterName:"Fallen Hero",playerName:"Pat",class:"Wizard",species:"Elf",level:8,ac:11,hpMax:51,hpCurrent:0,isDead:true,deathSaves:{success:0,fail:0} };
  h.api.mockResolvedValue({id:"dead",campaignId:"c1",sheet:{...player},live:{hpCurrent:1,conditions:[],deathSaves:{success:0,fail:0}}});
  try {
    await act(async () => root.render(<PlayersPanel players={[player]} combatants={[]} selectedEncounterId="enc" onCreatePlayer={noop} onEditPlayer={noop} onDeletePlayer={noop} onAddPlayerToEncounter={noop} onFullRest={noop} />));
    expect(host.textContent).not.toContain("Fallen Hero");
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Dead Players"]')!.click());
    expect(host.textContent).toContain("Fallen Hero");
    expect(host.querySelector('button[title="Add to encounter"]')).toBeNull();
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Revive")!.click());
    expect(h.api).toHaveBeenCalledWith("/api/players/dead/life-status",expect.objectContaining({method:"POST",body:JSON.stringify({action:"revive"})}));
    expect(h.dispatch).toHaveBeenCalledWith(expect.objectContaining({type:"upsertPlayer",player:expect.objectContaining({hpCurrent:1,deathSaves:{success:0,fail:0}})}));
  } finally { await act(async () => root.unmount()); host.remove(); }
});
it("three failed saves show Dead and Mark as Dead without hiding the unconfirmed player", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); const noop=()=>{};
  try {
    await act(async () => root.render(<PlayersPanel players={[{id:"p",campaignId:"c",characterName:"Hero",playerName:"Pat",class:"Wizard",species:"Elf",level:8,ac:11,hpMax:51,hpCurrent:0,deathSaves:{success:0,fail:3}}]} combatants={[]} selectedEncounterId="enc" onCreatePlayer={noop} onEditPlayer={noop} onDeletePlayer={noop} onAddPlayerToEncounter={noop} onFullRest={noop} />));
    expect(host.textContent).toContain("HeroDead");
    expect([...host.querySelectorAll("button")].some(button=>button.textContent==="Mark as Dead")).toBe(true);
    expect(host.querySelector('button[title="Add to encounter"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Dead Players"]')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
