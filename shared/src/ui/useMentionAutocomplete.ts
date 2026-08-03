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
  node: Text;
  startOffset: number;
  endOffset: number;
}

/** Looks backward from a collapsed cursor, within its own text node, for an unclosed "@word" --
 * i.e. an "@" at the start of a word (preceded by nothing or whitespace) with no whitespace
 * between it and the cursor. That's the same shape Notion/Slack-style mention triggers use. */
function findMentionTrigger(editor: HTMLElement): MentionTrigger | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return null;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? "";
  const cursor = range.startOffset;
  const at = text.lastIndexOf("@", cursor - 1);
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(text[at - 1]!)) return null;
  const query = text.slice(at + 1, cursor);
  if (/\s/.test(query)) return null;
  return { query, node: node as Text, startOffset: at, endOffset: cursor };
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
  const [mentionTrigger, setMentionTrigger] = React.useState<MentionTrigger | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = React.useState(0);
  const [mentionDropdownPos, setMentionDropdownPos] = React.useState<{ top: number; left: number } | null>(null);

  const filteredMentions = React.useMemo(() => {
    if (!mentionTrigger || !mentions?.length) return [];
    const query = mentionTrigger.query.trim().toLowerCase();
    const options = query
      ? mentions.filter((mention) => mention.label.toLowerCase().includes(query))
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

  const applyMentionAtRange = React.useCallback((mention: MentionOption, range: Range) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !editor.contains(range.commonAncestorContainer)) return;
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
    range.setStartAfter(spacer);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
    setMentionTrigger(null);
    emitChange();
    editor.focus();
  }, [editorRef, emitChange]);

  /** Insert from the toolbar's mention <select> (uses the last saved selection, not a live trigger). */
  const insertMention = React.useCallback((id: string) => {
    const mention = mentions?.find((option) => option.id === id);
    const range = savedRangeRef.current;
    if (!mention || !range) return;
    applyMentionAtRange(mention, range);
  }, [applyMentionAtRange, mentions]);

  const updateMentionTrigger = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const trigger = findMentionTrigger(editor);
    setMentionTrigger(trigger);
    setMentionActiveIndex(0);
    if (!trigger) {
      setMentionDropdownPos(null);
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    // Fixed, viewport-relative positioning (not relative to the wrapper) so the dropdown never
    // gets clipped by the editor's own `overflow: hidden`/scrolling box.
    const caretRect = selection.getRangeAt(0).getBoundingClientRect();
    setMentionDropdownPos({ top: caretRect.bottom + 4, left: caretRect.left });
  }, [editorRef]);

  /** Insert from the inline dropdown (a live trigger derived from cursor position), used by both
   * clicking a dropdown option and pressing Enter/Tab in `handleKeyDown`. */
  const selectMentionFromTrigger = React.useCallback((mention: MentionOption) => {
    const trigger = mentionTrigger;
    if (!trigger) return;
    const range = document.createRange();
    range.setStart(trigger.node, trigger.startOffset);
    range.setEnd(trigger.node, trigger.endOffset);
    applyMentionAtRange(mention, range);
  }, [applyMentionAtRange, mentionTrigger]);

  const clearMentionTrigger = React.useCallback(() => {
    setMentionTrigger(null);
    setMentionDropdownPos(null);
  }, []);

  /** Wire into the editor's onKeyDown. Returns true when it handled the key (arrow nav/select/
   * dismiss while the dropdown is open), so the caller knows not to do anything else with it. */
  const handleMentionKeyDown = React.useCallback((event: React.KeyboardEvent): boolean => {
    if (!mentionTrigger || filteredMentions.length === 0) return false;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMentionActiveIndex((index) => (index + 1) % filteredMentions.length);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setMentionActiveIndex((index) => (index - 1 + filteredMentions.length) % filteredMentions.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      selectMentionFromTrigger(filteredMentions[mentionActiveIndex]!);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      clearMentionTrigger();
      return true;
    }
    return false;
  }, [mentionTrigger, filteredMentions, mentionActiveIndex, selectMentionFromTrigger, clearMentionTrigger]);

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
