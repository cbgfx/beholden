import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import type { Note } from "@/domain/types/domain";
import { IconButton } from "@/ui/IconButton";
import { IconPencil, IconTrash } from "@/icons";

export function NoteAccordionItem(props: {
  note: Note;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const highlight = theme.colors.accentHighlight;
  const highlightBg = withAlpha(highlight, 0.07);
  const highlightBorder = withAlpha(highlight, 0.22);

  return (
    <div
      style={{
        padding: 6,
        borderRadius: 10,
        background: props.expanded ? highlightBg : "transparent",
        border: props.expanded ? `1px solid ${highlightBorder}` : `1px solid transparent`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.onToggle();
          }}
          style={{
            all: "unset",
            cursor: "pointer",
            fontWeight: 900,
            color: theme.colors.text,
            flex: 1,
          }}
        >
          {props.note.title}
        </button>

        <div style={{ display: "flex", gap: 6 }}>
          <IconButton
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              props.onEdit();
            }}
            size="sm"
          >
            <IconPencil />
          </IconButton>

          <IconButton
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              props.onDelete();
            }}
            size="sm"
          >
            <IconTrash />
          </IconButton>
        </div>
      </div>

      {props.expanded && (
        <div
          style={{
            marginTop: 6,
            whiteSpace: "pre-wrap",
            color: theme.colors.muted,
          }}
        >
          {props.note.text}
        </div>
      )}
    </div>
  );
}
