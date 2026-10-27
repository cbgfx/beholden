// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { InventoryItemDrawer } from "./CharacterInventoryDrawer";
import { ItemFormModal } from "@beholden/shared/views/item-editor/ItemFormModal";

vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => (s: string) => s,
  useUiMessages: () => (s: string) => s,
}));

async function enter(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("submits the description typed into the player new-item form", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  try {
    await act(async () => root.render(<ItemFormModal item={null} createOnly request={vi.fn()} onClose={() => {}} onSaved={() => {}} onSubmit={onSubmit} />));
    await enter(host.querySelector("input")!, "Keepsake");
    await enter(host.querySelector("textarea")!, "First paragraph.\n\nSecond paragraph.");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ description: ["First paragraph.", "Second paragraph."] }));
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("saves description edits, including an explicitly cleared description", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const onSave = vi.fn().mockResolvedValue(undefined);
  try {
    await act(async () => root.render(<InventoryItemDrawer
      item={{ id: "custom", name: "Keepsake", source: "custom", quantity: 1, equipped: false, description: "Old description" }}
      containers={[]} detail={null} busy={false} accentColor="#fff" otherAttunedCount={0} editMode canDesignatePactWeapon={false}
      onStartEdit={() => {}} onCancelEdit={() => {}} onClose={() => {}} onSave={onSave} onMoveToContainer={async () => {}} onChargesChange={() => {}}
    />));
    const save = () => Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Save")!.click();
    await enter(host.querySelector("textarea")!, "Updated description");
    await act(async () => save());
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ description: "Updated description" }));
    await enter(host.querySelector("textarea")!, "");
    await act(async () => save());
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ description: "" }));
  } finally { await act(async () => root.unmount()); host.remove(); }
});
