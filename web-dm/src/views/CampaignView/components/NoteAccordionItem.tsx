import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import type { Note } from "@/domain/types/domain";

export function NoteAccordionItem(props: {
  note: Note;
  expanded: boolean;
  accentColor?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = props.accentColor ?? theme.colors.accentPrimary;

  return (
    <div
      style={{
        padding: "5px 6px",
        borderRadius: 7,
        background: props.expanded ? withAlpha(accent, 0.07) : "transparent",
        border: `1px solid ${props.expanded ? withAlpha(accent, 0.22) : "transparent"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onToggle(); }}
          style={{ all: "unset", cursor: "pointer", fontWeight: 700, color: theme.colors.text, flex: 1 }}
        >
          {props.note.title}
        </button>

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onEdit(); }}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: theme.colors.muted, cursor: "pointer", padding: "2px 7px", fontSize: "var(--fs-small)" }}
        >
          Edit
        </button>

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onDelete(); }}
          style={{ background: "rgba(255,93,93,0.08)", border: "1px solid rgba(255,93,93,0.25)", borderRadius: 5, color: theme.colors.red, cursor: "pointer", padding: "2px 7px", fontSize: "var(--fs-small)" }}
        >
          ×
        </button>
      </div>

      {props.expanded && props.note.text && (
        <div style={{ marginTop: 6, whiteSpace: "pre-wrap", color: theme.colors.muted, fontSize: "var(--fs-subtitle)", lineHeight: 1.5 }}>
          {props.note.text}
        </div>
      )}
    </div>
  );
}
