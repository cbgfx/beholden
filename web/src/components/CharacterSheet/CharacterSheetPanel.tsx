import React from "react";
import { theme } from "@/app/theme/theme";
import { IconAC, IconHP, IconSpeed } from "@/components/icons";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type CharacterSheetStats = {
  ac: number;
  hpCur: number;
  hpMax: number;
  tempHp?: number;
  speed: number | null;
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

function StatBar(props: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.panelBg,
        display: "grid",
        gridTemplateRows: "auto auto",
        alignItems: "center",
        justifyItems: "center",
        gap: 6
      }}
    >
      <div style={{ color: theme.colors.muted, fontWeight: 900, letterSpacing: 1, fontSize: "var(--fs-medium)" }}>{props.label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: "var(--fs-stat)" }}>
        {props.icon}
        <span>{props.value}</span>
      </div>
    </div>
  );
}

function AbilityTable(props: { stats: CharacterSheetStats }) {
  const { abilities, saves } = props.stats;
  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "68px 1fr 1fr 1fr",
    gap: 8,
    alignItems: "center"
  };
  const cellStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    background: theme.colors.panelBg,
    border: `1px solid ${theme.colors.panelBorder}`,
    fontWeight: 900,
    textAlign: "center"
  };

  const left: AbilityKey[] = ["str", "dex", "con"];
  const right: AbilityKey[] = ["int", "wis", "cha"];

  function renderGroup(keys: AbilityKey[]) {
    return (
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "68px 1fr 1fr 1fr",
            gap: 8,
            color: theme.colors.muted,
            fontWeight: 900,
            marginBottom: 6
          }}
        >
          <div />
          <div style={{ textAlign: "center" }}>MOD</div>
          <div style={{ textAlign: "center" }}>SAVE</div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {keys.map((k) => {
            const score = Number(abilities[k] ?? 10);
            const mod = abilityMod(score);
            const save = saves?.[k] != null ? Number(saves[k]) : mod;
            return (
              <div key={k} style={rowStyle}>
                <div style={{ color: theme.colors.muted, fontWeight: 900, textTransform: "uppercase" }}>{k}</div>
                <div style={cellStyle}>{Number.isFinite(mod) ? fmtMod(mod) : "—"}</div>
                <div style={cellStyle}>{Number.isFinite(save) ? fmtMod(save) : "—"}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{renderGroup(left)}{renderGroup(right)}</div>;
}

export function CharacterSheetPanel(props: {
  stats: CharacterSheetStats;
  topLeft?: React.ReactNode;
}) {
  const s = props.stats;
  const speedText = s.speed == null ? "—" : String(s.speed);

  const info = React.useMemo(
    () =>
      (s.infoLines ?? []).filter((l) => {
        const v = (l.value ?? "").trim();
        // Hide empty/placeholder values to reduce clutter ("Skills —", etc.)
        if (!v) return false;
        if (v === "—") return false;
        return true;
      }),
    [s.infoLines]
  );
  const [infoOpen, setInfoOpen] = React.useState(true);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <StatBar icon={<IconAC size={16} title="Armor Class" />} label="ARMOR CLASS" value={Number.isFinite(s.ac) ? s.ac : "—"} />
        <StatBar
          icon={<IconHP size={16} title="Hit Points" />}
          label="HIT POINTS"
          value={
            Number.isFinite(s.hpCur) && Number.isFinite(s.hpMax) && s.hpMax > 0
              ? `${s.hpCur} / ${s.hpMax}${(Number(s.tempHp ?? 0) || 0) ? ` (+${Number(s.tempHp ?? 0) || 0}t)` : ``}`
              : "—"
          }
        />
        <StatBar icon={<IconSpeed size={16} title="Speed" />} label="SPEED" value={speedText} />
      </div>

      <AbilityTable stats={s} />

      {info.length ? (
        <div
          style={{
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 12,
            background: theme.colors.panelBg,
            overflow: "hidden"
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
              padding: "10px 12px",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              color: theme.colors.text
            }}
            title={infoOpen ? "Collapse" : "Expand"}
          >
            <span style={{ fontWeight: 900, letterSpacing: 0.4 }}>Info</span>
            <span style={{ color: theme.colors.muted, fontWeight: 900 }}>{infoOpen ? "▾" : "▸"}</span>
          </button>

          {infoOpen ? (
            <div style={{ padding: "0 12px 10px 12px", display: "grid", gap: 6 }}>
              {info.map((l) => (
                <div key={l.label} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: theme.colors.muted, fontWeight: 900 }}>{l.label}</span>
                  <span style={{ color: theme.colors.text, fontWeight: 700 }}>{l.value || "—"}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {props.topLeft ? <div>{props.topLeft}</div> : null}
    </div>
  );
}
