// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";
import { FooterGrid } from "@beholden/shared/ui/FooterGrid";
const mock = vi.hoisted(() => ({ logout: vi.fn(), translate: (s: string) => s, user: { name: "Owner", isAdmin: true } }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => mock.translate }));
vi.mock("@/store", () => ({ useStore: () => ({ state: { campaigns: [{ id: "quest", name: "A long campaign name", ruleset: "5.5e" }], selectedCampaignId: "quest" } }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mock.user, logout: mock.logout }) }));
vi.mock("@/services/ws", () => ({ useWs: () => {}, useWsStatus: () => true }));
vi.mock("@/tools/DiceCalculatorModal", () => ({ DiceCalculatorModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog">Dice tool</div> : null }));
let root: Root; let host: HTMLDivElement;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  mock.logout.mockClear(); media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }; vi.stubGlobal("matchMedia", () => media);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function setup() { const router = createMemoryRouter([{ path: "*", element: <TopBar /> }], { initialEntries: ["/"] }); await act(async () => root.render(<RouterProvider router={router} />)); return router; }
async function openMenu() { const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Open navigation menu"]')!; trigger.focus(); await act(async () => trigger.click()); return trigger; }
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Navigation"]')!;

it("closes navigation after a route choice and supports Escape with focus restoration", async () => {
  const router = await setup(); const trigger = await openMenu();
  expect(trigger.getAttribute("aria-expanded")).toBe("true"); expect(document.body.style.overflow).toBe("hidden");
  await act(async () => { [...dialog().querySelectorAll("a")].find((a) => a.textContent === "Compendium")!.click(); });
  expect(router.state.location.pathname).toBe("/compendium"); expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await openMenu();
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(trigger.getAttribute("aria-expanded")).toBe("false"); expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).not.toBe("hidden");
});
it("traps keyboard focus in the menu and keeps tool dialogs visible after menu dismissal", async () => {
  await setup(); const trigger = await openMenu();
  const close = dialog().querySelector<HTMLButtonElement>('button[aria-label="Close navigation menu"]')!; close.focus();
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
  expect(document.activeElement?.textContent).toBe("Sign out");
  await act(async () => { [...dialog().querySelectorAll("button")].find((b) => b.textContent!.includes("Dice Calculator"))!.click(); });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  const tool = [...document.querySelectorAll('[role="dialog"]')].find((node) => node.textContent === "Dice tool")!;
  expect(tool).toBeTruthy(); expect(tool.closest("[hidden]")).toBeNull();
});
it("keeps account/admin/logout actions and desktop controls available", async () => {
  await setup(); await openMenu();
  expect(dialog().querySelector('a[href="/profile"]')).not.toBeNull(); expect(dialog().querySelector('a[href="/admin"]')).not.toBeNull();
  await act(async () => { [...dialog().querySelectorAll("button")].find((b) => b.textContent === "Sign out")!.click(); }); expect(mock.logout).toHaveBeenCalledOnce();
  media.matches = false; await act(async () => { media.addEventListener.mock.calls.forEach(([, fn]) => fn()); });
  expect(host.querySelector('button[aria-label="Open navigation menu"]')).toBeNull();
  expect(host.querySelector('a[href="/compendium"]')).not.toBeNull();
});
it("collapses footer details without removing attribution, links or server information", async () => {
  await act(async () => root.render(<FooterGrid borderColor="#aaa" background="#111" color="#fff" mobileSummary="Copyright" mobileVersion="v1.5.0" left={<span>Attribution</span>} centerLeft={<a href="#about">About</a>} centerRight={<button>Support</button>} right={<span>Server details</span>} />));
  const toggle = host.querySelector("button")!; const region = host.querySelector<HTMLElement>('[role="region"]')!;
  expect(region.hidden).toBe(true); expect(toggle.getAttribute("aria-expanded")).toBe("false");
  await act(async () => toggle.click()); expect(region.hidden).toBe(false); expect(region.textContent).toContain("Attribution"); expect(region.textContent).toContain("Server details");
  await act(async () => host.querySelector("a")!.click()); expect(region.hidden).toBe(true);
  await act(async () => toggle.click());
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(region.hidden).toBe(true);
  media.matches = false; await act(async () => { media.addEventListener.mock.calls.forEach(([, fn]) => fn()); });
  expect(host.querySelector('[role="region"]')).toBeNull(); expect(host.textContent).toContain("Attribution");
});
