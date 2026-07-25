import type React from "react";
import { noteBodyStyle, noteSurfaceStyle } from "./noteStyles";

export function ExpandableNoteItem(props: {
  title: React.ReactNode;
  expanded: boolean;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  onToggle: () => void;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`noteInteractiveRow${props.expanded ? " noteInteractiveRow--expanded" : ""}`}
      style={noteSurfaceStyle(props.expanded, props.accentColor)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onToggle();
          }}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            color: props.textColor,
            flex: 1,
            minWidth: 0,
            fontWeight: 700,
            fontSize: "var(--fs-subtitle)",
            lineHeight: 1.4,
          }}
        >
          {props.title}
        </button>
        {props.trailing}
      </div>
      {props.expanded && props.children ? (
        <div style={noteBodyStyle(props.textColor, props.mutedColor)}>{props.children}</div>
      ) : null}
    </div>
  );
}
