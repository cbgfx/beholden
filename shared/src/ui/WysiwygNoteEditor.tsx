import React from "react";
import { markdownToHtml, htmlToMarkdown } from "./markdownHtml";
import {
  selectionRangeInEditor,
  closestInlineFormat,
  unwrapElement,
  selectNodeContents,
  insertPlainTextAtSelection,
} from "./contentEditableDom";
import { useMentionAutocomplete, type MentionOption } from "./useMentionAutocomplete";

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
  const { onChange, value } = props;
  const editorRef = React.useRef<HTMLDivElement>(null);
  const focusedRef = React.useRef(false);
  const htmlRef = React.useRef("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [isEmpty, setIsEmpty] = React.useState(() => !value.trim());
  const buttonStyle = toolbarButtonStyle(props.theme);
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

  const mention = useMentionAutocomplete({ editorRef, mentions: props.mentions, emitChange });

  const applyInlineFormat = React.useCallback((tagName: "strong" | "em" | "u") => {
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
  }, [emitChange]);

  const runBlockCommand = React.useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    emitChange();
    editorRef.current?.focus();
  }, [emitChange]);

  const toggleHeading = React.useCallback(() => {
    const editor = editorRef.current;
    const range = editor ? selectionRangeInEditor(editor) : null;
    if (!editor || !range) {
      editor?.focus();
      return;
    }
    const start = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as HTMLElement
      : range.startContainer.parentElement;
    const existing = start?.closest("details");
    if (existing && editor.contains(existing)) {
      const summary = Array.from(existing.children).find((child) => child.tagName.toLowerCase() === "summary");
      const heading = document.createElement("h2");
      heading.innerHTML = summary?.innerHTML || "Toggle";
      existing.parentNode?.insertBefore(heading, existing);
      for (const child of Array.from(existing.childNodes)) {
        if (child !== summary) existing.parentNode?.insertBefore(child, existing);
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
    summary.innerHTML = block.innerHTML || "Toggle heading";
    details.appendChild(summary);

    const headingMatch = block.tagName.match(/^H([1-6])$/);
    if (headingMatch) {
      const level = Number(headingMatch[1]);
      let sibling = block.nextSibling;
      while (sibling) {
        const next = sibling.nextSibling;
        const siblingLevel = sibling instanceof HTMLElement
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
  }, [emitChange]);

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
        <button type="button" title="Bold" aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineFormat("strong")} style={buttonStyle}>B</button>
        <button type="button" title="Italic" aria-label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineFormat("em")} style={{ ...buttonStyle, fontStyle: "italic" }}>I</button>
        <button type="button" title="Underline" aria-label="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineFormat("u")} style={{ ...buttonStyle, textDecoration: "underline" }}>U</button>
        <button type="button" title="Heading" aria-label="Heading" onMouseDown={(e) => e.preventDefault()} onClick={() => runBlockCommand("formatBlock", "h2")} style={buttonStyle}>H</button>
        <button type="button" title="Toggle heading" aria-label="Toggle heading" onMouseDown={(e) => e.preventDefault()} onClick={toggleHeading} style={{ ...buttonStyle, minWidth: 42 }}>▸ H</button>
        <button type="button" title="Bullet list" aria-label="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => runBlockCommand("insertUnorderedList")} style={buttonStyle}>•</button>
        <button type="button" title="Divider" aria-label="Divider" onMouseDown={(e) => e.preventDefault()} onClick={() => runBlockCommand("insertHorizontalRule")} style={buttonStyle}>-</button>
        {props.mentions?.length ? <select
          aria-label="Mention Binder record"
          title="Mention Binder record"
          defaultValue=""
          onMouseDown={mention.saveSelection}
          onChange={(event) => {
            const id = event.target.value;
            event.target.value = "";
            if (id) mention.insertMention(id);
          }}
          style={{ ...buttonStyle, minWidth: 116, padding: "0 6px" }}
        >
          <option value="">@ Mention</option>
          {props.mentions.map((option) => <option key={option.id} value={option.id}>
            {option.label}{option.type ? ` · ${option.type}` : ""}
          </option>)}
        </select> : null}
      </div>
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
            {props.placeholder ?? "Write..."}
          </div>
        ) : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
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
          onInput={() => {
            emitChange();
            mention.updateMentionTrigger();
          }}
          onKeyDown={(event) => {
            mention.handleMentionKeyDown(event);
          }}
          onKeyUp={(event) => {
            mention.saveSelection();
            if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) mention.updateMentionTrigger();
          }}
          onMouseUp={() => {
            mention.saveSelection();
            mention.updateMentionTrigger();
          }}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            if (editorRef.current) insertPlainTextAtSelection(editorRef.current, text);
            emitChange();
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
      {mention.mentionTrigger && mention.mentionDropdownPos && mention.filteredMentions.length > 0 ? (
        <div
          role="listbox"
          aria-label="Mention suggestions"
          style={{
            position: "fixed",
            top: mention.mentionDropdownPos.top,
            left: mention.mentionDropdownPos.left,
            zIndex: 200,
            minWidth: 200,
            maxWidth: 320,
            maxHeight: 240,
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
              role="option"
              aria-selected={index === mention.mentionActiveIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                mention.selectMentionFromTrigger(option);
              }}
              onMouseEnter={() => mention.setMentionActiveIndex(index)}
              style={{
                padding: "6px 8px",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: "var(--fs-small)",
                fontWeight: index === mention.mentionActiveIndex ? 800 : 600,
                color: props.theme.text,
                background: index === mention.mentionActiveIndex ? "rgba(125,211,252,0.16)" : "transparent",
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>{option.label}</span>
              {option.type ? <span style={{ opacity: 0.6, fontWeight: 600 }}>{option.type}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
