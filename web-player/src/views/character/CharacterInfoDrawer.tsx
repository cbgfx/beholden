import { useEffect, useMemo, useState } from "react";
import { C } from "@/lib/theme";
import { api, jsonInit } from "@/services/api";
import type { EditableSheetOverrideField, SheetOverrides } from "@/views/character/CharacterViewHelpers";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";

const identityInputStyle = {
  padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)", color: C.text, font: "inherit", resize: "vertical" as const,
};

export function CharacterInfoDrawer(props: {
  open: boolean;
  characterId: string;
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
  type LinkedIdentity = { id: string; name: string; gender: string | null; age: number | null; description: string | null; backstory: string | null };
  const [linked, setLinked] = useState<LinkedIdentity | null>(null);
  const [linkedOpen, setLinkedOpen] = useState(false);
  const [linkedSaving, setLinkedSaving] = useState(false);
  const [linkedDraft, setLinkedDraft] = useState({ gender: "", age: "", description: "", backstory: "" });
  useEffect(() => {
    if (!props.open) return;
    api<LinkedIdentity>(`/api/me/characters/${props.characterId}/binder-identity`).then((value) => {
      setLinked(value);
      setLinkedDraft({ gender: value.gender ?? "", age: value.age == null ? "" : String(value.age), description: value.description ?? "", backstory: value.backstory ?? "" });
    }).catch(() => setLinked(null));
  }, [props.characterId, props.open]);
  const displayedIdentityFields = useMemo(() => {
    if (!linked || props.identityFields.some(([label]) => label === "Age") || linked.age == null) return props.identityFields;
    return [...props.identityFields, ["Age", String(linked.age)] as [string, string]];
  }, [linked, props.identityFields]);
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: props.accentColor }}>Identity</div>
              {linked ? <button type="button" title="Edit linked Binder identity" aria-label="Edit linked Binder identity" onClick={() => setLinkedOpen((value) => !value)} style={{ border: 0, padding: 2, background: "transparent", color: props.accentColor, cursor: "pointer", display: "inline-flex" }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>
              </button> : null}
            </div>
            {displayedIdentityFields.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {displayedIdentityFields.map(([label, value]) => (
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
            {linked && linkedOpen ? <div style={{ marginTop: 12, display: "grid", gap: 10, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <strong style={{ color: C.text }}>Linked Binder identity · {linked.name}</strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 5, color: C.muted }}>Gender<input value={linkedDraft.gender} onChange={(event) => setLinkedDraft((value) => ({ ...value, gender: event.target.value }))} style={identityInputStyle} /></label>
                <label style={{ display: "grid", gap: 5, color: C.muted }}>Age<input type="number" min={0} value={linkedDraft.age} onChange={(event) => setLinkedDraft((value) => ({ ...value, age: event.target.value }))} style={identityInputStyle} /></label>
              </div>
              <label style={{ display: "grid", gap: 5, color: C.muted }}>Description<textarea rows={3} value={linkedDraft.description} onChange={(event) => setLinkedDraft((value) => ({ ...value, description: event.target.value }))} style={identityInputStyle} /></label>
              <label style={{ display: "grid", gap: 5, color: C.muted }}>Backstory<textarea rows={5} value={linkedDraft.backstory} onChange={(event) => setLinkedDraft((value) => ({ ...value, backstory: event.target.value }))} style={identityInputStyle} /></label>
              <button type="button" disabled={linkedSaving} onClick={async () => {
                setLinkedSaving(true);
                try {
                  await api(`/api/me/characters/${props.characterId}/binder-identity`, jsonInit("PATCH", { gender: linkedDraft.gender.trim() || null, age: linkedDraft.age.trim() ? Number(linkedDraft.age) : null, description: linkedDraft.description || null, backstory: linkedDraft.backstory || null }));
                  setLinked((value) => value ? { ...value, gender: linkedDraft.gender || null, age: linkedDraft.age ? Number(linkedDraft.age) : null, description: linkedDraft.description || null, backstory: linkedDraft.backstory || null } : value);
                } finally { setLinkedSaving(false); }
              }} style={{ justifySelf: "end", padding: "9px 14px", borderRadius: 10, border: 0, background: props.accentColor, color: "#fff", fontWeight: 800, cursor: "pointer" }}>{linkedSaving ? "Saving…" : "Save Binder Identity"}</button>
            </div> : null}
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
