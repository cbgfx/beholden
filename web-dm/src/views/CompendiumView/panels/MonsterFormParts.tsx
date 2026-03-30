import * as React from "react";
import { theme, withAlpha } from "@/theme/theme";

export type MonsterBlock = { name: string; text: string };

export type MonsterForEdit = {
  id: string;
  name: string;
  cr: string | null;
  typeFull: string | null;
  size: string | null;
  environment: string | null;
  // These fields mirror raw compendium JSON and can be strings, numbers,
  // arrays, or nested objects depending on the data source — use unknown
  // and narrow with extractLeadingNumber / extractDetails before use.
  ac: unknown;
  hp: unknown;
  speed: unknown;
  str: number | null; dex: number | null; con: number | null;
  int: number | null; wis: number | null; cha: number | null;
  save: unknown; skill: unknown; senses: unknown; languages: unknown;
  immune: unknown; resist: unknown; vulnerable: unknown; conditionImmune: unknown;
  trait: MonsterBlock[];
  action: MonsterBlock[];
  reaction: MonsterBlock[];
  legendary: MonsterBlock[];
};

export const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

const SIZE_ABBR: Record<string, string> = {
  T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan",
};

export function normalizeSize(s: string | null | undefined): string {
  if (!s) return "";
  if (SIZES.includes(s)) return s;
  return SIZE_ABBR[s.trim().toUpperCase()] ?? s;
}

export const TYPES = [
  "aberration", "beast", "celestial", "construct", "dragon", "elemental",
  "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead",
];

export function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const val = obj.value ?? obj.average ?? null;
    const notes = obj.notes ?? null;
    if (val != null && notes) return `${val} (${notes})`;
    if (val != null) return String(val);
  }
  return String(v);
}

export function normalizeBlocks(arr: unknown): MonsterBlock[] {
  if (!Array.isArray(arr)) return [];
  return (arr as Array<Record<string, unknown>>).map((b) => ({
    name: String(b?.name ?? b?.title ?? ""),
    text: String(b?.text ?? b?.description ?? ""),
  }));
}

export const baseInput: React.CSSProperties = {
  background: theme.colors.inputBg,
  color: theme.colors.text,
  border: `1px solid ${theme.colors.panelBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  outline: "none",
  fontSize: "var(--fs-subtitle)",
  width: "100%",
  boxSizing: "border-box",
};

export function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: "var(--fs-small)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
      color: theme.colors.muted, borderBottom: `1px solid ${theme.colors.panelBorder}`,
      paddingBottom: 4, marginBottom: 8,
    }}>
      {title}
    </div>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>;
}

export function Field({ label, children, grow, style }: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: grow ? 1 : undefined, minWidth: 0, ...style }}>
      <label style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

export function AbilityInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
      <label style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 600 }}>{label}</label>
      <input
        type="number" min={1} max={30} value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...baseInput, width: 56, textAlign: "center", padding: "6px 4px" }}
      />
    </div>
  );
}

export function BlockEditor({ label, blocks, onChange }: {
  label: string;
  blocks: MonsterBlock[];
  onChange: (b: MonsterBlock[]) => void;
}) {
  function addBlock() { onChange([...blocks, { name: "", text: "" }]); }
  function removeBlock(i: number) { onChange(blocks.filter((_, idx) => idx !== i)); }
  function updateBlock(i: number, field: keyof MonsterBlock, val: string) {
    onChange(blocks.map((b, idx) => idx === i ? { ...b, [field]: val } : b));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <SectionHeader title={label} />
        <button
          type="button" onClick={addBlock}
          style={{
            fontSize: "var(--fs-small)", fontWeight: 700, padding: "2px 8px", borderRadius: 6, cursor: "pointer",
            border: `1px solid ${theme.colors.panelBorder}`,
            background: withAlpha(theme.colors.accentPrimary, 0.15),
            color: theme.colors.accentPrimary,
          }}
        >
          + Add
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {blocks.map((b, i) => (
          <div key={i} style={{
            border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 8,
            padding: 8, display: "flex", flexDirection: "column", gap: 6,
            background: withAlpha(theme.colors.panelBg, 0.5),
          }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={b.name} onChange={(e) => updateBlock(i, "name", e.target.value)}
                placeholder="Name"
                style={{ ...baseInput, flex: 1, fontWeight: 600 }}
              />
              <button
                type="button" onClick={() => removeBlock(i)}
                style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${withAlpha(theme.colors.red, 0.35)}`,
                  background: withAlpha(theme.colors.red, 0.12),
                  color: theme.colors.red, fontSize: "var(--fs-medium)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
            <textarea
              value={b.text} onChange={(e) => updateBlock(i, "text", e.target.value)}
              placeholder="Description…"
              rows={3}
              style={{ ...baseInput, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
        ))}
        {blocks.length === 0 && (
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontStyle: "italic" }}>None</div>
        )}
      </div>
    </div>
  );
}
