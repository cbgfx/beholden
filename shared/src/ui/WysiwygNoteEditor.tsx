import { createPortal } from "react-dom";
import React from "react";
import { editToggleParagraph } from "./toggleEditing";
import { useTranslation } from "react-i18next";
import { markdownToHtml, htmlToMarkdown } from "./markdownHtml";
import {
  selectionRangeInEditor,
  closestInlineFormat,
  unwrapElement,
  selectNodeContents,
  insertPlainTextAtSelection,
} from "./contentEditableDom";
import {
  useMentionAutocomplete,
  type MentionOption,
} from "./useMentionAutocomplete";

type EditorTheme = {
  radius: string | number;
  panelBorder: string;
  inputBg: string;
  text: string;
};

function toolbarButtonStyle(theme: EditorTheme): React.CSSProperties {
  return {
    minWidth: 30,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    border: `1px solid ${theme.panelBorder}`,
    background: "rgba(255,255,255,0.06)",
    color: theme.text,
    cursor: "pointer",
    fontSize: "var(--fs-small)",
    fontWeight: 800,
    lineHeight: 1,
  };
}

export function WysiwygNoteEditor(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  theme: EditorTheme;
  style?: React.CSSProperties;
  mentions?: MentionOption[];
}) {
  const { t } = useTranslation("shared");
  const { onChange, value } = props;
  const editorRef = React.useRef<HTMLDivElement>(null);
  const focusedRef = React.useRef(false);
  const htmlRef = React.useRef("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [isEmpty, setIsEmpty] = React.useState(() => !value.trim());
  const buttonStyle = toolbarButtonStyle(props.theme);
  const mentionListId = React.useId();
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || focusedRef.current) return;
    const nextHtml = markdownToHtml(value);
    if (htmlRef.current === nextHtml) return;
    editor.innerHTML = nextHtml;
    htmlRef.current = nextHtml;
    setIsEmpty(!value.trim());
  }, [value]);

  const emitChange = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    htmlRef.current = editor.innerHTML;
    const nextValue = htmlToMarkdown(editor);
    setIsEmpty(!nextValue.trim());
    onChange(nextValue);
  }, [onChange]);

  const mention = useMentionAutocomplete({
    editorRef,
    mentions: props.mentions,
    emitChange,
  });
  React.useEffect(() => {
    document
      .getElementById(`${mentionListId}-${mention.mentionActiveIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [mentionListId, mention.mentionActiveIndex]);

  const applyInlineFormat = React.useCallback(
    (tagName: "strong" | "em" | "u") => {
      const editor = editorRef.current;
      const range = editor ? selectionRangeInEditor(editor) : null;
      if (!editor || !range || range.collapsed) {
        editor?.focus();
        return;
      }

      const existing = closestInlineFormat(range, editor, tagName);
      if (existing) {
        unwrapElement(existing);
        emitChange();
        editor.focus();
        return;
      }

      const wrapper = document.createElement(tagName);
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
      selectNodeContents(wrapper);
      emitChange();
      editor.focus();
    },
    [emitChange],
  );

  const runBlockCommand = React.useCallback(
    (command: string, value?: string) => {
      document.execCommand(command, false, value);
      emitChange();
      editorRef.current?.focus();
    },
    [emitChange],
  );

  const toggleHeading = React.useCallback(() => {
    const editor = editorRef.current;
    const range = editor ? selectionRangeInEditor(editor) : null;
    if (!editor || !range) {
      editor?.focus();
      return;
    }
    const start =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement;
    const existing = start?.closest("details");
    if (existing && editor.contains(existing)) {
      const summary = Array.from(existing.children).find(
        (child) => child.tagName.toLowerCase() === "summary",
      );
      const heading = document.createElement("h2");
      heading.innerHTML =
        summary?.innerHTML || t("wysiwygEditor.toggleFallback");
      existing.parentNode?.insertBefore(heading, existing);
      for (const child of Array.from(existing.childNodes)) {
        if (child !== summary)
          existing.parentNode?.insertBefore(child, existing);
      }
      existing.remove();
      selectNodeContents(heading);
      emitChange();
      editor.focus();
      return;
    }

    const block = start?.closest("h1,h2,h3,h4,h5,h6,p,div");
    if (!block || block === editor || !editor.contains(block)) return;
    const details = document.createElement("details");
    details.open = true;
    const summary = document.createElement("summary");
    summary.innerHTML = block.innerHTML || t("wysiwygEditor.toggleHeading");
    details.appendChild(summary);

    const headingMatch = block.tagName.match(/^H([1-6])$/);
    if (headingMatch) {
      const level = Number(headingMatch[1]);
      let sibling = block.nextSibling;
      while (sibling) {
        const next = sibling.nextSibling;
        const siblingLevel =
          sibling instanceof HTMLElement
            ? Number(sibling.tagName.match(/^H([1-6])$/)?.[1] ?? 99)
            : 99;
        if (siblingLevel <= level) break;
        details.appendChild(sibling);
        sibling = next;
      }
    } else {
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      details.appendChild(paragraph);
    }
    block.parentNode?.replaceChild(details, block);
    selectNodeContents(summary);
    emitChange();
    editor.focus();
  }, [emitChange, t]);

  return (
    <div
      ref={wrapperRef}
      style={{
        border: `1px solid ${props.theme.panelBorder}`,
        borderRadius: props.theme.radius,
        background: props.theme.inputBg,
        overflow: "hidden",
        position: "relative",
        ...(props.style ?? {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 6,
          borderBottom: `1px solid ${props.theme.panelBorder}`,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          title={t("wysiwygEditor.bold")}
          aria-label={t("wysiwygEditor.bold")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyInlineFormat("strong")}
          style={buttonStyle}
        >
          B
        </button>
        <button
          type="button"
          title={t("wysiwygEditor.italic")}
          aria-label={t("wysiwygEditor.italic")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyInlineFormat("em")}
          style={{ ...buttonStyle, fontStyle: "italic" }}
        >
          I
        </button>
        <button
          type="button"
          title={t("wysiwygEditor.underline")}
          aria-label={t("wysiwygEditor.underline")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyInlineFormat("u")}
          style={{ ...buttonStyle, textDecoration: "underline" }}
        >
          U
        </button>
        <button
          type="button"
          title={t("wysiwygEditor.heading")}
          aria-label={t("wysiwygEditor.heading")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runBlockCommand("formatBlock", "h2")}
          style={buttonStyle}
        >
          H
        </button>
        <button
          type="button"
          title={t("wysiwygEditor.toggleHeading")}
          aria-label={t("wysiwygEditor.toggleHeading")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleHeading}
          style={{ ...buttonStyle, minWidth: 42 }}
        >
          ▸ H
        </button>
        <button
          type="button"
          title={t("wysiwygEditor.bulletList")}
          aria-label={t("wysiwygEditor.bulletList")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runBlockCommand("insertUnorderedList")}
          style={buttonStyle}
        >
          •
        </button>
        <button
          type="button"
          title={t("wysiwygEditor.divider")}
          aria-label={t("wysiwygEditor.divider")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runBlockCommand("insertHorizontalRule")}
          style={buttonStyle}
        >
          -
        </button>
        {props.mentions?.length ? (
          <select
            aria-label={t("wysiwygEditor.mentionBinderRecord")}
            title={t("wysiwygEditor.mentionBinderRecord")}
            defaultValue=""
            onMouseDown={mention.saveSelection}
            onChange={(event) => {
              const id = event.target.value;
              event.target.value = "";
              if (id) mention.insertMention(id);
            }}
            style={{ ...buttonStyle, minWidth: 116, padding: "0 6px" }}
          >
            <option value="">{t("wysiwygEditor.mentionOptionLabel")}</option>
            {props.mentions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
                {option.type ? ` · ${option.type}` : ""}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <style>{`.beholden-note-editor details > :not(summary) { margin-left: 26px; } .beholden-note-editor summary { cursor: pointer; }`}</style>
      <div style={{ position: "relative" }}>
        {isEmpty && !isFocused ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 10,
              left: 12,
              color: "color-mix(in srgb, currentColor 55%, transparent)",
              opacity: 0.7,
              pointerEvents: "none",
              fontSize: "var(--fs-subtitle)",
              lineHeight: 1.5,
            }}
          >
            {props.placeholder ?? t("wysiwygEditor.placeholder")}
          </div>
        ) : null}
        <div
          ref={editorRef}
          className="beholden-note-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-autocomplete={props.mentions?.length ? "list" : undefined}
          aria-controls={mention.mentionTrigger ? mentionListId : undefined}
          aria-activedescendant={
            mention.mentionTrigger && mention.filteredMentions.length
              ? `${mentionListId}-${mention.mentionActiveIndex}`
              : undefined
          }
          onClick={(event) => {
            const anchor = (event.target as HTMLElement).closest("a");
            if (anchor) event.preventDefault();
          }}
          onFocus={() => {
            focusedRef.current = true;
            setIsFocused(true);
          }}
          onBlur={() => {
            focusedRef.current = false;
            setIsFocused(false);
            mention.clearMentionTrigger();
            emitChange();
          }}
          onInput={(event) => {
            emitChange();
            if (!(event.nativeEvent as InputEvent).isComposing)
              mention.updateMentionTrigger();
          }}
          onCompositionEnd={() => {
            emitChange();
            mention.updateMentionTrigger();
          }}
          onKeyDown={(event) => {
            mention.handleMentionKeyDown(event);
            if (
              !event.defaultPrevented &&
              !event.nativeEvent.isComposing &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey &&
              editorRef.current &&
              editToggleParagraph(editorRef.current, event.key, event.shiftKey)
            ) {
              event.preventDefault();
              emitChange();
            }
          }}
          onKeyUp={(event) => {
            mention.saveSelection();
            if (
              !event.nativeEvent.isComposing &&
              !["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(
                event.key,
              )
            )
              mention.updateMentionTrigger();
          }}
          onMouseUp={() => {
            mention.saveSelection();
            mention.updateMentionTrigger();
          }}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            if (editorRef.current)
              insertPlainTextAtSelection(editorRef.current, text);
            emitChange();
            mention.updateMentionTrigger();
          }}
          style={{
            minHeight: props.minHeight ?? 180,
            // Long notes must scroll inside this box rather than growing it past the viewport --
            // otherwise the toolbar above scrolls away with the page instead of staying put.
            maxHeight: props.maxHeight ?? Math.max(props.minHeight ?? 180, 420),
            padding: "10px 12px",
            color: props.theme.text,
            outline: "none",
            fontSize: "var(--fs-subtitle)",
            lineHeight: 1.5,
            overflowY: "auto",
          }}
        />
      </div>
      {mention.mentionTrigger && mention.mentionDropdownPos
        ? createPortal(
            <div
              id={mentionListId}
              data-mention-suggestions
              role="listbox"
              aria-label={t("wysiwygEditor.mentionSuggestions")}
              style={{
                position: "fixed",
                top: mention.mentionDropdownPos.top,
                left: mention.mentionDropdownPos.left,
                zIndex: 20000,
                width: mention.mentionDropdownPos.width,
                boxSizing: "border-box",
                maxHeight: mention.mentionDropdownPos.maxHeight,
                overscrollBehavior: "contain",
                overflowY: "auto",
                background: "#1e2030",
                border: `1px solid ${props.theme.panelBorder}`,
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                padding: 4,
              }}
            >
              {mention.filteredMentions.map((option, index) => (
                <div
                  key={option.id}
                  id={`${mentionListId}-${index}`}
                  role="option"
                  aria-selected={index === mention.mentionActiveIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    mention.selectMentionFromTrigger(option);
                  }}
                  onMouseEnter={() => mention.setMentionActiveIndex(index)}
                  style={{
                    padding: "8px",
                    minHeight: 44,
                    boxSizing: "border-box",
                    alignItems: "center",
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: "var(--fs-small)",
                    fontWeight:
                      index === mention.mentionActiveIndex ? 800 : 600,
                    color: props.theme.text,
                    background:
                      index === mention.mentionActiveIndex
                        ? "rgba(125,211,252,0.16)"
                        : "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {option.label}
                  </span>
                  {option.type ? (
                    <span style={{ opacity: 0.6, fontWeight: 600 }}>
                      {option.type}
                    </span>
                  ) : null}
                </div>
              ))}
              {!mention.filteredMentions.length ? (
                <div
                  role="status"
                  style={{ padding: 10, color: props.theme.text }}
                >
                  {t("wysiwygEditor.noMatchingMentions")}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
