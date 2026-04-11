import React from "react";

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
        <div style={{ marginTop: 6, color: mutedColor, fontSize: "var(--fs-small)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {text}
        </div>
      ) : null}
    </div>
  );
}
