// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Modal } from "./Modal";
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (source: string) => source }));
let host: HTMLDivElement; let root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("portals outside the parent, contains focus, closes only the top modal and restores scrolling/focus", async () => {
  function Harness() {
    const [open, setOpen] = useState(false); const [nested, setNested] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open</button><Modal isOpen={open} title="Outer" onClose={() => setOpen(false)}><input aria-label="Name" /><button onClick={() => setNested(true)}>Nested</button><Modal isOpen={nested} title="Inner" onClose={() => setNested(false)}><input aria-label="Inner name" /></Modal></Modal></>;
  }
  await act(async () => root.render(<Harness />));
  const trigger = host.querySelector("button")!; trigger.focus();
  await act(async () => trigger.click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.style.overflow).toBe("hidden");
  const name = document.querySelector<HTMLInputElement>('[aria-label="Name"]')!;
  expect(document.activeElement).toBe(name);
  const nestedButton = [...document.querySelectorAll("button")].find((button) => button.textContent === "Nested")!;
  nestedButton.focus();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  expect((document.activeElement as HTMLElement).title).toBe("Close");
  await act(async () => nestedButton.click());
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(document.body.style.overflow).toBe("hidden");
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.style.overflow).toBe(""); expect(document.activeElement).toBe(trigger);
});
it("tracks the visual viewport when the keyboard reduces usable height", async () => {
  let resize = () => {};
  const visual = { width: 390, height: 750, offsetTop: 0, offsetLeft: 0, addEventListener: (_: string, listener: () => void) => { resize = listener; }, removeEventListener: vi.fn() };
  vi.stubGlobal("visualViewport", visual);
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  await act(async () => root.render(<Modal isOpen title="Popup" onClose={vi.fn()}><div>Content</div></Modal>));
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.style.maxHeight).toBe("734px");
  await act(async () => { visual.height = 330; resize(); });
  expect(dialog.style.maxHeight).toBe("314px");
  expect(document.querySelectorAll('button[title="Close"]')).toHaveLength(1);
});
