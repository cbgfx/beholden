import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import type { AbilityKey, CharacterSheetStats } from "@/components/CharacterSheet/CharacterSheetPanel";
import { abilityMod, fmtMod } from "@/components/CharacterSheet/charSheetUtils";

const cols = "48px 38px 1fr 1fr";

const headerStyle: React.CSSProperties = {
  fontSize: "var(--fs-tiny)",
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: theme.colors.muted,
  textAlign: "center",
};

const scorePillStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 8,
  background: withAlpha(theme.colors.shadowColor, 0.5),
  border: `1px solid ${theme.colors.panelBorder}`,
  fontWeight: 900,
  fontSize: "var(--fs-medium)",
  textAlign: "center",
  color: theme.colors.text,
  fontVariantNumeric: "tabular-nums",
  minWidth: 32,
};

const modStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: "var(--fs-medium)",
  textAlign: "center",
  color: theme.colors.text,
  fontVariantNumeric: "tabular-nums",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--fs-small)",
  fontWeight: 900,
  textTransform: "uppercase",
  color: theme.colors.muted,
};

function AbilityGroup({ keys, abilities, saves }: { keys: AbilityKey[]; abilities: CharacterSheetStats["abilities"]; saves?: CharacterSheetStats["saves"] }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, marginBottom: 6 }}>
        <div />
        <div style={headerStyle}>Score</div>
        <div style={headerStyle}>Mod</div>
        <div style={headerStyle}>Save</div>
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        {keys.map((k) => {
          const score = Number(abilities[k] ?? 10);
          const mod = abilityMod(score);
          const save = saves?.[k] != null ? Number(saves[k]) : mod;
          return (
            <div key={k} style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center" }}>
              <div style={labelStyle}>{k}</div>
              <div style={scorePillStyle}>{score}</div>
              <div style={modStyle}>{Number.isFinite(mod) ? fmtMod(mod) : "—"}</div>
              <div style={modStyle}>{Number.isFinite(save) ? fmtMod(save) : "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AbilityTable({ stats }: { stats: CharacterSheetStats }) {
  const left: AbilityKey[] = ["str", "dex", "con"];
  const right: AbilityKey[] = ["int", "wis", "cha"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, padding: "10px 2px" }}>
      <AbilityGroup keys={left} abilities={stats.abilities} saves={stats.saves} />
      <AbilityGroup keys={right} abilities={stats.abilities} saves={stats.saves} />
    </div>
  );
}
