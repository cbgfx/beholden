import React from "react";
import { IconPencil, IconTrash } from "@/icons";
import { expandSchool } from "@/lib/format/expandSchool";
import { theme, withAlpha } from "@/theme/theme";
import type { SpellSearchRow } from "@/domain/compendium/normalizeSpellSearchRow";
import { actionBtnStyle } from "./browserParts";

export function SpellBrowserRow(props: {
  row: SpellSearchRow;
  active: boolean;
  editable?: boolean;
  editLoading: boolean;
  deleteBusy: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  confirmingDelete: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  const levelLabel = props.row.level == null ? "?" : props.row.level === 0 ? "0" : String(props.row.level);
  const safeName = typeof props.row.name === "string" ? props.row.name : String((props.row as { name?: unknown }).name ?? "");

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: `1px solid ${theme.colors.panelBorder}`,
        background: props.active ? withAlpha(theme.colors.accentHighlight, 0.18) : "transparent",
      }}
    >
      <button
        type="button"
        onClick={props.onClick}
        style={{
          flex: 1,
          textAlign: "left",
          padding: "10px 10px",
          border: "none",
          background: "transparent",
          color: theme.colors.text,
          cursor: "pointer",
          minWidth: 0,
        }}
      >
        <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{safeName}</div>
        <div
          style={{
            color: theme.colors.muted,
            fontSize: "var(--fs-small)",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          L{levelLabel}
          {props.row.school ? ` • ${expandSchool(props.row.school)}` : ""}
          {props.row.time ? ` • ${props.row.time}` : ""}
        </div>
      </button>

      {props.editable && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "0 8px",
            flexShrink: 0,
            opacity: hovered || props.confirmingDelete ? 1 : 0,
            transition: "opacity 0.1s",
            pointerEvents: hovered || props.confirmingDelete ? "auto" : "none",
          }}
        >
          {props.confirmingDelete ? (
            <>
              <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginRight: 4 }}>Delete?</span>
              <button type="button" onClick={props.onConfirmDelete} disabled={props.deleteBusy} style={actionBtnStyle(theme.colors.red)} title="Yes, delete">
                Yes
              </button>
              <button type="button" onClick={props.onCancelDelete} style={actionBtnStyle(theme.colors.muted)} title="Cancel">
                No
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={props.onEdit} disabled={props.editLoading} style={actionBtnStyle(theme.colors.muted)} title="Edit spell">
                {props.editLoading ? <span style={{ fontSize: "var(--fs-tiny)" }}>...</span> : <IconPencil size={13} />}
              </button>
              <button type="button" onClick={props.onDelete} style={actionBtnStyle(theme.colors.muted)} title="Delete spell">
                <IconTrash size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
