/** Markdown <-> HTML conversion for WysiwygNoteEditor's stored representation. Pure string/DOM-tree
 * functions with no React dependency, so they're unit-testable without mounting a component. */

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

export function markdownToHtml(value: string): string {
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

export function htmlToMarkdown(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .map(blockToMarkdown)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
