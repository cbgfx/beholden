import React from "react";
import { theme, withAlpha } from "@/theme/theme";

export function HPBar(props: {
  cur: number;
  max: number;
  ac: number;
  tempHp?: number;
  acBonus?: number;
  variant?: "default" | "compact";
  showText?: boolean;
}) {
  const max = Math.max(1, Number(props.max) || 1);
  const curHP = Math.max(0, Number(props.cur) || 0);
  const tempHp = Math.max(0, Number(props.tempHp ?? 0) || 0);
  const pct = Math.max(0, Math.min(1, curHP / max));
  const acBonus = Number(props.acBonus ?? 0) || 0;
  const ac = Number(props.ac) + acBonus;
  const isDead = curHP <= 0;
  const isBloody = ((curHP / max <= 0.5) && (curHP / max > 0.25));
  const isQuarter = curHP / max <= 0.25;
  const barColor = isDead ? theme.colors.red : isBloody ? theme.colors.bloody : isQuarter? theme.colors.red : theme.colors.green;

  const variant = props.variant ?? "default";
  const showText = props.showText ?? true;
  const barHeight = variant === "compact" ? 8 : 12;
  const textSize = variant === "compact" ? 11 : 12;

  return (
    <div style={{ display: "grid", gap: variant === "compact" ? 4 : 6, justifyItems: "center" }}>
      <div
        style={{
          width: "100%",
          height: barHeight,
          borderRadius: 999,
          background: withAlpha(theme.colors.shadowColor, 0.28),
          border: `1px solid ${theme.colors.panelBorder}`,
          overflow: "hidden",
          position: "relative"
        }}
      >
        {/* Base HP */}
        <div
          style={{
            height: "100%",
            border: `1px solid ${theme.colors.bg}`,
            width: `${pct * 100}%`,
            background: barColor,
            borderRadius: 999
          }}
        />

        {/* Temp HP overlay (extends beyond current HP) */}
        {tempHp > 0 ? (
          <div
            style={{
              position: "absolute",
              left: `${pct * 100}%`,
              top: 0,
              height: "100%",
              width: `${Math.max(0, Math.min(1, tempHp / max)) * 100}%`,
              background: theme.colors.accentHighlight,
              opacity: 0.9
            }}
          />
        ) : null}
      </div>

      {showText ? (
        <div style={{ fontSize: textSize, color: theme.colors.text, opacity: 0.85, whiteSpace: "nowrap" }}>
          AC {ac}{acBonus ? ` (+${acBonus})` : ""} • HP {curHP}/{max}{tempHp ? ` • THP ${tempHp}` : ""}
          {isDead ? " (Dead)" : isBloody ? " (Bloody)" : isQuarter ? " (Bloody)" : ""}
        </div>
      ) : null}
    </div>
  );
}