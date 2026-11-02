// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlacesWorkspace } from "./PlacesWorkspace";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), translate: (source: string, values?: Record<string, unknown>) => source.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values?.[key] ?? "")) }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => mocks.translate, useUiMessages: () => mocks.translate }));
vi.mock("@/services/binderReferenceApi", () => ({ fetchBinderReferences: mocks.fetch, createBinderReference: vi.fn() }));
vi.mock("./ReferenceRecordModal", () => ({ ReferenceRecordModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>Creation drawer</div> : null }));

const continent = { id: "continent", name: "A very long continent name", parent: null, usageCount: 2 };
const country = { id: "country", name: "Country", parent: { id: "continent", name: continent.name, type: "continent" }, usageCount: 1 };
const location = { id: "location", name: "Location", parent: { id: "country", name: country.name, type: "country" }, usageCount: 0 };
const other = { id: "other", name: "Other continent", parent: null, usageCount: 0 };
let root: Root;
let host: HTMLDivElement;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  localStorage.clear();
  media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", () => media);
  mocks.fetch.mockReset().mockImplementation(async (_binder: string, type: string) => ({ continents: [continent, other], countries: [country], locations: [location] })[type] ?? []);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function setup(canEdit = false) {
  const router = createMemoryRouter([{ path: "*", element: <PlacesWorkspace binderId="binder" accent="#fff" canEdit={canEdit} onRecordsChanged={async () => {}} /> }], { initialEntries: ["/binder/binder/places"] });
  await act(async () => root.render(<RouterProvider router={router} />));
  return router;
}
async function click(text: string) { await act(async () => { [...host.querySelectorAll("button")].find((button) => button.textContent === text)!.click(); }); }
async function resize(matches: boolean) { media.matches = matches; await act(async () => { media.addEventListener.mock.calls.forEach(([, listener]) => listener()); }); }
const links = () => [...host.querySelectorAll("a")];

it("renders compact cards and toggles filters while retaining separate parent filtering and record links", async () => {
  const router = await setup();
  expect(links()).toHaveLength(4);
  expect(host.querySelector('[role="link"]')).toBeNull();
  const toggle = [...host.querySelectorAll("button")].find((button) => button.textContent === "Filters")!;
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.getElementById(toggle.getAttribute("aria-controls")!)!.hidden).toBe(true);
  await click("Filters");
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  await act(async () => { host.querySelector<HTMLButtonElement>(`button[title="Within: ${continent.name}"]`)!.click(); });
  expect(router.state.location.pathname).toBe("/binder/binder/places");
  expect(links()).toHaveLength(3);
  expect(links().some((link) => link.textContent!.includes(other.name))).toBe(false);
  expect(JSON.parse(localStorage.getItem("binder:binder:places-filters")!).filters.continents).toEqual([continent.id]);
  await act(async () => { links().find((link) => link.getAttribute("href")!.endsWith("/locations/location"))!.click(); });
  expect(router.state.location.pathname).toBe("/binder/binder/locations/location");
});

it("keeps hierarchy filtering through desktop/mobile changes and restores desktop rows", async () => {
  await setup();
  await act(async () => { host.querySelector<HTMLButtonElement>(`button[title="Within: ${continent.name}"]`)!.click(); });
  await resize(false);
  expect(host.querySelectorAll('[role="link"]')).toHaveLength(3);
  expect(host.querySelector<HTMLElement>('[role="link"]')!.style.gridTemplateColumns).toBe("minmax(240px,1.4fr) 170px minmax(220px,1fr) 110px");
  expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Filters")).toBe(false);
  await resize(true);
  expect(links()).toHaveLength(3);
  const chip = [...host.querySelectorAll<HTMLButtonElement>("button[aria-label]")].find((button) => button.getAttribute("aria-label")!.startsWith("Remove Continent"))!;
  await act(async () => chip.click());
  expect(links()).toHaveLength(4);
});

it("keeps create controls permission-gated and opens the existing drawer", async () => {
  await setup(true);
  const button = [...host.querySelectorAll("button")].find((button) => button.textContent!.trim() === "New Place")!;
  await act(async () => button.click());
  expect(host.textContent).toContain("Creation drawer");
});

it("shows load failures and empty results in compact mode", async () => {
  mocks.fetch.mockRejectedValueOnce(new Error("Offline"));
  await setup();
  expect(host.textContent).toContain("Offline");
  expect(links()).toHaveLength(0);
  expect([...host.querySelectorAll("button")].some((button) => button.textContent!.trim() === "New Place")).toBe(false);
  await act(async () => root.unmount());
  root = createRoot(host);
  mocks.fetch.mockResolvedValue([]);
  await setup();
  expect(host.textContent).toContain("No Places match the current search.");
});
