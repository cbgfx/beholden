import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconPlayer, IconHeart, IconShield } from "@/icons";
import { PlayerDeathSaves } from "./PlayerDeathSaves";
import { PlayerConditions } from "./PlayerConditions";
import type { RowMenuItem } from "@/ui/RowMenu";
import { RowMenu } from "@/ui/RowMenu";
import { HealthBar } from "@beholden/shared/ui";

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
  imageUrl?: string | null;
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
  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => { setImgError(false); }, [p.imageUrl]);

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

  const rowStyle = isCombatList
    ? { background: "transparent", border: "none", borderRadius: 0, padding: "8px 10px" }
    : { background: withAlpha(theme.colors.shadowColor, 0.18), border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, padding: "10px 12px" };

  const hasLegacyActions = props.actions !== undefined;
  const showMenu = !hasLegacyActions && Boolean(props.menuItems?.length);

  const metaLine = props.subtitle ?? (
    p.level || p.species || p.class
      ? <>{p.level ? `Lvl ${p.level} ` : ""}{p.species} {p.class}</>
      : null
  );

  return (
    <div style={{ ...rowStyle, display: "flex", flexDirection: "column", gap: 6 }}>

      {/* Top row: avatar · name/meta · stats · actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>

        {/* Avatar */}
        <div style={{
          flex: "0 0 auto", width: 36, height: 36, borderRadius: 8,
          background: withAlpha(iconColor, 0.15),
          border: `1px solid ${withAlpha(iconColor, 0.35)}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: iconColor, overflow: "hidden",
        }}>
          {p.imageUrl && !imgError
            ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError(true)} />
            : (props.icon ?? <IconPlayer size={20} />)
          }
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
        <div style={{ flex: "0 1 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginLeft: "auto" }}>
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
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }} onClick={(e) => e.stopPropagation()}>
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
          <HealthBar
            current={cur}
            max={max}
            temp={tempHp}
            height={6}
            radius={999}
            trackColor={withAlpha(theme.colors.shadowColor, 0.4)}
            fillColor={barColor}
            tempColor={theme.colors.accentHighlight}
          />
        )}
      </div>

      {/* Conditions */}
      <PlayerConditions conditions={p.conditions ?? []} />
    </div>
  );
}
