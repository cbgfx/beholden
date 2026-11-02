// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
const mock = vi.hoisted(() => ({ logout: vi.fn(), translate: (s: string) => s }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => mock.translate }));
vi.mock("@beholden/shared/ui/useUpdateCheck", () => ({ useUpdateCheck: () => ({ currentVersion: "1.5.0", updateAvailable: false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { name: "Player account" }, logout: mock.logout }) }));
vi.mock("@/services/api", () => ({ api: async () => ({ support: true }) }));
vi.mock("@/services/actorApi", () => ({ fetchMyCharacters: async () => [{ id: "hero", name: "Hero" }] }));
vi.mock("@/services/ws", () => ({ useWsStatus: () => true }));
vi.mock("@/tools/DiceCalculatorModal", () => ({ DiceCalculatorModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog">Player dice</div> : null }));

it("keeps navigation/account/tools behind the burger and collapses footer information", async () => {
  localStorage.setItem("beholden:lastCharacter", JSON.stringify({ id: "hero", name: "Hero" }));
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }; vi.stubGlobal("matchMedia", () => media);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const router = createMemoryRouter([{ path: "*", element: <AppShell><div>Page content</div></AppShell> }], { initialEntries: ["/"] });
  try {
    await act(async () => root.render(<RouterProvider router={router} />));
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Open navigation menu"]')!;
    expect(trigger).toBeTruthy();
    expect(host.querySelector("header nav")).toBeNull();
    const footer = host.querySelector<HTMLElement>('footer [role="region"]')!;
    expect(footer.hidden).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>("footer button")!.click());
    expect(footer.hidden).toBe(false); expect(footer.textContent).toContain("Icons made by");
    await act(async () => trigger.click());
    const dialog = document.querySelector<HTMLElement>('[aria-label="Navigation"][role="dialog"]')!;
    expect(dialog.querySelector('a[href="/characters/hero"]')).not.toBeNull();
    await act(async () => dialog.querySelector<HTMLAnchorElement>('a[href="/characters/hero"]')!.click());
    expect(host.querySelector("footer")).toBeNull();
    await act(async () => trigger.click());
    await act(async () => dialog.querySelector<HTMLAnchorElement>('a[href="/compendium"]')!.click());
    expect(router.state.location.pathname).toBe("/compendium"); expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await act(async () => trigger.click());
    await act(async () => { [...dialog.querySelectorAll("button")].find((b) => b.textContent!.includes("Dice Calculator"))!.click(); });
    expect(trigger.getAttribute("aria-expanded")).toBe("false"); expect(host.textContent).toContain("Player dice");
    await act(async () => trigger.click());
    await act(async () => { [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Sign out")!.click(); }); expect(mock.logout).toHaveBeenCalledOnce();
    media.matches = false; await act(async () => { media.addEventListener.mock.calls.forEach(([, fn]) => fn()); });
    expect(host.querySelector('button[aria-label="Open navigation menu"]')).toBeNull();
    expect(host.querySelector("header nav")).not.toBeNull(); expect(host.querySelector('footer [role="region"]')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); }
});
