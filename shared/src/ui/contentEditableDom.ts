/** Generic contenteditable/selection helpers for WysiwygNoteEditor. No React dependency -- these
 * operate on the DOM `Range`/`Selection` APIs directly. */

export function selectionRangeInEditor(editor: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;
  return range;
}

export function closestInlineFormat(range: Range, editor: HTMLElement, tagName: string): HTMLElement | null {
  const tag = tagName.toLowerCase();
  const start = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as HTMLElement
    : range.startContainer.parentElement;
  const end = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer as HTMLElement
    : range.endContainer.parentElement;
  const startMatch = start?.closest(tag);
  const endMatch = end?.closest(tag);

  if (!startMatch || startMatch !== endMatch || !editor.contains(startMatch)) return null;
  return startMatch as HTMLElement;
}

export function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

export function selectNodeContents(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function insertPlainTextAtSelection(editor: HTMLElement, text: string) {
  const selection = window.getSelection();
  const range = selectionRangeInEditor(editor);
  if (!selection || !range) return;

  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
