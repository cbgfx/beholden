// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MortalRecordModal } from "./MortalRecordModal";
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (s: string) => s, useUiMessages: () => (s: string) => s }));
it("calculates a birth year from age, including when the current date arrives later", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const props = { isOpen: true, record: null, options: { records: [], players: [], monsters: [] }, onClose: vi.fn(), onSave: vi.fn() };
  try {
    await act(async () => root.render(<MortalRecordModal {...props} binderCurrentDate={null} />));
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Age"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "24");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.body.textContent).toContain("Set the current date");
    await act(async () => root.render(<MortalRecordModal {...props} binderCurrentDate={1500} />));
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Date of birth"]')!.value).toBe("1476");
    expect(input.value).toBe("24");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
