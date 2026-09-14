import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconPlayer, IconHeart, IconShield } from "@/icons";
import { PlayerDeathSaves } from "./PlayerDeathSaves";
import { PlayerConditions } from "./PlayerConditions";
import type { RowMenuItem } from "@/ui/RowMenu";
import { RowMenu } from "@/ui/RowMenu";
import { HealthBar } from "@beholden/shared/ui";
import { resolveAssetUrl } from "@/services/api";

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
  conditions?: { key: string; casterId?: string | null; hexAbility?: string }[];
  concentrationSpell?: string | null;
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
  onEdit?: () => void;
  variant?: "campaign" | "combatList";
}) {
  const translateUi = useUiTranslation("dmUi");
  const p = props.p;
  const variant = props.variant ?? "campaign";
  const isCombatList = variant === "combatList";
  const clickable = typeof props.onEdit === "function";

  const max = Math.max(1, Number(p.hpMax) || 1);
  const cur = Math.max(0, Number(p.hpCurrent) || 0);
  const pct = cur / max;
  const isDead = cur <= 0;
  const showDeathSaves = isDead && Boolean(p.playerName);
  const [imgError, setImgError] = React.useState(false);
  const imageUrl = resolveAssetUrl(p.imageUrl);
  React.useEffect(() => { setImgError(false); }, [imageUrl]);

  const tempHp = Math.max(0, Number(p.tempHp ?? 0) || 0);
  const effectiveCur = cur + tempHp;
  const effectiveMax = max + tempHp;
  const acTotal = Number(p.ac ?? 0) + (Number(p.acBonus ?? 0) || 0);

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

  const showMenu = Boolean(props.menuItems?.length);

  const metaLine = props.subtitle ?? (
    p.level || p.species || p.class
      ? <>{p.level ? translateUi("Lvl {{value1}} ", { value1: p.level }) : ""}{p.species} {p.class}</>
      : null
  );

  return (
    <div
      className={variant === "campaign" ? "campaignInteractiveRow" : undefined}
      style={{
        ...rowStyle,
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: clickable ? "pointer" : "default",
      }}
      onClick={clickable ? () => props.onEdit?.() : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onEdit?.();
        }
      } : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? translateUi("Edit {{value1}}", { value1: p.characterName }) : undefined}
    >

      {/* Top row: avatar · name/meta · stats · actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>

        {/* Avatar */}
        <div style={{
          flex: "0 0 auto", width: 36, height: 36, borderRadius: 8,
          background: withAlpha(iconColor, 0.15),
          border: `1px solid ${withAlpha(iconColor, 0.35)}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: iconColor, overflow: "hidden",
        }}>
          {imageUrl && !imgError
            ? <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError(true)} />
            : (props.icon ?? <IconPlayer size={20} />)
          }
        </div>

        {/* Name + meta */}
        <div title={`${p.characterName}${p.playerName ? ` (${p.playerName})` : ""}`} style={{ flex: "1 1 0", minWidth: 0 }}>
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
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconShield size={12} style={{ opacity: 0.55, color: theme.colors.muted }} />
            <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>
              {acTotal}
            </span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconHeart size={12} style={{ opacity: 0.55, color: theme.colors.muted }} />
            <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>
              {effectiveCur}/{effectiveMax}
              {tempHp ? <span title={translateUi("{{value1}}/{{value2}} HP + {{value3}} temporary HP", { value1: cur, value2: max, value3: tempHp })} style={{ color: theme.colors.accentHighlight, marginLeft: 4, fontSize: "var(--fs-tiny)" }}>{translateUi("temp")}</span> : null}
            </span>
          </span>
        </div>

        {/* Action area */}
        {(props.primaryAction != null || showMenu) && (
          <div
            style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
          >
            {props.primaryAction}
            {showMenu ? <div className="campaignRowActions"><RowMenu items={props.menuItems!} /></div> : null}
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
      <PlayerConditions
        conditions={p.conditions ?? []}
        concentrationSpell={p.concentrationSpell}
      />
    </div>
  );
}
