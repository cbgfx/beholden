import React from "react";
import { Button } from "@/ui/Button";
import { theme } from "@/theme/theme";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import { formatCr } from "@/views/CampaignView/monsterPicker/utils";
import { titleCase } from "@/lib/format/titleCase";

export const selectStyle: React.CSSProperties = {
  background: theme.colors.panelBg,
  color: theme.colors.text,
  border: `1px solid ${theme.colors.panelBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: "var(--fs-medium)",
  outline: "none",
  width: "100%",
};

export const inputStyle: React.CSSProperties = {
  background: theme.colors.panelBg,
  color: theme.colors.text,
  border: `1px solid ${theme.colors.panelBorder}`,
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: "var(--fs-medium)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export const CR_OPTIONS = [
  "", "0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
];

export function PolymorphCurrentBanner(props: {
  polymorphName: string;
  loading: boolean;
  onRevert: () => void;
}) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        background: "rgba(109,40,217,0.12)",
        border: "1px solid #6d28d966",
        color: "#c084fc",
        fontSize: "var(--fs-medium)",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span>Currently: {props.polymorphName}</span>
      <Button variant="danger" onClick={props.onRevert} disabled={props.loading} style={{ padding: "4px 10px", fontSize: "var(--fs-small)" }}>
        Revert
      </Button>
    </div>
  );
}

export function PolymorphCreatureList(props: {
  rows: CompendiumMonsterRow[];
  selectedId: string | null;
  typeOptions: string[];
  query: string;
  crMax: string;
  typeFilter: string;
  onQueryChange: (value: string) => void;
  onCrMaxChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onSelect: (row: CompendiumMonsterRow) => void;
  onTransform: (row: CompendiumMonsterRow) => void;
}) {
  return (
    <div>
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Select to transform
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <input
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Search beasts..."
          style={inputStyle}
        />
        <select value={props.crMax} onChange={(event) => props.onCrMaxChange(event.target.value)} style={selectStyle}>
          <option value="">Challenge rating</option>
          {CR_OPTIONS.filter(Boolean).map((cr) => (
            <option key={cr} value={cr}>
              CR {"<="} {cr}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <select value={props.typeFilter} onChange={(event) => props.onTypeFilterChange(event.target.value)} style={selectStyle}>
          {props.typeOptions.map((type) => (
            <option key={type} value={type}>
              {type === "all" ? "All types" : titleCase(type)}
            </option>
          ))}
        </select>
        <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", alignSelf: "center", paddingLeft: 4 }}>
          {props.rows.length} creature{props.rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div
        style={{
          maxHeight: 260,
          overflowY: "auto",
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 8,
        }}
      >
        {props.rows.length === 0 ? (
          <div style={{ padding: 12, color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>No creatures found.</div>
        ) : (
          props.rows.map((row) => (
            <PolymorphCreatureRow
              key={row.id}
              row={row}
              selected={props.selectedId === row.id}
              onSelect={() => props.onSelect(row)}
              onTransform={() => props.onTransform(row)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PolymorphCreatureRow(props: {
  row: CompendiumMonsterRow;
  selected: boolean;
  onSelect: () => void;
  onTransform: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 10px",
        borderBottom: `1px solid ${theme.colors.panelBorder}`,
        background: props.selected ? "rgba(109,40,217,0.12)" : "transparent",
        gap: 8,
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: "var(--fs-medium)",
          color: props.selected ? "#e9d5ff" : theme.colors.text,
          fontWeight: props.selected ? 700 : 400,
          cursor: "pointer",
        }}
        onClick={props.onSelect}
      >
        {props.row.name}
      </span>
      <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", minWidth: 28, textAlign: "right" }}>
        {formatCr(props.row.cr)}
      </span>
      <button
        type="button"
        title={`Transform into ${props.row.name}`}
        onClick={props.onTransform}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: theme.colors.accentPrimary,
          fontSize: 16,
          padding: "0 2px",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        *
      </button>
    </div>
  );
}
