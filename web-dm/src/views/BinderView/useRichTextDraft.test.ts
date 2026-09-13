// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { useRichTextDraft } from "./useRichTextDraft";
let root: Root | undefined;
let host: HTMLDivElement;
let field: ReturnType<typeof useRichTextDraft>;
let renders: number;
function Harness({ value, save }: { value: string | null; save: (value: string | null) => Promise<void> }) {
  field = useRichTextDraft(value, save); renders++; return null;
}
function render(value: string | null, save: (value: string | null) => Promise<void>) {
  act(() => root!.render(createElement(I18nextProvider, { i18n }, createElement(Harness, { value, save }))));
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); renders = 0;
});
afterEach(() => { if (root) act(() => root!.unmount()); root = undefined; host.remove(); vi.unstubAllGlobals(); });
it("preserves a draft across background refreshes and cancels to the latest saved value", () => {
  const save = vi.fn(); render("original", save);
  act(() => field.startEditing()); act(() => field.setDraft("unsaved"));
  render("remote update", save);
  expect(field.draft).toBe("unsaved");
  act(() => field.cancel());
  expect(field.draft).toBe("remote update");
});
it("keeps edits made during a save and prevents duplicate submissions", async () => {
  let resolve!: () => void;
  const save = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  render("original", save);
  act(() => { field.startEditing(); field.setDraft("submitted"); });
  let pending!: Promise<void>;
  act(() => { pending = field.save(); });
  await act(() => field.save());
  act(() => field.setDraft("newer typing"));
  await act(async () => { resolve(); await pending; });
  render("submitted", save);
  expect(field.editing).toBe(true); expect(field.draft).toBe("newer typing");
  expect(save).toHaveBeenCalledExactlyOnceWith("submitted");
});
it("shows failures without discarding the draft and allows retry", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
  render(null, save);
  act(() => { field.startEditing(); field.setDraft("text"); });
  await act(() => field.save());
  expect(field.error).toBe("offline"); expect(field.draft).toBe("text"); expect(field.editing).toBe(true);
  await act(() => field.save()); render("text", save);
  expect(field.error).toBeNull(); expect(field.editing).toBe(false);
});
it("ignores a save completion after unmount", async () => {
  let resolve!: () => void;
  render("original", () => new Promise<void>(done => { resolve = done; }));
  act(() => field.startEditing());
  let pending!: Promise<void>;
  act(() => { pending = field.save(); });
  act(() => root!.unmount()); root = undefined;
  const before = renders;
  await act(async () => { resolve(); await pending; });
  expect(renders).toBe(before);
});
