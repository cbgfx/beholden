import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconAC, IconHP, IconSpeed } from "@/icons";

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

function abilityMod(score: number) {
  return Math.floor((score - 10) / 2);
}
function fmtMod(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

// ── Unified stat bar (ShieldMaiden style) ─────────────────────────────────────
function StatBar(props: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  flex?: number;
}) {
  return (
    <div
      style={{
        flex: props.flex ?? 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "8px 10px",
      }}
    >
      {/* Label row */}
      <div
        style={{
          fontSize: "var(--fs-tiny)",
          fontWeight: 900,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: theme.colors.muted,
          whiteSpace: "nowrap",
        }}
      >
        {props.label}
      </div>
      {/* Value row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 900,
          fontSize: "var(--fs-stat)",
          color: theme.colors.text,
        }}
      >
        <span style={{ opacity: 0.65, display: "flex", alignItems: "center" }}>
          {props.icon}
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{props.value}</span>
      </div>
    </div>
  );
}

// ── Ability table with raw score pill (ShieldMaiden style) ───────────────────
function AbilityTable(props: { stats: CharacterSheetStats }) {
  const { abilities, saves } = props.stats;
  const left: AbilityKey[] = ["str", "dex", "con"];
  const right: AbilityKey[] = ["int", "wis", "cha"];

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

  // grid: label | score | MOD | SAVE
  const cols = "48px 38px 1fr 1fr";

  function renderGroup(keys: AbilityKey[]) {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 6,
            marginBottom: 6,
            paddingLeft: 0,
          }}
        >
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
              <div
                key={k}
                style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center" }}
              >
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

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "10px 2px",
      }}
    >
      {renderGroup(left)}
      <div style={{ width: 1, background: theme.colors.panelBorder, alignSelf: "stretch" }} />
      {renderGroup(right)}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
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

      {/* ── Unified stat bar ── */}
      <div
        style={{
          display: "flex",
          borderRadius: 12,
          border: `1px solid ${theme.colors.panelBorder}`,
          background: theme.colors.panelBg,
          overflow: "hidden",
        }}
      >
        <StatBar icon={<IconAC size={14} />} label="Armor Class" value={Number.isFinite(s.ac) ? s.ac : "—"} />
        <div style={{ width: 1, background: theme.colors.panelBorder }} />
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
          flex={1.4}
        />
        <div style={{ width: 1, background: theme.colors.panelBorder }} />
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
                <div
                  key={l.label}
                  style={{ display: "flex", gap: 6, fontSize: "var(--fs-small)", lineHeight: 1.4 }}
                >
                  <span style={{ color: theme.colors.muted, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {l.label}
                  </span>
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
