// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlayerBinderView } from "./PlayerBinderView";
const mocks = vi.hoisted(() => ({ api: vi.fn(), translate: (s: string) => s }));
vi.mock("@/services/api", () => ({ api: mocks.api, resolveAssetUrl: (s: string) => s }));
vi.mock("@/services/ws", () => ({ useWs: () => {} }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => mocks.translate }));
vi.mock("@/ui/CharacterRequirementsBadge", () => ({ CharacterRequirementsBadge: () => null }));
const payload = {
  binder: { id: "binder", name: "World", color: "#aabbcc", currentDateSort: 100 }, linkedMortalId: "hero",
  mortals: [{ id: "hero", name: "Hero", mortalType: "player_character", lifeStatus: "alive", age: 20, birthDate: null, species: "Human", gender: "female", imageUrl: null, imageUpdatedAt: null, description: null, backstory: null, position: "Mage", organization: "Guild", location: "City" }],
  campaigns: [{ id: "quest", name: "Quest", currentDate: null, story: null }],
  deities: [{ id: "deity", type: "deity", name: "Wisdom", domains: ["Knowledge"], rank: "Greater God", parentName: null, description: null }],
  places: [{ id: "place", type: "country", name: "Kingdom", parentName: "World", rank: null, description: null }],
};
let host: HTMLDivElement; let root: Root;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  localStorage.clear(); mocks.api.mockReset().mockResolvedValue(payload);
  media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }; vi.stubGlobal("matchMedia", () => media);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function setup() {
  const router = createMemoryRouter([{ path: "/characters/:id/binder", element: <PlayerBinderView /> }], { initialEntries: ["/characters/character/binder"] });
  await act(async () => root.render(<RouterProvider router={router} />)); return router;
}
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent!.includes(text))!;
async function click(text: string) { await act(async () => button(text).click()); }
async function resize(matches: boolean) { media.matches = matches; await act(async () => { media.addEventListener.mock.calls.forEach(([, listener]) => listener()); }); }

it("collapses navigation, opens a mortal and supports browser Back without losing list search", async () => {
  const router = await setup();
  expect(host.querySelector("aside")!.hidden).toBe(true);
  await click("Binder sections"); expect(host.querySelector("aside")!.hidden).toBe(false);
  const search = host.querySelector<HTMLInputElement>('input[placeholder^="Search mortals"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "Hero"); search.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(button("Hero").textContent).toContain("Mage");
  await click("Hero"); expect(router.state.location.search).toContain("recordId=hero");
  expect(host.textContent).toContain("Mentioned in");
  await act(async () => router.navigate(-1));
  expect(host.querySelector<HTMLInputElement>('input[placeholder^="Search mortals"]')!.value).toBe("Hero");
  await resize(false); expect(host.innerHTML).toContain("1160px");
  await resize(true); expect(button("Hero").textContent).toContain("Alive");
});
it.each([["Deities", "Wisdom", "deity"], ["Places", "Kingdom", "place"], ["Campaigns", "Quest", "quest"]])("opens %s records and closes the phone section menu", async (section, name, id) => {
  const router = await setup();
  await click("Binder sections");
  const navButton = [...host.querySelectorAll<HTMLButtonElement>("nav button")].find((b) => b.textContent!.includes(section))!;
  await act(async () => navButton.click());
  expect(host.querySelector("aside")!.hidden).toBe(true);
  await click(name);
  expect(router.state.location.search).toContain(`recordId=${id}`);
  await act(async () => router.navigate(-1));
  expect(button(name)).toBeTruthy();
});
