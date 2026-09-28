import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconChest, IconDice, IconNotes, IconSpells } from "@/icons";
import { useIsNarrow } from "@/views/CombatView/hooks/useIsNarrow";

type Props = {
  backTo: string;
  backTitle?: string;
  title: string;
  started: boolean;
  rollLabel: string;
  onRollOrReset: () => void;
  onResetFight?: () => void;
  onOpenRewards?: () => void;
  onEndCombat: () => void;
  onOpenSpellBook: () => void;
  onOpenAdventureNotes: () => void;
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
 * Top-of-screen combat header.
 *
 * NOTE: This file intentionally owns the name `CombatantHeader` because the
 * route-level view imports it. (It used to be a small "combatant label" widget,
 * which caused a runtime crash when the CombatView passed header props.)
 */
export function CombatantHeader(props: Props) {
  const translateUi = useUiTranslation("dmUi");
  const { title, rollLabel } = props;
  const navigate = useNavigate();
  const isPhone = useIsNarrow("(max-width: 640px)");

  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
          <Button
            onClick={() => navigate(props.backTo)}
            title={props.backTitle ?? translateUi("Back")}
          >
            {translateUi("Back")}
          </Button>
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: theme.colors.text, minWidth: 0 }}>{title}</span>
          {props.difficulty?.displayDifficulty ? (
            <span
              style={{
                fontSize: "var(--fs-subtitle)",
                fontWeight: 900,
                color: theme.colors.muted,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.panelBg,
                padding: "2px 6px",
                borderRadius: 999,
                whiteSpace: "nowrap",
              }}
              title={
                translateUi("Official difficulty: {{value1}}\n", { value1: props.difficulty.officialDifficulty }) +
                translateUi("Damage projection: {{value1}}\n", { value1: props.difficulty.projectedThreat }) +
                translateUi("Party HP: {{value1}}\n", { value1: Math.round(props.difficulty.partyHpMax).toLocaleString() }) +
                translateUi("Sustained DPR: {{value1}}\n", { value1: Math.round(props.difficulty.hostileDpr).toLocaleString() }) +
                translateUi("Projected DPR: {{value1}}\n", { value1: Math.round(props.difficulty.projectedDpr).toLocaleString() }) +
                (props.difficulty.burstFactor > 1 ? translateUi("Encounter pressure factor: ×{{value1}}\n", { value1: props.difficulty.burstFactor.toFixed(2) }) : "") +
                (Number.isFinite(props.difficulty.monsterSurvivalRounds) ? translateUi("Estimated monster survival: {{value1}} rounds\n", { value1: props.difficulty.monsterSurvivalRounds.toFixed(1) }) : "") +
                (Number.isFinite(props.difficulty.roundsToFirstDown) ? translateUi("Estimated first character down: {{value1}} rounds\n", { value1: props.difficulty.roundsToFirstDown.toFixed(1) }) : "") +
                (Number.isFinite(props.difficulty.expectedPartyDamageRatio) ? translateUi("Expected party HP lost: {{value1}}%\n", { value1: Math.round(props.difficulty.expectedPartyDamageRatio * 100) }) : "") +
                (Number.isFinite(props.difficulty.roundsToTpk) ? translateUi("Rounds to party collapse: {{value1}}", { value1: props.difficulty.roundsToTpk.toFixed(1) }) : translateUi("Rounds to party collapse: ∞"))
              }
            >
              {props.difficulty.displayDifficulty}
            </span>
          ) : null}
        </div>
      }
      actions={
        <div style={{ display: "flex", gap: isPhone ? 4 : 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", minWidth: 0 }}>
          {props.started && props.onResetFight ? (
            <Button variant="primary" onClick={props.onResetFight} title={translateUi("Reset monsters HP and conditions to full")}>
              {translateUi("Reset Fight")}
            </Button>
          ) : (
            <Button variant="primary" onClick={props.onRollOrReset}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconDice size={18} title={translateUi("Roll Initiative")} />
                {rollLabel}
              </span>
            </Button>
          )}

          {props.onOpenRewards && !isPhone && (
            <Button variant="ghost" onClick={props.onOpenRewards} title={translateUi("Encounter rewards: XP and loot")}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconChest size={18} title={translateUi("Rewards")} />
                {translateUi("Rewards")}
              </span>
            </Button>
          )}

          <Button variant="ghost" onClick={props.onOpenSpellBook} title={translateUi("Spell Book")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconSpells size={18} title={translateUi("Spell Book")} />
              {!isPhone && "Spell Book"}
            </span>
          </Button>

          <Button variant="ghost" onClick={props.onOpenAdventureNotes} title={translateUi("Adventure Notes")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconNotes size={18} title={translateUi("Adventure Notes")} />
              {!isPhone && "Notes"}
            </span>
          </Button>

          {props.started ? (
            <Button variant="danger" onClick={props.onEndCombat}>
              {translateUi("End")}
            </Button>
          ) : null}
        </div>
      }
    >
      {/* no body */}
      <div />
    </Panel>
  );
}
