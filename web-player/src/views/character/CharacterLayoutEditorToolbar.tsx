import type { CSSProperties } from "react";
import { C, withAlpha } from "@/lib/theme";
import { IconButton } from "@/ui/IconButton";
import type { SheetViewDef } from "@/views/character/panelRegistry";
import { MAX_SHEET_COLUMNS, MIN_SHEET_COLUMNS } from "@/views/character/sheetViewLayout";

function IconCopy() {
  return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>;
}

function IconTrash() {
  return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>;
}

export function CharacterLayoutEditorToolbar(props: {
  activeView: SheetViewDef;
  protectedView: boolean;
  canReset: boolean;
  canDelete: boolean;
  onRename: (name: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  onReset: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { activeView } = props;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      <input
        key={activeView.id}
        aria-label="View name"
        defaultValue={activeView.name}
        disabled={props.protectedView}
        title={props.protectedView ? "Combat and All can't be renamed" : undefined}
        onBlur={(event) => {
          const name = event.currentTarget.value.trim();
          if (name && name !== activeView.name) props.onRename(name);
          else event.currentTarget.value = activeView.name;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") { event.currentTarget.value = activeView.name; event.currentTarget.blur(); }
        }}
        style={{
          padding: "6px 10px", borderRadius: 8, fontSize: "var(--fs-small)", fontWeight: 700,
          border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: C.text,
          minWidth: 140, opacity: props.protectedView ? 0.55 : 1, cursor: props.protectedView ? "not-allowed" : "text",
        }}
      />
      <button type="button" onClick={props.onAddColumn} disabled={activeView.columns >= MAX_SHEET_COLUMNS} style={toolbarButtonStyle(activeView.columns >= MAX_SHEET_COLUMNS)}>+ Column</button>
      <button type="button" onClick={props.onRemoveColumn} disabled={activeView.columns <= MIN_SHEET_COLUMNS} style={toolbarButtonStyle(activeView.columns <= MIN_SHEET_COLUMNS)}>− Column</button>
      <button type="button" onClick={props.onReset} disabled={!props.canReset} title={props.canReset ? undefined : "Only built-in views have a default layout"} style={toolbarButtonStyle(!props.canReset)}>Reset this view</button>
      <IconButton onClick={props.onDuplicate} title="Duplicate this view"><IconCopy /></IconButton>
      <IconButton onClick={props.onDelete} disabled={!props.canDelete} title={props.canDelete ? "Delete this view" : "Combat and All can't be deleted, and at least one view must remain"} style={{ color: C.red, borderColor: withAlpha(C.red, 0.4), background: withAlpha(C.red, 0.08) }}><IconTrash /></IconButton>
    </div>
  );
}

function toolbarButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 8, fontSize: "var(--fs-small)", fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", border: "1px solid rgba(255,255,255,0.14)",
    background: "transparent", color: disabled ? "rgba(160,180,220,0.35)" : C.muted,
    opacity: disabled ? 0.6 : 1,
  };
}
