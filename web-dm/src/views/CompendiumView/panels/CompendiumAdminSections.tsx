import React from "react";

import { Button } from "@/ui/Button";
import { Select } from "@/ui/Select";
import { theme } from "@/theme/theme";

export const NATIVE_COMPENDIUM_CATEGORIES = [
  "monsters",
  "items",
  "spells",
  "classTalents",
  "classes",
  "species",
  "backgrounds",
  "feats",
  "decks",
  "bastions",
] as const;

export type NativeCompendiumCategory = (typeof NATIVE_COMPENDIUM_CATEGORIES)[number];

export type NativeImportResult = {
  ok: true;
  imported: number;
  total: number;
  batches: Array<{
    category: NativeCompendiumCategory;
    imported: number;
    total: number;
  }>;
};

export type NativePreviewResult = {
  ok: true;
  entries: number;
  additions: number;
  replacements: number;
  batches: Array<{
    category: NativeCompendiumCategory;
    entries: number;
    additions: number;
    replacements: number;
  }>;
};

const cardStyle: React.CSSProperties = {
  border: `1px solid ${theme.colors.panelBorder}`,
  borderRadius: 12,
  padding: 14,
  background: "rgba(0,0,0,0.14)",
  minWidth: 0,
};

function categoryLabel(category: NativeCompendiumCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function NativeCompendiumDescription() {
  return (
    <div style={{ color: theme.colors.muted, lineHeight: 1.55, maxWidth: 1050 }}>
      Export a category to edit it, or import a category or complete bundle. Beholden JSON is portable,
      human-readable, and always replaces entries with matching IDs.
    </div>
  );
}

export function NativeCompendiumActions(props: {
  busy: boolean;
  category: NativeCompendiumCategory;
  fileName: string | null;
  previewReady: boolean;
  onCategoryChange: (category: NativeCompendiumCategory) => void;
  onFileChange: (file: File | null) => void;
  onExport: () => void;
  onExportAll: () => void;
  onPreview: () => void;
  onImport: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
        gap: 12,
      }}
    >
      <section style={cardStyle}>
        <div style={{ color: theme.colors.colorMagic, fontWeight: 900, letterSpacing: "0.08em", fontSize: "var(--fs-small)", textTransform: "uppercase" }}>
          Export
        </div>
        <div style={{ marginTop: 4, color: theme.colors.text, fontWeight: 800 }}>Download an editable category</div>
        <div style={{ marginTop: 4, color: theme.colors.muted, fontSize: "var(--fs-small)", lineHeight: 1.45 }}>
          Export one editable Beholden JSON file, or download every category in one ZIP.
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Select
            value={props.category}
            onChange={(event) => props.onCategoryChange(event.target.value as NativeCompendiumCategory)}
            disabled={props.busy}
            style={{ width: 180 }}
            aria-label="Compendium category to export"
          >
            {NATIVE_COMPENDIUM_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </Select>
          <Button onClick={props.onExport} disabled={props.busy}>
            {props.busy ? "Working..." : "Export JSON"}
          </Button>
          <Button onClick={props.onExportAll} disabled={props.busy}>
            {props.busy ? "Working..." : "Export All (.zip)"}
          </Button>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ color: theme.colors.accentPrimary, fontWeight: 900, letterSpacing: "0.08em", fontSize: "var(--fs-small)", textTransform: "uppercase" }}>
          Import
        </div>
        <div style={{ marginTop: 4, color: theme.colors.text, fontWeight: 800 }}>Preview, then import safely</div>
        <div style={{ marginTop: 4, color: theme.colors.muted, fontSize: "var(--fs-small)", lineHeight: 1.45 }}>
          Nothing changes until the selected file passes validation and you confirm the import.
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "7px 11px",
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: theme.radius.control,
              color: theme.colors.text,
              background: theme.colors.inputBg,
              cursor: props.busy ? "not-allowed" : "pointer",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Choose file
            <input
              type="file"
              accept=".json,application/json"
              disabled={props.busy}
              onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)}
              style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}
            />
          </label>
          <span
            title={props.fileName ?? "No file selected"}
            style={{
              color: props.fileName ? theme.colors.text : theme.colors.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {props.fileName ?? "No file selected"}
          </span>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={props.onPreview} disabled={!props.fileName || props.busy}>
            {props.busy ? "Working..." : "Preview import"}
          </Button>
          <Button
            onClick={props.onImport}
            disabled={!props.previewReady || props.busy}
            style={props.previewReady ? { background: theme.colors.green } : undefined}
          >
            {props.busy ? "Working..." : "Import now"}
          </Button>
        </div>
      </section>

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "2px 2px 0",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
          Need a clean slate? This removes every currently loaded compendium entry.
        </span>
        <Button
          variant="ghost"
          onClick={props.onDelete}
          disabled={props.busy}
          style={{ color: theme.colors.red, borderColor: "rgba(255,93,93,0.38)", marginLeft: 4 }}
        >
          Delete compendium
        </Button>
      </div>
    </div>
  );
}

export function NativeImportPreview({ preview }: { preview: NativePreviewResult }) {
  const number = new Intl.NumberFormat();
  const totals = [
    { label: "Total entries", value: preview.entries, color: theme.colors.text },
    { label: "New entries", value: preview.additions, color: theme.colors.green },
    { label: "Replacements", value: preview.replacements, color: theme.colors.colorGold },
  ];

  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid rgba(94,203,107,0.34)",
        borderRadius: 12,
        padding: 14,
        background: "rgba(94,203,107,0.055)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.colors.green, fontWeight: 900 }}>
        <span aria-hidden="true">✓</span>
        Valid Grand Schema file — ready to import
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {totals.map((total) => (
          <div key={total.label} style={{ ...cardStyle, padding: "10px 12px", background: "rgba(0,0,0,0.16)" }}>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{total.label}</div>
            <div style={{ marginTop: 2, color: total.color, fontWeight: 900, fontSize: "var(--fs-large)", fontVariantNumeric: "tabular-nums" }}>
              {number.format(total.value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6 }}>
        {preview.batches.map((batch) => (
          <div
            key={batch.category}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "2px 10px",
              padding: "9px 10px",
              borderRadius: 9,
              background: "rgba(0,0,0,0.16)",
              border: `1px solid ${theme.colors.panelBorder}`,
            }}
          >
            <span style={{ color: theme.colors.text, fontWeight: 800 }}>{categoryLabel(batch.category)}</span>
            <span style={{ color: theme.colors.text, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
              {number.format(batch.entries)}
            </span>
            <span style={{ color: theme.colors.green, fontSize: "var(--fs-tiny)" }}>
              {number.format(batch.additions)} new
            </span>
            <span style={{ color: theme.colors.colorGold, fontSize: "var(--fs-tiny)", textAlign: "right" }}>
              {number.format(batch.replacements)} replaced
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompendiumAdminFeedback(props: {
  msg: string;
}) {
  if (!props.msg) return null;
  const isError = /fail|invalid|error/iu.test(props.msg);
  return (
    <div
      role={isError ? "alert" : "status"}
      style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 10,
        color: isError ? theme.colors.red : theme.colors.text,
        background: isError ? "rgba(255,93,93,0.08)" : "rgba(56,182,255,0.07)",
        border: `1px solid ${isError ? "rgba(255,93,93,0.3)" : theme.colors.accentHighlightBorder}`,
        whiteSpace: "pre-wrap",
      }}
    >
      {props.msg}
    </div>
  );
}
