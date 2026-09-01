import type React from "react";
import { C } from "@/lib/theme";
import { Button } from "@/ui/Button";
import { RightDrawer } from "@/ui/RightDrawer";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import type { SheetOverrides } from "@/views/character/CharacterViewTypes";

const ABILITIES: Array<[AbilKey, string]> = [
  ["str", "STR"], ["dex", "DEX"], ["con", "CON"],
  ["int", "INT"], ["wis", "WIS"], ["cha", "CHA"],
];

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
  color: C.text, fontSize: "var(--fs-body)", fontWeight: 700, outline: "none",
};

export function CharacterPermanentBuffsDrawer(props: {
  open: boolean;
  accentColor: string;
  overridesDraft: SheetOverrides;
  abilityOverridesDraft: Partial<Record<AbilKey, number>>;
  saving: boolean;
  onOverridesChange: React.Dispatch<React.SetStateAction<SheetOverrides>>;
  onAbilityOverridesChange: React.Dispatch<React.SetStateAction<Partial<Record<AbilKey, number>>>>;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}) {
  if (!props.open) return null;

  const setNumeric = (key: "acBonus" | "hpMaxBonus", value: string) => {
    const number = Math.floor(Number(value) || 0);
    props.onOverridesChange((previous) => ({
      ...previous, [key]: number,
      permanent: { ...(previous.permanent ?? {}), [key]: number !== 0 },
    }));
  };

  const setAbility = (key: AbilKey, raw: string) => {
    props.onAbilityOverridesChange((previous) => {
      const next = { ...previous };
      const value = Math.floor(Number(raw));
      if (!raw.trim() || !Number.isFinite(value) || value === 0) delete next[key];
      else next[key] = value;
      props.onOverridesChange((overrides) => ({
        ...overrides,
        permanent: { ...(overrides.permanent ?? {}), abilityScores: Object.keys(next).length > 0 },
      }));
      return next;
    });
  };

  return (
    <RightDrawer
      title={<span style={{ color: props.accentColor, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Permanent Buffs</span>}
      onClose={props.onClose}
      footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><Button variant="ghost" onClick={props.onClose}>Cancel</Button><Button variant="primary" disabled={props.saving} onClick={() => void props.onSave()}>{props.saving ? "Saving..." : "Save buffs"}</Button></div>}
    >
      <p style={{ margin: "0 0 18px", color: C.muted, lineHeight: 1.5 }}>These bonuses remain active after a long rest. Set a value to 0 or clear an ability to remove it.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}><span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 800 }}>AC BONUS</span><input type="number" value={props.overridesDraft.acBonus} onChange={(event) => setNumeric("acBonus", event.target.value)} style={inputStyle} /></label>
        <label style={{ display: "grid", gap: 6 }}><span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 800 }}>MAX HP BONUS</span><input type="number" value={props.overridesDraft.hpMaxBonus} onChange={(event) => setNumeric("hpMaxBonus", event.target.value)} style={inputStyle} /></label>
      </div>
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ color: props.accentColor, fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.08em", marginBottom: 12 }}>ABILITY SCORE BONUSES</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {ABILITIES.map(([key, label]) => <label key={key} style={{ display: "grid", gap: 5 }}><span style={{ color: C.muted, fontSize: "var(--fs-tiny)", fontWeight: 800 }}>{label}</span><input type="number" placeholder="0" value={props.abilityOverridesDraft[key] ?? ""} onChange={(event) => setAbility(key, event.target.value)} style={inputStyle} /></label>)}
        </div>
      </div>
    </RightDrawer>
  );
}
