// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WysiwygNoteEditor } from "@beholden/shared/ui/WysiwygNoteEditor";
import { ModalFrame } from "@beholden/shared/ui/ModalFrame";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => (key: string) => key,
}));
const options = [
  {
    id: "diego",
    label: "Brother Diego",
    href: "/binder/b/mortals/diego",
    type: "Mortal",
  },
  {
    id: "dragon",
    label: "Black Dragon",
    href: "/binder/b/mortals/dragon",
    type: "Mortal",
  },
];
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function Note({
  modal = false,
  close = () => {},
}: {
  modal?: boolean;
  close?: () => void;
}) {
  const [value, setValue] = useState("");
  const editor = (
    <>
      <WysiwygNoteEditor
        value={value}
        onChange={setValue}
        mentions={options}
        theme={{
          radius: 8,
          panelBorder: "#333",
          inputBg: "#111",
          text: "#fff",
        }}
      />
      <output>{value}</output>
    </>
  );
  return modal ? (
    <ModalFrame isOpen title="Note" onClose={close}>
      {editor}
    </ModalFrame>
  ) : (
    editor
  );
}
async function render(modal = false, close?: () => void) {
  await act(async () => root.render(<Note modal={modal} close={close} />));
}
const editor = () =>
  document.querySelector<HTMLElement>('[contenteditable="true"]')!;
async function type(html: string, elementCaret = false) {
  await act(async () => {
    const node = editor();
    node.focus();
    node.innerHTML = html;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (!elementCaret) {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let text: Text | null = null;
      while (walker.nextNode()) text = walker.currentNode as Text;
      if (text) range.setStart(text, text.length);
    }
    range.collapse(elementCaret ? false : true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    node.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
}
async function key(value: string) {
  await act(async () =>
    editor().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
}
it("opens immediately at @ without leaving the editor and inserts the keyboard-selected record", async () => {
  await render();
  await type("Meet @");
  expect(host.querySelector('[role="listbox"]')).toBeNull();
  expect(document.querySelectorAll('[role="option"]')).toHaveLength(2);
  expect(document.activeElement).toBe(editor());
  await key("ArrowDown");
  await key("Enter");
  expect(editor().querySelector("a")!.dataset.binderRecordId).toBe("dragon");
  expect(editor().textContent).toBe("Meet Black Dragon ");
  expect(host.querySelector("output")!.textContent).toContain(
    "[Black Dragon](/binder/b/mortals/dragon)",
  );
  expect(document.querySelector('[role="listbox"]')).toBeNull();
});
it("matches multiword names across formatting nodes and supports an element-boundary caret", async () => {
  await render();
  await type("<p>Meet @Brother <strong>Die</strong></p>", true);
  expect(document.querySelectorAll('[role="option"]')).toHaveLength(1);
  await key("Tab");
  expect(editor().querySelector("a")!.textContent).toBe("Brother Diego");
  expect(editor().textContent).toBe("Meet Brother Diego ");
  await type("mail@example.com");
  expect(document.querySelector('[role="listbox"]')).toBeNull();
});
it("keeps the popup above the modal and consumes Escape before closing the editor dialog", async () => {
  const close = vi.fn();
  await render(true, close);
  await type("@unknown");
  const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
  expect(list.style.zIndex).toBe("20000");
  expect(list.closest('[role="dialog"]')).toBeNull();
  expect(list.querySelector('[role="status"]')).not.toBeNull();
  await key("Escape");
  expect(close).not.toHaveBeenCalled();
  expect(document.querySelector('[role="listbox"]')).toBeNull();
  await key("Escape");
  expect(close).toHaveBeenCalledOnce();
});
it("clamps the menu to the visible keyboard viewport", async () => {
  const viewport = Object.assign(new EventTarget(), {
    width: 390,
    height: 760,
    offsetTop: 0,
    offsetLeft: 0,
  });
  vi.stubGlobal("visualViewport", viewport);
  await render();
  editor().getBoundingClientRect = () => new DOMRect(380, 730, 0, 18);
  await type("@");
  const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
  expect(
    Number.parseFloat(list.style.left) + Number.parseFloat(list.style.width),
  ).toBeLessThanOrEqual(382);
  await act(async () => {
    viewport.height = 300;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(
    Number.parseFloat(list.style.top) + Number.parseFloat(list.style.maxHeight),
  ).toBeLessThanOrEqual(292);
});
it("leaves @ as ordinary text when the editor has no record source", async () => {
  await act(async () => root.render(<WysiwygNoteEditor value="" onChange={vi.fn()} theme={{ radius: 8, panelBorder: "#333", inputBg: "#111", text: "#fff" }} />));
  await type("@hello");
  expect(document.querySelector('[role="listbox"]')).toBeNull();
  const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  await act(async () => editor().dispatchEvent(escape));
  expect(escape.defaultPrevented).toBe(false);
});
