import * as React from "react";
import { theme } from "@/theme/theme";
import { formatCr } from "@/views/CampaignView/monsterPicker/utils";
import type { PreparedMonsterRow } from "@/views/CampaignView/monsterPicker/types";

export function MonsterCreateChoiceModal(props: {
  onClose: () => void;
  onCreateNew: () => void;
  onDuplicateExisting: () => void;
}) {
  return (
    <div
      onClick={props.onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: theme.colors.scrim }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: theme.colors.modalBg, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 10, width: 260 }}
      >
        <div style={{ fontWeight: 700, fontSize: "var(--fs-body)", marginBottom: 4 }}>New Monster</div>
        <button
          type="button"
          onClick={props.onCreateNew}
          style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.accentPrimary, color: theme.colors.textDark, fontWeight: 700, cursor: "pointer", fontSize: "var(--fs-subtitle)", textAlign: "left" }}
        >
          Create New
        </button>
        <button
          type="button"
          onClick={props.onDuplicateExisting}
          style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, fontWeight: 600, cursor: "pointer", fontSize: "var(--fs-subtitle)", textAlign: "left" }}
        >
          Duplicate Existing...
        </button>
      </div>
    </div>
  );
}

export function MonsterDuplicatePickerModal(props: {
  searchQuery: string;
  rows: PreparedMonsterRow[];
  loadingId: string | null;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onPick: (id: string) => void;
}) {
  return (
    <div
      onClick={props.onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: theme.colors.scrim }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: theme.colors.modalBg, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, width: "min(480px, 95vw)", display: "flex", flexDirection: "column", maxHeight: "80vh" }}
      >
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${theme.colors.panelBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: "var(--fs-body)" }}>Pick a monster to duplicate</span>
          <button type="button" onClick={props.onClose}
            style={{ background: "none", border: "none", color: theme.colors.muted, cursor: "pointer", fontSize: "var(--fs-hero)", lineHeight: 1 }}>x</button>
        </div>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${theme.colors.panelBorder}`, flexShrink: 0 }}>
          <input
            autoFocus
            type="text"
            placeholder="Search monsters..."
            value={props.searchQuery}
            onChange={(e) => props.onSearchChange(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.inputBg, color: theme.colors.text, fontSize: "var(--fs-subtitle)", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {props.rows.map((monster) => (
            <button key={monster.id} type="button"
              disabled={props.loadingId === monster.id}
              onClick={() => props.onPick(monster.id)}
              style={{ width: "100%", padding: "10px 16px", border: "none", borderBottom: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, cursor: props.loadingId === monster.id ? "wait" : "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 2, opacity: props.loadingId === monster.id ? 0.5 : 1 }}
            >
              <div style={{ fontWeight: 600, fontSize: "var(--fs-subtitle)" }}>{monster.name}</div>
              <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                {monster.cr != null ? `CR ${formatCr(monster.cr)}` : "CR -"}{monster.type ? ` • ${monster.type}` : ""}
              </div>
            </button>
          ))}
          {props.rows.length === 0 && (
            <div style={{ padding: 16, color: theme.colors.muted, fontSize: "var(--fs-subtitle)" }}>No monsters found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
