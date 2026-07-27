import React from "react";

type EditorTheme = {
  radius: string | number;
  panelBorder: string;
  inputBg: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
      if (/^\s*javascript:/i.test(href)) return label;
      const mentionStyle = href.startsWith("/binder/")
        ? ' style="color:#7dd3fc;background:rgba(125,211,252,0.14);padding:1px 6px;border-radius:5px;font-weight:700;text-decoration:none;"'
        : "";
      return `<a href="${href}" rel="noreferrer"${mentionStyle}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(value: string): string {
  const lines = value.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      out.push("<p><br></p>");
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      out.push("<hr>");
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      out.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    const toggle = trimmed.match(/^:::toggle\s+(.+)$/);
    if (toggle) {
      let end = i + 1;
      while (end < lines.length && lines[end]?.trim() !== ":::") end += 1;
      const body = lines.slice(i + 1, end).join("\n");
      out.push(`<details open><summary>${renderInlineMarkdown(toggle[1])}</summary>${markdownToHtml(body)}</details>`);
      i = end < lines.length ? end + 1 : end;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = lines[i] ?? "";
        const itemText = itemLine.trim();
        if (!/^[-*]\s+/.test(itemText)) break;
        items.push(`<li>${renderInlineMarkdown(itemText.replace(/^[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    out.push(`<p>${renderInlineMarkdown(line)}</p>`);
    i += 1;
  }

  return out.join("");
}

function nodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";

  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";
  const children = Array.from(node.childNodes).map(nodeText).join("");
  if (tag === "strong" || tag === "b") return `**${children}**`;
  if (tag === "em" || tag === "i") return `*${children}*`;
  if (tag === "u") return `__${children}__`;
  if (tag === "a") return `[${children}](${node.getAttribute("href") ?? ""})`;
  return children;
}

function blockToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";

  const tag = node.tagName.toLowerCase();
  if (tag === "details") {
    const summary = Array.from(node.children).find((child) => child.tagName.toLowerCase() === "summary");
    const title = summary ? Array.from(summary.childNodes).map(nodeText).join("").trim() : "Toggle";
    const body = Array.from(node.childNodes)
      .filter((child) => child !== summary)
      .map(blockToMarkdown)
      .filter(Boolean)
      .join("\n");
    return `:::toggle ${title}\n${body}\n:::`;
  }
  const text = Array.from(node.childNodes).map(nodeText).join("").trimEnd();

  if (tag === "h1") return `# ${text}`;
  if (tag === "h2") return `## ${text}`;
  if (tag === "h3") return `### ${text}`;
  if (tag === "h4") return `#### ${text}`;
  if (tag === "h5") return `##### ${text}`;
  if (tag === "h6") return `###### ${text}`;
  if (tag === "hr") return "---";
  if (tag === "ul") {
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => `- ${Array.from(child.childNodes).map(nodeText).join("").trim()}`)
      .join("\n");
  }
  if (tag === "li") return `- ${text}`;
  return text;
}

function htmlToMarkdown(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .map(blockToMarkdown)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

function selectionRangeInEditor(editor: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;
  return range;
}

function closestInlineFormat(range: Range, editor: HTMLElement, tagName: string): HTMLElement | null {
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

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

function selectNodeContents(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertPlainTextAtSelection(editor: HTMLElement, text: string) {
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

export function WysiwygNoteEditor(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  theme: EditorTheme;
  style?: React.CSSProperties;
  mentions?: Array<{ id: string; label: string; href: string; type?: string }>;
}) {
  const { onChange, value } = props;
  const editorRef = React.useRef<HTMLDivElement>(null);
  const focusedRef = React.useRef(false);
  const htmlRef = React.useRef("");
  const savedRangeRef = React.useRef<Range | null>(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isEmpty, setIsEmpty] = React.useState(() => !value.trim());
  const buttonStyle = toolbarButtonStyle(props.theme);

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

  const saveSelection = React.useCallback(() => {
    const editor = editorRef.current;
    const range = editor ? selectionRangeInEditor(editor) : null;
    if (range) savedRangeRef.current = range.cloneRange();
  }, []);

  const insertMention = React.useCallback((id: string) => {
    const editor = editorRef.current;
    const mention = props.mentions?.find((option) => option.id === id);
    const selection = window.getSelection();
    const range = savedRangeRef.current;
    if (!editor || !mention || !selection || !range || !editor.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const anchor = document.createElement("a");
    anchor.href = mention.href;
    anchor.dataset.binderRecordId = mention.id;
    anchor.textContent = `@${mention.label}`;
    range.insertNode(anchor);
    const spacer = document.createTextNode(" ");
    anchor.after(spacer);
    range.setStartAfter(spacer);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
    emitChange();
    editor.focus();
  }, [emitChange, props.mentions]);

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
          onMouseDown={saveSelection}
          onChange={(event) => {
            const id = event.target.value;
            event.target.value = "";
            if (id) insertMention(id);
          }}
          style={{ ...buttonStyle, minWidth: 116, padding: "0 6px" }}
        >
          <option value="">@ Mention</option>
          {props.mentions.map((mention) => <option key={mention.id} value={mention.id}>
            {mention.label}{mention.type ? ` · ${mention.type}` : ""}
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
            emitChange();
          }}
          onInput={emitChange}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            if (editorRef.current) insertPlainTextAtSelection(editorRef.current, text);
            emitChange();
          }}
          style={{
            minHeight: props.minHeight ?? 180,
            padding: "10px 12px",
            color: props.theme.text,
            outline: "none",
            fontSize: "var(--fs-subtitle)",
            lineHeight: 1.5,
            overflowY: "auto",
          }}
        />
      </div>
    </div>
  );
}
