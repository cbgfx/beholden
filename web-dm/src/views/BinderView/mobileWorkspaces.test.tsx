// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReferenceWorkspace } from "./ReferenceWorkspace";
import { BinderLoreWorkspace } from "./BinderLoreWorkspace";
import { BinderPlayersWorkspace } from "./BinderPlayersWorkspace";
import { BinderHealthWorkspace } from "./BinderHealthWorkspace";
import { DmWorkspace } from "@/layout/workspace/DmWorkspace";
const mock = vi.hoisted(() => ({ api: vi.fn(), refs: vi.fn(), health: vi.fn(), translate: (s: string) => s }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => mock.translate, useUiMessages: () => mock.translate }));
vi.mock("@/services/api", () => ({ api: mock.api, resolveAssetUrl: (s: string) => s }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/confirm/ConfirmContext", () => ({ useConfirm: () => vi.fn() }));
vi.mock("./useValidMentionIds", () => ({ useValidMentionIds: () => new Set() }));
vi.mock("@/services/binderReferenceApi", async (original) => ({ ...await original<typeof import("@/services/binderReferenceApi")>(), fetchBinderReferences: mock.refs }));
vi.mock("@/services/binderLoreApi", () => ({ fetchBinderRecordOptions: async () => [], fetchBinderItems: async () => [{ id: "item", name: "Relic", holder_name: "Keeper", location_name: "Tower" }], fetchBinderEvents: async () => [{ id: "event", title: "Festival", description: null, dateSort: 1, dateText: "Year 1", endDateText: null, records: [], campaigns: [], tags: [] }] }));
vi.mock("@/services/binderMortalApi", () => ({ fetchBinderMortals: async () => [{ id: "pc", name: "Adventurer", mortalType: "player_character", player: { id: "player" }, birthDate: null, deathDate: null, race: null, lifeStatus: "alive" }], fetchMortalOptions: async () => ({ players: [{ id: "player", className: "Wizard", campaignNames: ["Quest"], playerName: "Owner" }] }) }));
vi.mock("@/services/binderApi", () => ({ fetchBinderHealth: mock.health }));
vi.mock("./ReferenceRecordModal", () => ({ ReferenceRecordModal: () => null }));
let host: HTMLDivElement; let root: Root;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
const base = { binderId: "binder", accent: "#fff", canEdit: false, onRecordsChanged: async () => {} };
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  mock.api.mockReset().mockResolvedValue([]);
  mock.refs.mockReset().mockResolvedValue([{ id: "reference", name: "Record", rank: "Greater God", domains: [{ name: "Knowledge" }], usageCount: 2, leader: { name: "Leader" }, description: "Description" }]);
  mock.health.mockReset().mockResolvedValue({ healthy: false, issueCount: 1, groups: [{ code: "review", title: "Review", severity: "warning", issues: [{ id: "record", name: "Record", detail: "Missing description", route: "/binder/binder/mortals/record" }] }] });
  media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }; vi.stubGlobal("matchMedia", () => media);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function render(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: "*", element }], { initialEntries: ["/binder/binder"] });
  await act(async () => root.render(<RouterProvider router={router} />));
  await act(async () => vi.advanceTimersByTimeAsync(400));
  return router;
}
async function resize(matches: boolean) { media.matches = matches; await act(async () => { media.addEventListener.mock.calls.forEach(([, fn]) => fn()); }); }
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent!.includes(text))!;

it.each(["deities", "organizations", "races"] as const)("opens compact %s records and restores sortable desktop headers", async (type) => {
  const router = await render(<ReferenceWorkspace {...base} type={type} />);
  expect(host.querySelector('button[title^="Sort"]')).toBeNull();
  const card = button("Record");
  if (type === "deities") expect(card.textContent).toContain("Knowledge");
  if (type === "organizations") expect(card.textContent).toContain("Leader");
  await act(async () => card.click());
  expect(router.state.location.pathname).toBe(`/binder/binder/${type}/reference`);
  await resize(false);
  expect([...host.querySelectorAll("button")].some((b) => b.title)).toBe(true);
});
it.each(["items", "events"] as const)("retains %s metadata and navigation in compact mode", async (type) => {
  const router = await render(<BinderLoreWorkspace {...base} type={type} campaigns={[]} />);
  const row = button(type === "items" ? "Relic" : "Festival");
  expect(row.textContent).toContain(type === "items" ? "Keeper" : "Year 1");
  await act(async () => row.click());
  expect(router.state.location.pathname).toBe(`/binder/binder/${type}/${type === "items" ? "item" : "event"}`);
});
it("retains player class/campaign/owner metadata and record navigation through resizing", async () => {
  const router = await render(<BinderPlayersWorkspace binderId="binder" accent="#fff" binderCurrentDate={1} />);
  expect(button("Adventurer").textContent).toContain("Wizard");
  expect(button("Adventurer").textContent).toContain("Quest");
  expect(button("Adventurer").textContent).toContain("Owner");
  await act(async () => button("Filters").click());
  expect(button("Hide filters").getAttribute("aria-expanded")).toBe("true");
  await resize(false); expect(host.innerHTML).toContain("1120px");
  await resize(true);
  await act(async () => button("Adventurer").click());
  expect(router.state.location.pathname).toBe("/binder/binder/mortals/pc");
});
it("stacks health issues without changing their correction links", async () => {
  const router = await render(<BinderHealthWorkspace binderId="binder" accent="#fff" />);
  const link = host.querySelector("a")!;
  expect(link.style.gridTemplateColumns).toBe("minmax(0,1fr)");
  expect(link.textContent).toContain("Missing description");
  await act(async () => link.click());
  expect(router.state.location.pathname).toBe("/binder/binder/mortals/record");
});
it("stacks workspace columns without writing layout preferences", async () => {
  const panels = [{ id: "a", title: "First", column: 0, content: <div>First panel</div> }, { id: "b", title: "Second", column: 1, content: <div>Second panel</div> }];
  await render(<DmWorkspace workspace="preview" panels={panels} defaultColumns={2} compact />);
  expect(host.querySelector<HTMLElement>(".dm-workspace-columns")!.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
  expect(host.textContent).toContain("First panel"); expect(host.textContent).toContain("Second panel");
  expect(host.querySelector('button[title="Customize layout"]')).toBeNull();
  expect(mock.api.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});
