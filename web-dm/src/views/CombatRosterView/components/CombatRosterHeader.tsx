import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
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
    displayDifficulty: string;
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
  const translateUi = useUiTranslation("dmUi");
  const nav = useNavigate();

  const xp = typeof props.totalXp === "number" && Number.isFinite(props.totalXp) ? Math.max(0, Math.round(props.totalXp)) : null;
  const diff = props.difficulty;
  const diffLabel = diff?.displayDifficulty ? diff.displayDifficulty : null;

  const rtk = diff && Number.isFinite(diff.roundsToTpk) ? diff.roundsToTpk : null;
  const hostileDpr = diff && Number.isFinite(diff.hostileDpr) ? diff.hostileDpr : null;
  const burst = diff && Number.isFinite(diff.burstFactor) ? diff.burstFactor : null;
  const partyHpMax = diff && Number.isFinite(diff.partyHpMax) ? diff.partyHpMax : null;

  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="ghost" onClick={() => nav(props.backTo)} title={translateUi("Back to Campaign")}>
            {translateUi("← Back")}
          </Button>
          <IconEncounterRoster size={18} title={translateUi("Combat Roster")} />
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
              title={translateUi("Total raw XP (hostile monsters only)")}
            >
              {xp.toLocaleString()} {translateUi("XP")}
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
                translateUi("Official difficulty: {{value1}}\n", { value1: diff?.officialDifficulty ?? "Unavailable" }) +
                translateUi("Damage projection: {{value1}}\n", { value1: diff?.projectedThreat ?? "Unavailable" }) +
                (partyHpMax != null ? translateUi("Party HP: {{value1}}\n", { value1: Math.round(partyHpMax).toLocaleString() }) : "") +
                (hostileDpr != null ? translateUi("Sustained DPR: {{value1}}\n", { value1: Math.round(hostileDpr).toLocaleString() }) : "") +
                (diff && Number.isFinite(diff.projectedDpr) ? translateUi("Projected DPR: {{value1}}\n", { value1: Math.round(diff.projectedDpr).toLocaleString() }) : "") +
                (burst != null && burst > 1 ? translateUi("Encounter pressure factor: ×{{value1}}\n", { value1: burst.toFixed(2) }) : "") +
                (diff && Number.isFinite(diff.monsterSurvivalRounds) ? translateUi("Estimated monster survival: {{value1}} rounds\n", { value1: diff.monsterSurvivalRounds.toFixed(1) }) : "") +
                (diff && Number.isFinite(diff.roundsToFirstDown) ? translateUi("Estimated first character down: {{value1}} rounds\n", { value1: diff.roundsToFirstDown.toFixed(1) }) : "") +
                (diff && Number.isFinite(diff.expectedPartyDamageRatio) ? translateUi("Expected party HP lost: {{value1}}%\n", { value1: Math.round(diff.expectedPartyDamageRatio * 100) }) : "") +
                (rtk != null && Number.isFinite(rtk) ? translateUi("Rounds to party collapse: {{value1}}", { value1: rtk.toFixed(1) }) : translateUi("Rounds to party collapse: ∞"))
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
