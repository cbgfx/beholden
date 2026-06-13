import React from "react";

function renderInlineRichText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];
    const index = match.index;
    if (index > lastIndex) {
      nodes.push(<React.Fragment key={`txt-${key++}`}>{text.slice(lastIndex, index)}</React.Fragment>);
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<b key={`b-${key++}`}>{token.slice(2, -2)}</b>);
    } else if (token.startsWith("__") && token.endsWith("__")) {
      nodes.push(<u key={`u-${key++}`}>{token.slice(2, -2)}</u>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<i key={`i-${key++}`}>{token.slice(1, -1)}</i>);
    } else {
      nodes.push(<React.Fragment key={`raw-${key++}`}>{token}</React.Fragment>);
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<React.Fragment key={`tail-${key++}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return nodes;
}

function renderNoteRichText(text: string): React.ReactNode {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;

  const headingStyleByLevel: Record<number, React.CSSProperties> = {
    1: { fontWeight: 800, fontSize: "calc(var(--fs-subtitle) + 4px)", margin: "8px 0 4px" },
    2: { fontWeight: 800, fontSize: "calc(var(--fs-subtitle) + 2px)", margin: "8px 0 4px" },
    3: { fontWeight: 700, fontSize: "var(--fs-subtitle)", margin: "8px 0 4px" },
    4: { fontWeight: 700, fontSize: "var(--fs-medium)", margin: "8px 0 4px" },
    5: { fontWeight: 700, fontSize: "var(--fs-medium)", margin: "8px 0 4px" },
    6: { fontWeight: 700, fontSize: "var(--fs-medium)", margin: "8px 0 4px" },
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      out.push(<div key={`space-${i}`} style={{ height: 8 }} />);
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      out.push(<hr key={`hr-${i}`} style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.2)", margin: "10px 0" }} />);
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      out.push(
        <div key={`h-${i}`} style={headingStyleByLevel[level]}>
          {renderInlineRichText(heading[2])}
        </div>
      );
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: React.ReactNode[] = [];
      let j = i;
      while (j < lines.length) {
        const raw = lines[j] ?? "";
        const t = raw.trim();
        if (!/^[-*]\s+/.test(t)) break;
        items.push(<li key={`li-${j}`}>{renderInlineRichText(t.replace(/^[-*]\s+/, ""))}</li>);
        j += 1;
      }
      out.push(
        <ul key={`ul-${i}`} style={{ margin: "4px 0 8px", paddingLeft: 20 }}>
          {items}
        </ul>
      );
      i = j;
      continue;
    }

    out.push(
      <div key={`p-${i}`} style={{ margin: "0 0 6px" }}>
        {renderInlineRichText(line)}
      </div>
    );
    i += 1;
  }

  return out;
}

export function NoteRow({
  title,
  text,
  expanded,
  accentColor,
  textColor,
  mutedColor,
  deleteColor,
  onToggle,
  onEdit,
  onDelete,
}: {
  title: string;
  text?: string;
  expanded: boolean;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  deleteColor: string;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const activeBg = `color-mix(in srgb, ${accentColor} 12%, transparent)`;
  const activeBorder = `color-mix(in srgb, ${accentColor} 32%, transparent)`;

  return (
    <div
      style={{
        padding: "5px 6px",
        borderRadius: 7,
        background: expanded ? activeBg : "transparent",
        border: `1px solid ${expanded ? activeBorder : "transparent"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          style={{ all: "unset", cursor: "pointer", fontWeight: 700, color: textColor, flex: 1, fontSize: "var(--fs-subtitle)", lineHeight: 1.4 }}
        >
          {title}
        </button>
        {onEdit ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: mutedColor, cursor: "pointer", padding: "2px 7px", fontSize: "var(--fs-small)" }}
          >
            Edit
          </button>
        ) : null}
        {onDelete ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            style={{ background: "rgba(255,93,93,0.08)", border: "1px solid rgba(255,93,93,0.25)", borderRadius: 5, color: deleteColor, cursor: "pointer", padding: "2px 7px", fontSize: "var(--fs-small)" }}
          >
            x
          </button>
        ) : null}
      </div>
      {expanded && text ? (
        <div style={{ marginTop: 6, color: mutedColor, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>
          {renderNoteRichText(text)}
        </div>
      ) : null}
    </div>
  );
}
