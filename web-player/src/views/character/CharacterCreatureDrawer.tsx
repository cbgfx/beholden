import React, { useEffect, useState } from "react";
import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import { MonsterStatblock } from "@/views/CompendiumView/panels/MonsterStatblock";
import type { CharacterCreature } from "@/views/character/CharacterSheetTypes";
import { accentButtonStyle, ghostButtonStyle } from "@beholden/shared/ui";

const numberInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: C.bg,
  color: C.text,
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: "var(--fs-subtitle)",
  outline: "none",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: C.muted,
  fontSize: "var(--fs-small)",
  fontWeight: 700,
};

const textInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: C.bg,
  color: C.text,
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: "var(--fs-subtitle)",
  outline: "none",
};

export function CharacterCreatureDrawer(props: {
  creature: CharacterCreature | null;
  monster: any | null;
  busy: boolean;
  error: string | null;
  accentColor: string;
  onClose: () => void;
  onSave: (creature: CharacterCreature) => void;
  onDelete: (creatureId: string) => void;
}) {
  const [draft, setDraft] = useState<CharacterCreature | null>(props.creature);

  useEffect(() => {
    setDraft(props.creature);
  }, [props.creature]);

  if (!props.creature || !draft) return null;

  return (
    <RightDrawer
      onClose={props.onClose}
      width="min(640px, 94vw)"
      title={
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: C.text }}>{draft.name}</div>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
            {draft.label?.trim() || props.monster?.name || "Creature"}
          </div>
        </div>
      }
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => props.onDelete(props.creature!.id)}
            style={ghostButtonStyle({
              textColor: C.red,
              borderColor: "rgba(239,68,68,0.28)",
              padding: "8px 14px",
              fontSize: "var(--fs-subtitle)",
              borderRadius: 8,
            })}
          >
            Remove Creature
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={props.onClose}
              style={ghostButtonStyle({
                textColor: C.muted,
                borderColor: "rgba(255,255,255,0.14)",
                padding: "8px 14px",
                fontSize: "var(--fs-subtitle)",
                borderRadius: 8,
              })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => props.onSave({
                ...draft,
                hpCurrent: Math.max(0, Math.floor(Number(draft.hpCurrent) || 0)),
                hpMax: Math.max(1, Math.floor(Number(draft.hpMax) || 1)),
                ac: Math.max(1, Math.floor(Number(draft.ac) || 1)),
              })}
              style={accentButtonStyle({
                background: props.accentColor,
                color: "#081018",
                padding: "8px 14px",
                fontSize: "var(--fs-subtitle)",
                borderRadius: 8,
              })}
            >
              Save
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>
          Manage this creature here. Its compendium stat block stays available below for reference while you track custom HP, AC, notes, and naming.
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <label style={fieldLabelStyle}>
            <span>Display Name</span>
            <input value={draft.name} onChange={(e) => setDraft((prev) => prev ? { ...prev, name: e.target.value } : prev)} style={textInputStyle} />
          </label>
          <label style={fieldLabelStyle}>
            <span>Label</span>
            <input value={draft.label ?? ""} onChange={(e) => setDraft((prev) => prev ? { ...prev, label: e.target.value } : prev)} placeholder="Familiar, Pact Creature, Ranger Companion..." style={textInputStyle} />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.muted, fontSize: "var(--fs-small)" }}>
            <input type="checkbox" checked={!!draft.friendly} onChange={(e) => setDraft((prev) => prev ? { ...prev, friendly: e.target.checked } : prev)} />
            Friendly to the party
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={fieldLabelStyle}>
              <span>HP Current</span>
              <input type="number" min={0} value={draft.hpCurrent} onChange={(e) => setDraft((prev) => prev ? { ...prev, hpCurrent: Number(e.target.value) || 0 } : prev)} style={numberInputStyle} />
            </label>
            <label style={fieldLabelStyle}>
              <span>HP Max</span>
              <input type="number" min={1} value={draft.hpMax} onChange={(e) => setDraft((prev) => prev ? { ...prev, hpMax: Number(e.target.value) || 1 } : prev)} style={numberInputStyle} />
            </label>
          </div>
          <label style={fieldLabelStyle}>
            <span>HP Details</span>
            <input value={draft.hpDetails ?? ""} onChange={(e) => setDraft((prev) => prev ? { ...prev, hpDetails: e.target.value } : prev)} placeholder="Temporary HP, special notes, form-specific details..." style={textInputStyle} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={fieldLabelStyle}>
              <span>Armor Class</span>
              <input type="number" min={1} value={draft.ac} onChange={(e) => setDraft((prev) => prev ? { ...prev, ac: Number(e.target.value) || 1 } : prev)} style={numberInputStyle} />
            </label>
            <label style={fieldLabelStyle}>
              <span>AC Details</span>
              <input value={draft.acDetails ?? ""} onChange={(e) => setDraft((prev) => prev ? { ...prev, acDetails: e.target.value } : prev)} placeholder="Natural armor, barding, shield..." style={textInputStyle} />
            </label>
          </div>
          <label style={fieldLabelStyle}>
            <span>Notes</span>
            <textarea value={draft.notes ?? ""} onChange={(e) => setDraft((prev) => prev ? { ...prev, notes: e.target.value } : prev)} rows={5} placeholder="Commands, summon duration, ownership, tactics..." style={{ ...textInputStyle, resize: "vertical", minHeight: 120, fontFamily: "inherit", lineHeight: 1.5 }} />
          </label>
        </div>

        <div style={{ height: 1, background: C.panelBorder }} />

        {props.busy ? (
          <div style={{ color: C.muted }}>Loading compendium stat block...</div>
        ) : props.error ? (
          <div style={{ color: C.red }}>{props.error}</div>
        ) : (
          <MonsterStatblock monster={props.monster} />
        )}
      </div>
    </RightDrawer>
  );
}
