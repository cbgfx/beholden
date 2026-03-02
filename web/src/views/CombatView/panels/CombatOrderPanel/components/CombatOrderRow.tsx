// web/src/views/CombatView/panels/CombatOrderPanel/components/CombatOrderRow.tsx

import React from "react";
import type { Combatant } from "@/domain/types/domain";
import { theme, withAlpha } from "@/theme/theme";
import { IconINPC, IconMonster, IconPlayer, IconSkull, IconInitiative } from "@/icons";
import { InitiativeInput } from "@/views/CombatView/panels/CombatOrderPanel/components/InitiativeInput";
import { TurnBadge } from "@/views/CombatView/panels/CombatOrderPanel/components/TurnBadge";

function CombatantAvatar(props: {
  baseType: Combatant["baseType"];
  isDead: boolean;
  iconColor: string;
  isActive: boolean;
  isTarget: boolean;
}) {
  const { baseType, isDead, iconColor, isActive, isTarget } = props;

  const borderColor = isActive
    ? theme.colors.accentHighlight
    : isTarget ? theme.colors.blue
    : withAlpha(iconColor, 0.40);

  // Explicit JSX — don't use dynamic component variables with these icon types
  const iconEl = isDead ? <IconSkull size={22} />
    : baseType === "player" ? <IconPlayer size={22} />
    : baseType === "inpc" ? <IconINPC size={22} />
    : <IconMonster size={22} />;

  return (
    <div style={{ position: "relative", flex: "0 0 auto", width: 36, height: 36 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: withAlpha(iconColor, 0.12),
        border: `1px solid ${borderColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: iconColor,
        boxShadow: isActive ? `0 0 0 2px ${theme.colors.accentHighlight}`
          : isTarget ? `0 0 0 2px ${theme.colors.blue}` : "none",
      }}>
        <span style={{ color: iconColor, display: "inline-flex", alignItems: "center" }}>
          {iconEl}
        </span>
      </div>
      {(isActive || isTarget) && (
        <div style={{ position: "absolute", bottom: -4, right: -4, zIndex: 1 }}>
          <TurnBadge active={isActive} targeted={isTarget} />
        </div>
      )}
    </div>
  );
}

export function CombatOrderRow(props: {
  combatant: Combatant;
  section: "upcoming" | "wrapped";
  playersById: Record<string, {
    playerName: string; characterName: string; class: string;
    species: string; level: number; ac: number;
    hpMax: number; hpCurrent: number;
    deathSaves?: { success: number; fail: number };
  }>;
  activeId: string | null;
  targetId: string | null;
  onSelectTarget: (id: string) => void;
  onSetInitiative: (id: string, initiative: number) => void;
  getRowShadow: (isActive: boolean, isTarget: boolean) => string;
}) {
  const c = props.combatant;
  const isActive = c.id === props.activeId;
  const isTarget = c.id === props.targetId;

  const hpCurrent = Number(c.hpCurrent ?? 0);
  const rawHpMax = Number(c.hpMax ?? 1);
  const acBonus = Number(c.overrides?.acBonus ?? 0) || 0;
  const hpMod = (() => {
    const v = c.overrides?.hpMaxOverride;
    if (v == null) return 0;
    const n = Number(v); return Number.isFinite(n) ? n : 0;
  })();
  const hpMax = Math.max(1, (rawHpMax || 1) + hpMod);
  const ac = Math.max(0, Number(c.ac ?? 0) + acBonus);
  const displayName = (c.label || "(Unnamed)").trim();
  const friendly = Boolean(c.friendly);
  const isDead = hpCurrent <= 0;
  const dim = isDead && c.baseType !== "player";

   const iconColor = isDead ? theme.colors.muted
   : c.baseType === "player" ? theme.colors.blue
   : friendly ? theme.colors.green : theme.colors.red;

  const pct = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
  const barColor = isDead ? theme.colors.red
    : pct <= 0.25 ? theme.colors.red
    : pct <= 0.5 ? theme.colors.bloody
    : theme.colors.green;

  const tempHp = Math.max(0, Number(c.overrides?.tempHp ?? 0) || 0);
  const playerName = c.baseType === "player" ? (props.playersById[c.baseId]?.playerName ?? "") : "";
  const init = Number(c.initiative);
  const hasInit = Number.isFinite(init) && init !== 0;

  const statusBadge = (isActive || isTarget) && (
    <span style={{
      padding: "1px 7px", borderRadius: 999,
      fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: 0.6,
      textTransform: "uppercase" as const, color: theme.colors.text,
      border: `1px solid ${isActive ? theme.colors.accentHighlight : theme.colors.blue}`,
      background: isActive ? `${theme.colors.accentHighlight}22` : `${theme.colors.blue}22`,
    }}>
      {isActive && isTarget ? "Self" : isActive ? "Active" : "Target"}
    </span>
  );

  const initDisplay = !hasInit ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
      <IconInitiative size={11} />
      <InitiativeInput value={null} onCommit={(n) => props.onSetInitiative(c.id, n)} />
    </span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
      <IconInitiative size={11} />
      <span style={{ fontWeight: 900 }}>Init {init}</span>
    </span>
  );

  return (
    <button onClick={() => props.onSelectTarget(c.id)} style={{ all: "unset", cursor: "pointer", display: "block" }}>
      <div style={{
        borderRadius: 12, border: `1px solid ${theme.colors.panelBorder}`,
        overflow: "hidden", boxShadow: props.getRowShadow(isActive, isTarget),
        animation: isTarget ? "beholdenTargetPulse 1.8s ease-in-out infinite" : undefined,
        transform: isActive ? "translateY(-1px)" : "none", transition: "transform 80ms ease",
        opacity: dim ? 0.45 : 1, filter: dim ? "grayscale(0.85)" : "none",
      }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
          <CombatantAvatar baseType={c.baseType} isDead={isDead} iconColor={iconColor} isActive={isActive} isTarget={isTarget} />

          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
              <span style={{
                fontWeight: 900, fontSize: "var(--fs-large)",
                color: isDead ? theme.colors.muted : theme.colors.text,
                textDecoration: isDead ? "line-through" : "none",
                whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {displayName}
              </span>
              {playerName && <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted }}>({playerName})</span>}
              {statusBadge}
            </div>
            <div style={{ marginTop: 2 }}>{initDisplay}</div>
          </div>

          {/* AC + HP — --fs-body for readability */}
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ opacity: 0.5, fontSize: 12 }}>🛡</span>
              <span style={{ fontWeight: 900, fontSize: "var(--fs-body)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>{ac}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ opacity: 0.5, fontSize: 12 }}>♥</span>
              <span style={{ fontWeight: 900, fontSize: "var(--fs-body)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>{hpCurrent}/{hpMax}</span>
            </span>
          </div>
        </div>

        {/* HP bar — flush at bottom of row */}
        <div style={{ height: 4, background: withAlpha(theme.colors.shadowColor, 0.5), position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, width: `${pct * 100}%`, background: barColor, transition: "width 150ms ease" }} />
          {tempHp > 0 && (
            <div style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${pct * 100}%`, width: `${Math.min(1 - pct, tempHp / hpMax) * 100}%`,
              background: theme.colors.accentHighlight, opacity: 0.8,
            }} />
          )}
        </div>
      </div>
    </button>
  );
}