// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { CampaignCard } from "./PlayerHomeCampaignCard";
import { CharacterRow } from "./PlayerHomeCharacterRow";
import { CharacterSheetHeader } from "../character/CharacterSheetHeader";
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (s: string) => s }));
vi.mock("@beholden/shared/i18n", async original => ({ ...await original<object>(), useUiTranslation: () => (s: string) => s }));
const noop = () => {};
const image = "https://retired.example/character-images/hero.webp?v=42";
const hero = { id: "hero", name: "Hero", playerName: "Player", className: "Fighter", species: "Human", level: 1, hpMax: 10, hpCurrent: 10, ac: 12, color: null, imageUrl: image, isActive: true, campaigns: [] };
function markup(child: React.ReactNode) { const host = document.createElement("div"); host.innerHTML = renderToStaticMarkup(<MemoryRouter>{child}</MemoryRouter>); return host; }
it("home campaign banners resolve legacy upload URLs while preserving version queries", () => {
  const host = markup(<CampaignCard campaign={{ id: "camp", name: "Campaign", updatedAt: 1, playerCount: 1, imageUrl: "https://retired.example/campaign-images/camp.webp?v=7" }} characters={[]} onOpen={noop} onAssigned={async () => {}} />);
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/campaign-images/camp.webp?v=7");
});
it("home character portraits resolve legacy upload URLs", () => {
  const host = markup(<CharacterRow ch={hero} onOpen={noop} onRefresh={async () => {}} onError={noop} />);
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/character-images/hero.webp?v=42");
});
it("the character sheet uses the same portrait URL as the home screen", () => {
  const host = markup(<CharacterSheetHeader character={hero} identityLabels={[]} campaigns={[]} accentColor="#fff" portraitUploading={false} onSelectPortrait={noop} onOpenInfo={noop} onOpenEngagedEnemies={noop} showEngagedEnemies={false} inCombat={false} isMyTurn={false} sheetViews={[]} activeViewId="" onSelectView={noop} onCreateView={noop} layoutEditMode={false} onToggleLayoutEditMode={noop} activeBastion={null} xpEarned={0} xpNeeded={300} xpLevelStart={0} xpInput="" xpPopupOpen={false} setXpInput={noop} setXpPopupOpen={noop} saveXp={async () => {}} />);
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/character-images/hero.webp?v=42");
});
