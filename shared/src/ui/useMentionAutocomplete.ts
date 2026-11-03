import React from "react";
import { selectionRangeInEditor } from "./contentEditableDom";

export interface MentionOption {
  id: string;
  label: string;
  href: string;
  type?: string;
}

interface MentionTrigger {
  query: string;
  range: Range;
}

/** Read the current paragraph rather than only the caret's text node: formatting and paste
 * can split a name into several nodes or leave the caret on an element boundary. */
function findMentionTrigger(editor: HTMLElement): MentionTrigger | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return null;
  const caret = selection.getRangeAt(0);
  if (!editor.contains(caret.startContainer)) return null;
  const element =
    caret.startContainer.nodeType === Node.ELEMENT_NODE
      ? (caret.startContainer as HTMLElement)
      : caret.startContainer.parentElement;
  if (element?.closest('a, [contenteditable="false"]')) return null;
  const block =
    element?.closest("p,div,li,summary,h1,h2,h3,h4,h5,h6") ?? editor;
  if (!editor.contains(block)) return null;
  const before = caret.cloneRange();
  before.setStart(block, 0);
  const text = before.toString();
  const match = /(?:^|[\s([{])@([^@\n]{0,80})$/.exec(text);
  if (!match) return null;
  const offset = text.lastIndexOf("@");
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (remaining <= node.length) {
      const range = caret.cloneRange();
      range.setStart(node, remaining);
      return { query: match[1]!, range };
    }
    remaining -= node.length;
  }
  return null;
}

/** Owns the whole "@ mention" feature for WysiwygNoteEditor: trigger detection as the user types,
 * the filtered dropdown, keyboard navigation, and insertion (both from the inline dropdown and
 * from the toolbar's mention <select>). The editor component only needs to wire these handlers
 * into its contentEditable's event props and render the returned dropdown state. */
export function useMentionAutocomplete(args: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  mentions: MentionOption[] | undefined;
  emitChange: () => void;
}) {
  const { editorRef, mentions, emitChange } = args;
  const savedRangeRef = React.useRef<Range | null>(null);
  const queryRef = React.useRef<string | null>(null);
  const [mentionTrigger, setMentionTrigger] =
    React.useState<MentionTrigger | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = React.useState(0);
  const [mentionDropdownPos, setMentionDropdownPos] = React.useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const filteredMentions = React.useMemo(() => {
    if (!mentionTrigger || !mentions?.length) return [];
    const query = mentionTrigger.query.trim().toLowerCase();
    const options = query
      ? mentions.filter((mention) =>
          mention.label.toLowerCase().includes(query),
        )
      : mentions;
    return options.slice(0, 8);
  }, [mentionTrigger, mentions]);

  /** Call from the editor's general selection-changing handlers (mouseup/keyup) so a saved range
   * is available for the toolbar's mention <select>, which steals focus/selection on open. */
  const saveSelection = React.useCallback(() => {
    const editor = editorRef.current;
    const range = editor ? selectionRangeInEditor(editor) : null;
    if (range) savedRangeRef.current = range.cloneRange();
  }, [editorRef]);

  const applyMentionAtRange = React.useCallback(
    (mention: MentionOption, range: Range) => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (
        !editor ||
        !selection ||
        !editor.contains(range.commonAncestorContainer)
      )
        return;
      range.deleteContents();
      const anchor = document.createElement("a");
      anchor.href = mention.href;
      anchor.dataset.binderRecordId = mention.id;
      // "@" is only the trigger that opens the mention picker -- it must not end up baked into the
      // stored label, or every render (chip text, backlinks, search) carries a literal "@" forever.
      anchor.textContent = mention.label;
      range.insertNode(anchor);
      const spacer = document.createTextNode(" ");
      anchor.after(spacer);
      range.setStart(spacer, spacer.length);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      savedRangeRef.current = range.cloneRange();
      setMentionTrigger(null);
      emitChange();
      editor.focus();
    },
    [editorRef, emitChange],
  );

  /** Insert from the toolbar's mention <select> (uses the last saved selection, not a live trigger). */
  const insertMention = React.useCallback(
    (id: string) => {
      const mention = mentions?.find((option) => option.id === id);
      const range = savedRangeRef.current;
      if (!mention || !range) return;
      applyMentionAtRange(mention, range);
    },
    [applyMentionAtRange, mentions],
  );

  const updateMentionTrigger = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !mentions) {
      setMentionTrigger(null);
      setMentionDropdownPos(null);
      return;
    }
    const trigger = findMentionTrigger(editor);
    setMentionTrigger(trigger);
    if (queryRef.current !== (trigger?.query ?? null)) setMentionActiveIndex(0);
    queryRef.current = trigger?.query ?? null;
    if (!trigger) {
      setMentionDropdownPos(null);
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    // Fixed, viewport-relative positioning (not relative to the wrapper) so the dropdown never
    // gets clipped by the editor's own `overflow: hidden`/scrolling box.
    const caretRange = selection.getRangeAt(0);
    const measured = caretRange.getBoundingClientRect?.();
    const caretRect = measured?.height
      ? measured
      : editor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
    const topEdge = (viewport?.offsetTop ?? 0) + 8;
    const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
    const width = Math.max(0, Math.min(320, rightEdge - leftEdge));
    const below = bottomEdge - caretRect.bottom - 4;
    const above = caretRect.top - topEdge - 4;
    const openAbove = below < 160 && above > below;
    const maxHeight = Math.max(44, Math.min(240, openAbove ? above : below));
    const top = openAbove
      ? caretRect.top - maxHeight - 4
      : caretRect.bottom + 4;
    setMentionDropdownPos({
      top: Math.max(topEdge, Math.min(top, bottomEdge - maxHeight)),
      left: Math.max(leftEdge, Math.min(caretRect.left, rightEdge - width)),
      width,
      maxHeight,
    });
  }, [editorRef, mentions]);

  /** Insert from the inline dropdown (a live trigger derived from cursor position), used by both
   * clicking a dropdown option and pressing Enter/Tab in `handleKeyDown`. */
  const selectMentionFromTrigger = React.useCallback(
    (mention: MentionOption) => {
      const trigger = mentionTrigger;
      if (!trigger) return;
      const range = trigger.range.cloneRange();
      applyMentionAtRange(mention, range);
    },
    [applyMentionAtRange, mentionTrigger],
  );

  const clearMentionTrigger = React.useCallback(() => {
    setMentionTrigger(null);
    setMentionDropdownPos(null);
  }, []);

  /** Wire into the editor's onKeyDown. Returns true when it handled the key (arrow nav/select/
   * dismiss while the dropdown is open), so the caller knows not to do anything else with it. */
  const handleMentionKeyDown = React.useCallback(
    (event: React.KeyboardEvent): boolean => {
      if (event.nativeEvent.isComposing || !mentionTrigger) return false;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        clearMentionTrigger();
        return true;
      }
      if (filteredMentions.length === 0) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionActiveIndex((index) => (index + 1) % filteredMentions.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionActiveIndex(
          (index) =>
            (index - 1 + filteredMentions.length) % filteredMentions.length,
        );
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectMentionFromTrigger(filteredMentions[mentionActiveIndex]!);
        return true;
      }
      return false;
    },
    [
      mentionTrigger,
      filteredMentions,
      mentionActiveIndex,
      selectMentionFromTrigger,
      clearMentionTrigger,
    ],
  );

  const open = Boolean(mentionTrigger);
  React.useEffect(() => {
    if (!open) return;
    const update = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-mention-suggestions]")
      )
        return;
      updateMentionTrigger();
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open, updateMentionTrigger]);

  return {
    mentionTrigger,
    mentionActiveIndex,
    setMentionActiveIndex,
    mentionDropdownPos,
    filteredMentions,
    saveSelection,
    updateMentionTrigger,
    selectMentionFromTrigger,
    insertMention,
    clearMentionTrigger,
    handleMentionKeyDown,
  };
}
