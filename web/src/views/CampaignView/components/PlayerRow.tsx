import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconPlayer, IconHeart, IconShield } from "@/icons";
import { PlayerDeathSaves } from "./PlayerDeathSaves";
import { PlayerConditions } from "./PlayerConditions";
import type { RowMenuItem } from "@/ui/RowMenu";
import { RowMenu } from "@/ui/RowMenu";

export type PlayerVM = {
  id: string;
  playerId?: string;
  encounterId?: string;
  playerName?: string;
  characterName: string;
  class: string;
  species: string;
  level: number;
  ac: number;
  hpMax: number;
  hpCurrent: number;
  tempHp?: number;
  acBonus?: number;
  conditions?: { key: string; casterId?: string | null }[];
  deathSaves?: { success: number; fail: number };
};

export function PlayerRow(props: {
  p: PlayerVM;
  // Primary inline action(s) — keep to 1-2 max
  // null = suppress action area entirely (combat list: clicking the row IS the action)
  primaryAction?: React.ReactNode | null;
  // Items for the … overflow menu. Hidden if empty/undefined.
  menuItems?: RowMenuItem[];
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  // Legacy compat — renders directly instead of menu
  actions?: React.ReactNode | null;
  onEdit?: () => void;
  variant?: "campaign" | "combatList";
}) {
  const p = props.p;
  const variant = props.variant ?? "campaign";
  const isCombatList = variant === "combatList";

  const max = Math.max(1, Number(p.hpMax) || 1);
  const cur = Math.max(0, Number(p.hpCurrent) || 0);
  const pct = cur / max;
  const isDead = cur <= 0;
  const showDeathSaves = isDead && Boolean(p.playerName);

  const tempHp = Math.max(0, Number((p as any).tempHp ?? 0) || 0);
  const acTotal = Number(p.ac ?? 0) + (Number((p as any).acBonus ?? 0) || 0);

  const barColor = isDead
    ? theme.colors.red
    : pct <= 0.25
      ? theme.colors.red
      : pct <= 0.5
        ? theme.colors.bloody
        : theme.colors.green;

  const iconColor = isDead ? theme.colors.muted : theme.colors.blue;

  const bg = isCombatList ? "transparent" : withAlpha(theme.colors.shadowColor, 0.18);
  const border = isCombatList ? "none" : `1px solid ${theme.colors.panelBorder}`;
  const borderRadius = isCombatList ? 0 : 12;
  const padding = isCombatList ? "8px 10px" : "10px 12px";

  const hasLegacyActions = props.actions !== undefined;
  const showMenu = !hasLegacyActions && Boolean(props.menuItems?.length);

  const metaLine = props.subtitle ?? (
    p.level || p.species || p.class
      ? <>{p.level ? `Lvl ${p.level} ` : ""}{p.species} {p.class}</>
      : null
  );

  return (
    <div style={{ padding, borderRadius, background: bg, border, display: "flex", flexDirection: "column", gap: 6 }}>

      {/* Top row: avatar · name/meta · stats · actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>

        {/* Avatar */}
        <div style={{
          flex: "0 0 auto", width: 36, height: 36, borderRadius: 8,
          background: withAlpha(iconColor, 0.15),
          border: `1px solid ${withAlpha(iconColor, 0.35)}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: iconColor,
        }}>
          {props.icon ?? <IconPlayer size={20} />}
        </div>

        {/* Name + meta */}
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{
            fontWeight: 900, fontSize: "var(--fs-large)",
            color: isDead ? theme.colors.muted : theme.colors.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            lineHeight: 1.25,
            textDecoration: isDead ? "line-through" : "none",
          }}>
            {p.characterName}
            {p.playerName ? (
              <span style={{ fontWeight: 600, fontSize: "var(--fs-small)", color: theme.colors.muted, marginLeft: 6 }}>
                ({p.playerName})
              </span>
            ) : null}
          </div>
          {metaLine ? (
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {metaLine}
            </div>
          ) : null}
        </div>

        {/* AC + HP */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconShield size={12} style={{ opacity: 0.55, color: theme.colors.muted }} />
            <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>
              {acTotal}
            </span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconHeart size={12} style={{ opacity: 0.55, color: theme.colors.muted }} />
            <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>
              {cur}/{max}
              {tempHp ? <span style={{ color: theme.colors.accentHighlight, marginLeft: 3, fontSize: "var(--fs-small)" }}>+{tempHp}</span> : null}
            </span>
          </span>
        </div>

        {/* Action area */}
        {props.actions !== null && (
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            {hasLegacyActions ? props.actions : null}
            {!hasLegacyActions && props.primaryAction != null ? props.primaryAction : null}
            {showMenu ? <RowMenu items={props.menuItems!} /> : null}
          </div>
        )}
      </div>

      {/* HP bar — full width, indented to align with name */}
      <div style={{ paddingLeft: 46 }}>
        {showDeathSaves ? (
          <PlayerDeathSaves
            playerId={p.playerId}
            encounterId={p.encounterId}
            combatantId={p.id}
            variant={variant}
            persisted={p.deathSaves}
            hpCurrent={cur}
          />
        ) : (
          <div style={{ position: "relative", height: 6, borderRadius: 999, background: withAlpha(theme.colors.shadowColor, 0.4), overflow: "hidden" }}>
            <div style={{
              position: "absolute", inset: 0,
              width: `${Math.max(0, Math.min(1, pct)) * 100}%`,
              background: barColor, borderRadius: 999,
              transition: "width 150ms ease",
            }} />
            {tempHp > 0 && (
              <div style={{
                position: "absolute", top: 0, bottom: 0,
                left: `${Math.min(1, pct) * 100}%`,
                width: `${Math.min(1 - pct, tempHp / max) * 100}%`,
                background: theme.colors.accentHighlight,
                opacity: 0.8, borderRadius: 999,
              }} />
            )}
          </div>
        )}
      </div>

      {/* Conditions */}
      <PlayerConditions conditions={p.conditions ?? []} />
    </div>
  );
}
