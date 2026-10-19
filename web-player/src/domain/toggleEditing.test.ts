// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { editToggleParagraph } from "@beholden/shared/ui/toggleEditing";
import { htmlToMarkdown, markdownToHtml } from "@beholden/shared/ui/markdownHtml";
let editor: HTMLDivElement;
function caret(node: Node, offset = 0) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}
beforeEach(() => {
  document.body.innerHTML = "";
  editor = document.createElement("div");
  editor.innerHTML = "<details open><summary>Backstory</summary><p>First paragraph</p><p>Second paragraph</p></details><p>Outside</p>";
  document.body.append(editor);
});
it("Enter on the header enters its indented content", () => {
  const summary = editor.querySelector("summary")!;
  caret(summary.firstChild!, 9);
  expect(editToggleParagraph(editor, "Enter")).toBe(true);
  expect(window.getSelection()?.anchorNode).toBe(editor.querySelector("details > p"));
});
it("splits a paragraph inside the toggle and preserves following paragraphs", () => {
  caret(editor.querySelector("details > p")!.firstChild!, 5);
  expect(editToggleParagraph(editor, "Enter")).toBe(true);
  expect(Array.from(editor.querySelectorAll("details > p")).map((p) => p.textContent)).toEqual(["First", " paragraph", "Second paragraph"]);
  const saved = htmlToMarkdown(editor);
  editor.innerHTML = markdownToHtml(saved);
  expect(editor.querySelectorAll("details > p")).toHaveLength(3);
  expect(editor.lastElementChild?.textContent).toBe("Outside");
});
it("allows multiple blank paragraphs without leaving the toggle", () => {
  const p = editor.querySelector("details > p")!;
  p.innerHTML = "<br>";
  caret(p);
  expect(editToggleParagraph(editor, "Enter")).toBe(true);
  expect(editor.querySelectorAll("details > p")).toHaveLength(3);
});
it("Backspace at the start removes indentation and ends the toggle without reordering text", () => {
  caret(editor.querySelector("details > p")!.firstChild!);
  expect(editToggleParagraph(editor, "Backspace")).toBe(true);
  expect(editor.querySelectorAll("details > p")).toHaveLength(0);
  expect(Array.from(editor.children).map((p) => p.textContent)).toEqual(["Backstory", "First paragraph", "Second paragraph", "Outside"]);
  const saved = htmlToMarkdown(editor);
  expect(saved.indexOf(":::\nFirst paragraph")).toBeGreaterThan(0);
});
it("leaves ordinary Backspace, Shift+Enter, and lists to native editing", () => {
  caret(editor.querySelector("details > p")!.firstChild!, 3);
  expect(editToggleParagraph(editor, "Backspace")).toBe(false);
  expect(editToggleParagraph(editor, "Enter", true)).toBe(false);
  editor.querySelector("details")!.insertAdjacentHTML("beforeend", "<ul><li>Item</li></ul>");
  caret(editor.querySelector("li")!.firstChild!);
  expect(editToggleParagraph(editor, "Enter")).toBe(false);
});
it("Shift+Tab outdents a paragraph", () => {
  caret(editor.querySelectorAll("details > p")[1].firstChild!, 4);
  expect(editToggleParagraph(editor, "Tab", true)).toBe(true);
  expect(editor.querySelectorAll("details > p")).toHaveLength(1);
  expect(editor.children[1].textContent).toBe("Second paragraph");
});
