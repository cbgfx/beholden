import React from "react";
import { C } from "@/lib/theme";
import type { EditableSheetOverrideField, SheetOverrides } from "@/views/character/CharacterViewHelpers";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";

export function CharacterInfoDrawer(props: {
  open: boolean;
  accentColor: string;
  identityFields: Array<[string, string]>;
  editableOverrideFields: EditableSheetOverrideField[];
  overridesDraft: SheetOverrides;
  abilityOverridesDraft: Partial<Record<AbilKey, number>>;
  colorDraft: string;
  colorPresets: string[];
  overridesSaving: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onColorChange: (value: string) => void;
  onOverrideChange: (key: EditableSheetOverrideField["key"], value: number) => void;
  onAbilityOverrideChange: (key: AbilKey, value: number | null) => void;
}) {
  if (!props.open) return null;
  return (
    <>
      <div
        onClick={props.onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(7,10,18,0.55)",
          zIndex: 70,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(560px, 92vw)",
          bottom: 0,
          height: "100dvh",
          maxHeight: "100dvh",
          background: "#11182a",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-16px 0 40px rgba(0,0,0,0.45)",
          zIndex: 71,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: "var(--fs-hero)", fontWeight: 900, color: C.text, marginBottom: 4 }}>Character Information</div>
            <div style={{ fontSize: "var(--fs-subtitle)", color: C.muted }}>Identity details and sheet overrides.</div>
          </div>
          <button
            onClick={props.onClose}
            style={{
              padding: "9px 16px",
              borderRadius: 12,
              cursor: "pointer",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: C.text,
              fontWeight: 700,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: props.accentColor, marginBottom: 12 }}>Identity</div>
            {props.identityFields.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {props.identityFields.map(([label, value]) => (
                  <div key={label} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                    <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: C.text, lineHeight: 1.25 }}>{value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: C.muted }}>
                No character information filled in yet.
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: props.accentColor, marginBottom: 12 }}>Theme</div>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sheet color</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Array.from(new Set([...props.colorPresets, props.colorDraft])).map((color) => {
                  const selected = props.colorDraft === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => props.onColorChange(color)}
                      title={color}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        cursor: "pointer",
                        padding: 0,
                        background: color,
                        border: `2px solid ${selected ? "#ffffff" : "rgba(255,255,255,0.16)"}`,
                        boxShadow: selected ? `0 0 0 3px ${color}66` : "none",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: props.accentColor, marginBottom: 12 }}>Overrides</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {props.editableOverrideFields.map((field) => (
                <label key={field.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: "var(--fs-small)", color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{field.label}</span>
                  <input
                    type="number"
                    value={props.overridesDraft[field.key]}
                    onChange={(e) => {
                      const value = e.target.value;
                      props.onOverrideChange(field.key, value === "" || value === "-" ? 0 : Number(value));
                    }}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.05)",
                      color: C.text,
                      fontSize: "var(--fs-body)",
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.6)" }}>{field.help}</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ability score override</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {([
                  ["str", "STR"],
                  ["dex", "DEX"],
                  ["con", "CON"],
                  ["int", "INT"],
                  ["wis", "WIS"],
                  ["cha", "CHA"],
                ] as [AbilKey, string][]).map(([ability, label]) => (
                  <label key={ability} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, letterSpacing: "0.08em" }}>{label}</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      placeholder="--"
                      value={props.abilityOverridesDraft[ability] ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw) {
                          props.onAbilityOverrideChange(ability, null);
                          return;
                        }
                        const value = Math.floor(Number(raw));
                        props.onAbilityOverrideChange(ability, Number.isFinite(value) ? value : null);
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.05)",
                        color: C.text,
                        fontSize: "var(--fs-body)",
                        fontWeight: 700,
                        outline: "none",
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 24px calc(24px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: 12, flexShrink: 0 }}>
          <button
            onClick={props.onClose}
            style={{
              padding: "11px 18px",
              borderRadius: 12,
              cursor: "pointer",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: C.text,
              fontWeight: 700,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void props.onSave()}
            disabled={props.overridesSaving}
            style={{
              padding: "11px 18px",
              borderRadius: 12,
              cursor: props.overridesSaving ? "default" : "pointer",
              background: props.accentColor,
              border: "none",
              color: "#fff",
              fontWeight: 800,
              opacity: props.overridesSaving ? 0.7 : 1,
            }}
          >
            {props.overridesSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
