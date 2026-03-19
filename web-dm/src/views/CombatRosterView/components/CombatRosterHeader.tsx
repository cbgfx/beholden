import * as React from "react";
import { useNavigate } from "react-router-dom";

import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconEncounterRoster } from "@/icons";

type Props = {
  title: string;
  backTo: string;
  totalXp?: number;
  difficulty?: {
    label: string;
    roundsToTpk: number;
    partyHpMax: number;
    hostileDpr: number;
    burstFactor: number;
    adjustedXp?: number;
  };
};

/**
 * Top-of-screen header for CombatRosterView.
 *
 * The Back button intentionally lives here (not inside EncounterRosterPanel)
 * so the roster panel can stay purely roster-focused.
 */
export function CombatRosterHeader(props: Props) {
  const nav = useNavigate();

  const xp = typeof props.totalXp === "number" && Number.isFinite(props.totalXp) ? Math.max(0, Math.round(props.totalXp)) : null;
  const diff = props.difficulty;
  const diffLabel = diff?.label ? String(diff.label) : null;

  const rtk = diff && Number.isFinite(diff.roundsToTpk) ? diff.roundsToTpk : null;
  const hostileDpr = diff && Number.isFinite(diff.hostileDpr) ? diff.hostileDpr : null;
  const burst = diff && Number.isFinite(diff.burstFactor) ? diff.burstFactor : null;
  const partyHpMax = diff && Number.isFinite(diff.partyHpMax) ? diff.partyHpMax : null;
  const adjustedXp = diff?.adjustedXp != null && Number.isFinite(diff.adjustedXp) ? diff.adjustedXp : null;

  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="ghost" onClick={() => nav(props.backTo)} title="Back to Campaign">
            ← Back
          </Button>
          <IconEncounterRoster size={18} title="Combat Roster" />
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: theme.colors.text }}>
            {props.title}
          </span>
          {xp != null ? (
            <span
              style={{
                fontSize: "var(--fs-subtitle)",
                fontWeight: 900,
                color: theme.colors.muted,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.panelBg,
                padding: "2px 6px",
                borderRadius: 999
              }}
              title="Total raw XP (hostile monsters only)"
            >
              {xp.toLocaleString()} XP
            </span>
          ) : null}
          {diffLabel != null ? (
            <span
              style={{
                fontSize: "var(--fs-subtitle)",
                fontWeight: 900,
                color: theme.colors.muted,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.panelBg,
                padding: "2px 6px",
                borderRadius: 999
              }}
              title={
                `Difficulty (Adj. XP + CR ceiling + DPR)\n` +
                (adjustedXp != null ? `Adjusted XP: ${Math.round(adjustedXp).toLocaleString()}\n` : "") +
                (partyHpMax != null ? `Party HP: ${Math.round(partyHpMax).toLocaleString()}\n` : "") +
                (hostileDpr != null ? `Hostile DPR: ${Math.round(hostileDpr).toLocaleString()}\n` : "") +
                (burst != null && burst > 1 ? `Burst factor: ×${burst.toFixed(2)}\n` : "") +
                (rtk != null && Number.isFinite(rtk) ? `Rounds to TPK: ${rtk.toFixed(1)}` : "∞ rounds to TPK")
              }
            >
              {diffLabel}
            </span>
          ) : null}
        </div>
      }
    >
      <div />
    </Panel>
  );
}
