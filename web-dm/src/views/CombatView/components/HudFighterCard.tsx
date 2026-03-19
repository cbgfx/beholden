import * as React from "react";

import { theme } from "@/theme/theme";
import { HudConditionsStrip } from "@/views/CombatView/components/HudConditionsStrip";
import { clamp01, getHudHp, getHudHpFill, getHudNames } from "@/views/CombatView/utils/hud";
import type { Combatant, Player } from "@/domain/types/domain";

import "@/views/CombatView/combatView.css";

type Role = "active" | "target";

type Props = {
  combatant: Combatant | null;
  role: Role;
  playersById: Record<string, Player>;
  renderCombatantIcon: (c: Combatant | null) => React.ReactNode;
  activeId: string | null;
  targetId: string | null;
  onOpenConditions: (combatantId: string, role: Role, casterId: string | null) => void;
};

/**
 * Combat HUD fighter card ("fighting game" style) shown above the 3-column layout.
 * View orchestrates state; this component only renders.
 */
export function HudFighterCard(props: Props) {
  const c = props.combatant;
  const names = React.useMemo(() => getHudNames(c, props.playersById), [c, props.playersById]);
  const { hpCurrent, hpMax, tempHp } = React.useMemo(() => getHudHp(c), [c]);

  const rawConditions = c?.conditions ?? [];

  const hpPct = clamp01(hpCurrent / hpMax);
  const tempPct = clamp01(tempHp / hpMax);
  const hpFill = getHudHpFill(hpPct);

  const isSelfTarget =
    props.role === "target" &&
    props.targetId != null &&
    props.activeId != null &&
    String(props.targetId) === String(props.activeId);

  const roleAccent = props.role === "active" ? theme.colors.accentHighlight : theme.colors.blue;
  const roleLabel = isSelfTarget ? "SELF" : props.role === "active" ? "ACTIVE" : "TARGET";

  // Accent used for the HUD portrait hex backing (match PlayerRow / combat icon coloring).
  const isDead = (c?.hpCurrent ?? 1) <= 0;
  const portraitAccent = !c
    ? theme.colors.muted
    : isDead
      ? theme.colors.muted
      : c.baseType === "player"
        ? theme.colors.blue
        : c.color || (c.friendly ? theme.colors.green : theme.colors.red);

  // Fighting-game style: HP + optional temp overlay segment.
  const tempLeft = clamp01(hpPct);
  const tempWidth = clamp01(Math.min(tempPct, 1 - tempLeft));

  const openHudConditions = React.useCallback(() => {
    const id = c?.id ?? null;
    if (!id) return;
    const casterId = props.role === "active" ? id : (props.activeId ? String(props.activeId) : null);
    props.onOpenConditions(id, props.role, casterId);
  }, [c, props.role, props.activeId, props.onOpenConditions]);

  return (
    <div
      className="cvHudCard"
      style={
        {
          "--cv-roleAccent": roleAccent,
          "--cv-panelBg": theme.colors.panelBg,
          "--cv-panelBorder": theme.colors.panelBorder,
          "--cv-bg": theme.colors.bg,
          "--cv-text": theme.colors.text,
          "--cv-muted": theme.colors.muted,
          "--cv-accent": theme.colors.accentHighlight,
          "--cv-portraitAccent": portraitAccent,
          "--cv-portraitAccentGlow": `${portraitAccent}22`,
          "--cv-hpFill": hpFill,
          "--cv-hpPct": `${Math.round(hpPct * 100)}%`,
          "--cv-tempLeft": `${Math.round(tempLeft * 100)}%`,
          "--cv-tempWidth": `${Math.round(tempWidth * 100)}%`
        } as React.CSSProperties
      }
    >
      <div className="cvHudTopRow">
        {/* Icon + hex backing for extra oomph */}
        <div className="cvHudPortraitWrap">
          <svg
            width={48}
            height={48}
            viewBox="0 0 100 100"
            className="cvHudPortraitHex"
            aria-hidden
          >
            <polygon
              points="50 4, 91 27, 91 73, 50 96, 9 73, 9 27"
              fill={`${portraitAccent}22`}
              stroke={`${portraitAccent}CC`}
              strokeWidth="5"
              strokeLinejoin="round"
            />
          </svg>

          <div className="cvHudPortraitIcon">
            {props.renderCombatantIcon(c)}
          </div>
        </div>

        <div className="cvHudNames">
          <div className="cvHudBadgeRow">
            <span
              className="cvHudBadge"
              title={props.role === "active" ? "Active" : isSelfTarget ? "Self target" : "Target"}
            >
              {roleLabel}
            </span>
          </div>

          <div
            title={names.primary}
            className="cvHudPrimaryName"
          >
            {names.primary} &nbsp;
            {names.secondary ? (
              <span
                title={names.secondary}
                className="cvHudSecondaryName"
              >
                {names.secondary}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="cvHudHpRow">
        <div className="cvHudHpTrack" aria-label="HP">
          <div className="cvHudHpFill" />

          {tempWidth > 0 ? (
            <div className="cvHudTempFill" aria-label="Temp HP" />
          ) : null}
        </div>

        <div className="cvHudHpText" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* AC chip */}
          {c ? (
            <span
              title="Armor Class"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontWeight: 900,
                color: theme.colors.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ opacity: 0.7, fontSize: 11 }}>🛡</span>
              {Math.max(0, Number(c.ac ?? 0) + Number(c.overrides?.acBonus ?? 0))}
            </span>
          ) : null}
          {/* HP */}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.max(0, Math.floor(hpCurrent))} / {Math.max(1, Math.floor(hpMax))}
            {tempHp > 0 ? (
              <span className="cvHudTempText">+{Math.floor(tempHp)}</span>
            ) : null}
          </span>
        </div>
      </div>

      <HudConditionsStrip
        conditions={rawConditions}
        onClick={openHudConditions}
        maxShown={6}
        iconColor={theme.colors.text}
      />
    </div>
  );
}
