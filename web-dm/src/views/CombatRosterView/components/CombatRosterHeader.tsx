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
    officialDifficulty: string;
    projectedThreat: string;
    roundsToTpk: number;
    partyHpMax: number;
    hostileDpr: number;
    projectedDpr: number;
    burstFactor: number;
    encounterXp: number;
    lowBudget: number;
    moderateBudget: number;
    highBudget: number;
    monsterSurvivalRounds: number;
    expectedPartyDamageRatio: number;
    roundsToFirstDown: number;
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
  const diffLabel = diff?.projectedThreat ? diff.projectedThreat : null;

  const rtk = diff && Number.isFinite(diff.roundsToTpk) ? diff.roundsToTpk : null;
  const hostileDpr = diff && Number.isFinite(diff.hostileDpr) ? diff.hostileDpr : null;
  const burst = diff && Number.isFinite(diff.burstFactor) ? diff.burstFactor : null;
  const partyHpMax = diff && Number.isFinite(diff.partyHpMax) ? diff.partyHpMax : null;

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
                `Difficulty: ${diff?.projectedThreat ?? "Unavailable"}\n` +
                (partyHpMax != null ? `Party HP: ${Math.round(partyHpMax).toLocaleString()}\n` : "") +
                (hostileDpr != null ? `Sustained DPR: ${Math.round(hostileDpr).toLocaleString()}\n` : "") +
                (diff && Number.isFinite(diff.projectedDpr) ? `Projected DPR: ${Math.round(diff.projectedDpr).toLocaleString()}\n` : "") +
                (burst != null && burst > 1 ? `Encounter pressure factor: ×${burst.toFixed(2)}\n` : "") +
                (diff && Number.isFinite(diff.monsterSurvivalRounds) ? `Estimated monster survival: ${diff.monsterSurvivalRounds.toFixed(1)} rounds\n` : "") +
                (diff && Number.isFinite(diff.roundsToFirstDown) ? `Estimated first character down: ${diff.roundsToFirstDown.toFixed(1)} rounds\n` : "") +
                (diff && Number.isFinite(diff.expectedPartyDamageRatio) ? `Expected party HP lost: ${Math.round(diff.expectedPartyDamageRatio * 100)}%\n` : "") +
                (rtk != null && Number.isFinite(rtk) ? `Rounds to party collapse: ${rtk.toFixed(1)}` : "Rounds to party collapse: ∞")
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
