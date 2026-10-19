import { selectionRangeInEditor } from "./contentEditableDom";

function placeCaret(node: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** Keep paragraph editing inside a toggle until its indentation is removed. */
export function editToggleParagraph(editor: HTMLElement, key: string, shiftKey = false): boolean {
  const range = selectionRangeInEditor(editor);
  if (!range) return false;
  const start = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as HTMLElement : range.startContainer.parentElement;
  const details = start?.closest("details");
  if (!details || !editor.contains(details)) return false;
  const summary = start?.closest("summary");
  if (summary && key === "Enter" && !shiftKey && range.collapsed) {
    details.open = true;
    let paragraph = summary.nextElementSibling as HTMLElement | null;
    if (!paragraph) {
      paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      details.appendChild(paragraph);
    }
    placeCaret(paragraph);
    return true;
  }
  const block = start?.closest("p,div,h1,h2,h3,h4,h5,h6");
  if (!(block instanceof HTMLElement) || block.parentElement !== details) return false;
  if ((key === "Backspace" && range.collapsed) || (key === "Tab" && shiftKey)) {
    const prefix = range.cloneRange();
    prefix.selectNodeContents(block);
    prefix.setEnd(range.startContainer, range.startOffset);
    if (key === "Backspace" && prefix.toString().length > 0) return false;
    // The outdented paragraph ends the toggle. Following paragraphs keep their
    // order and become siblings, rather than jumping ahead of this paragraph.
    const following: Node[] = [];
    let node: Node | null = block;
    while (node) { following.push(node); node = node.nextSibling; }
    const next = details.nextSibling;
    for (const child of following) details.parentNode?.insertBefore(child, next);
    placeCaret(block);
    return true;
  }
  if (key !== "Enter" || shiftKey || !details.contains(range.endContainer)) return false;
  // Leave lists and cross-block selections to native editing.
  if (!block.contains(range.endContainer)) return false;
  range.deleteContents();
  const tail = range.cloneRange();
  tail.setEnd(block, block.childNodes.length);
  const paragraph = document.createElement("p");
  paragraph.appendChild(tail.extractContents());
  if (!paragraph.textContent && !paragraph.querySelector("br")) paragraph.innerHTML = "<br>";
  if (!block.textContent && !block.querySelector("br")) block.innerHTML = "<br>";
  block.after(paragraph);
  placeCaret(paragraph);
  return true;
}
