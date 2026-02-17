import * as React from "react";

import { theme } from "@/theme/theme";
import { HudConditionsStrip } from "@/views/CombatView/components/HudConditionsStrip";
import { clamp01, getHudHp, getHudHpFill, getHudNames } from "@/views/CombatView/utils/hud";

type Role = "active" | "target";

type Props = {
  combatant: any;
  role: Role;
  playersById: Record<string, any>;
  renderCombatantIcon: (c: any) => React.ReactNode;
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

  const rawConditions = Array.isArray((c as any)?.conditions) ? ((c as any).conditions as any[]) : [];

  const hpPct = clamp01(hpCurrent / hpMax);
  const tempPct = clamp01(tempHp / hpMax);
  const hpFill = getHudHpFill(hpPct);

  const isSelfTarget =
    props.role === "target" &&
    props.targetId != null &&
    props.activeId != null &&
    String(props.targetId) === String(props.activeId);

  const roleAccent = props.role === "active" ? theme.colors.accent : theme.colors.blue;
  const roleLabel = isSelfTarget ? "SELF" : props.role === "active" ? "ACTIVE" : "TARGET";

  // Accent used for the HUD portrait hex backing (match PlayerRow / combat icon coloring).
  const portraitAccent = !c
    ? theme.colors.muted
    : c.isDead
      ? theme.colors.muted
      : c.baseType === "player"
        ? theme.colors.blue
        : c.color || (c.friendly ? theme.colors.green : theme.colors.red);

  // Fighting-game style: HP + optional temp overlay segment.
  const tempLeft = clamp01(hpPct);
  const tempWidth = clamp01(Math.min(tempPct, 1 - tempLeft));

  const openHudConditions = React.useCallback(() => {
    const id = (c as any)?.id ? String((c as any).id) : null;
    if (!id) return;
    const casterId = props.role === "active" ? id : (props.activeId ? String(props.activeId) : null);
    props.onOpenConditions(id, props.role, casterId);
  }, [c, props.role, props.activeId, props.onOpenConditions]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 16,
        border: `1px solid ${roleAccent}`,
        background: theme.colors.panelBg,
        boxShadow: `0 0 0 2px rgba(0,0,0,0.18), 0 10px 26px rgba(0,0,0,0.30)`,
        minWidth: 360
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {/* Icon + hex backing for extra oomph */}
        <div style={{ position: "relative", width: 48, height: 48, flex: "0 0 auto" }}>
          <svg
            width={48}
            height={48}
            viewBox="0 0 100 100"
            style={{
              position: "absolute",
              inset: 0,
              filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.35)) drop-shadow(0 0 12px ${portraitAccent}22)`
            }}
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

          <div
            style={{
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: "scale(2.15)",
              transformOrigin: "center",
              color: portraitAccent
            }}
          >
            {props.renderCombatantIcon(c)}
          </div>
        </div>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 900,
                letterSpacing: 0.6,
                fontSize: "var(--fs-tiny)",
                color: "#0b0e13",
                background: roleAccent,
                border: `1px solid rgba(0,0,0,0.35)`,
                boxShadow: `0 8px 18px rgba(0,0,0,0.35)`
              }}
              title={props.role === "active" ? "Active" : isSelfTarget ? "Self target" : "Target"}
            >
              {roleLabel}
            </span>
          </div>

          <div
            title={names.primary}
            style={{
              color: theme.colors.text,
              fontWeight: 900,
              fontSize: "calc(var(--fs-title) + 8px)",
              lineHeight: "34px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 420
            }}
          >
            {names.primary} &nbsp;
            {names.secondary ? (
              <span
                title={names.secondary}
                style={{
                  color: theme.colors.muted,
                  fontWeight: 900,
                  fontSize: "var(--fs-base)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 420
                }}
              >
                {names.secondary}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            position: "relative",
            height: 10,
            borderRadius: 8,
            background: theme.colors.panelBorder,
            overflow: "hidden",
            flex: 1
          }}
          aria-label="HP"
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.round(hpPct * 100)}%`,
              background: hpFill,
              transition: "width 150ms ease"
            }}
          />

          {tempWidth > 0 ? (
            <div
              style={{
                position: "absolute",
                left: `${Math.round(tempLeft * 100)}%`,
                top: 0,
                bottom: 0,
                width: `${Math.round(tempWidth * 100)}%`,
                background: theme.colors.accent,
                opacity: 0.55,
                transition: "left 150ms ease, width 150ms ease"
              }}
              aria-label="Temp HP"
            />
          ) : null}
        </div>

        <div
          style={{
            color: theme.colors.muted,
            fontWeight: 900,
            fontSize: "var(--fs-base)",
            whiteSpace: "nowrap"
          }}
        >
          {Math.max(0, Math.floor(hpCurrent))} / {Math.max(1, Math.floor(hpMax))}
          {tempHp > 0 ? (
            <span style={{ color: theme.colors.accent, marginLeft: 6 }}>+{Math.floor(tempHp)}</span>
          ) : null}
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
