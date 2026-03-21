import React from "react";
import { theme } from "@/theme/theme";
import { IconAC, IconHP, IconSpeed } from "@/icons";
import { StatBar } from "@/components/CharacterSheet/StatBar";
import { AbilityTable } from "@/components/CharacterSheet/AbilityTable";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type CharacterSheetStats = {
  ac: number;
  hpCur: number;
  hpMax: number;
  tempHp?: number;
  speed: number | null;
  speedDisplay?: string;
  abilities: Record<AbilityKey, number>;
  saves?: Partial<Record<AbilityKey, number>>;
  infoLines?: Array<{ label: string; value: string }>;
};

export function CharacterSheetPanel(props: {
  stats: CharacterSheetStats;
  topLeft?: React.ReactNode;
}) {
  const s = props.stats;

  const speedText = (() => {
    const d = (s.speedDisplay ?? "").trim();
    if (d) return d;
    return s.speed == null ? "—" : `${s.speed} ft.`;
  })();

  const hpValue =
    Number.isFinite(s.hpCur) && Number.isFinite(s.hpMax) && s.hpMax > 0
      ? `${s.hpCur} / ${s.hpMax}`
      : "—";

  const tempHp = Number(s.tempHp ?? 0) || 0;

  const info = (s.infoLines ?? []).filter(
    (l) => l.value?.trim() && l.value.trim() !== "—"
  );
  const [infoOpen, setInfoOpen] = React.useState(true);

  return (
    <div style={{ display: "grid", gap: 10 }}>

      {/* ── Stat bar (AC / HP / Speed) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          borderRadius: 12,
          border: `1px solid ${theme.colors.panelBorder}`,
          background: theme.colors.panelBg,
          overflow: "hidden",
        }}
      >
        <StatBar icon={<IconAC size={14} />} label="Armor Class" value={Number.isFinite(s.ac) ? s.ac : "—"} />
        <StatBar
          icon={<IconHP size={14} />}
          label="Hit Points"
          value={
            <>
              {hpValue}
              {tempHp > 0 && (
                <span style={{ color: theme.colors.accentHighlight, fontSize: "var(--fs-small)", marginLeft: 4 }}>
                  +{tempHp}t
                </span>
              )}
            </>
          }
        />
        <StatBar icon={<IconSpeed size={14} />} label="Speed" value={speedText} />
      </div>

      {/* ── Ability table ── */}
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.colors.panelBorder}`,
          background: theme.colors.panelBg,
          padding: "8px 12px",
        }}
      >
        <AbilityTable stats={s} />
      </div>

      {/* ── Info lines (collapsible) ── */}
      {info.length > 0 && (
        <div
          style={{
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 12,
            background: theme.colors.panelBg,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              color: theme.colors.text,
              fontSize: "var(--fs-small)",
              fontWeight: 900,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            <span>Details</span>
            <span style={{ color: theme.colors.muted }}>{infoOpen ? "▲" : "▼"}</span>
          </button>

          {infoOpen && (
            <div style={{ padding: "0 12px 10px", display: "grid", gap: 4 }}>
              {info.map((l) => (
                <div key={l.label} style={{ display: "flex", gap: 6, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
                  <span style={{ color: theme.colors.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{l.label}</span>
                  <span style={{ color: theme.colors.text }}>{l.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
