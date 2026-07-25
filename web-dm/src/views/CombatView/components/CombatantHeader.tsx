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
  const { title, rollLabel } = props;
  const navigate = useNavigate();
  const isPhone = useIsNarrow("(max-width: 640px)");

  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
          <Button
            onClick={() => navigate(props.backTo)}
            title={props.backTitle ?? "Back"}
          >
            Back
          </Button>
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: theme.colors.text, minWidth: 0 }}>{title}</span>
          {props.difficulty?.projectedThreat ? (
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
                `Difficulty: ${props.difficulty.projectedThreat}\n` +
                `Party HP: ${Math.round(props.difficulty.partyHpMax).toLocaleString()}\n` +
                `Sustained DPR: ${Math.round(props.difficulty.hostileDpr).toLocaleString()}\n` +
                `Projected DPR: ${Math.round(props.difficulty.projectedDpr).toLocaleString()}\n` +
                (props.difficulty.burstFactor > 1 ? `Encounter pressure factor: ×${props.difficulty.burstFactor.toFixed(2)}\n` : "") +
                (Number.isFinite(props.difficulty.monsterSurvivalRounds) ? `Estimated monster survival: ${props.difficulty.monsterSurvivalRounds.toFixed(1)} rounds\n` : "") +
                (Number.isFinite(props.difficulty.roundsToFirstDown) ? `Estimated first character down: ${props.difficulty.roundsToFirstDown.toFixed(1)} rounds\n` : "") +
                (Number.isFinite(props.difficulty.expectedPartyDamageRatio) ? `Expected party HP lost: ${Math.round(props.difficulty.expectedPartyDamageRatio * 100)}%\n` : "") +
                (Number.isFinite(props.difficulty.roundsToTpk) ? `Rounds to party collapse: ${props.difficulty.roundsToTpk.toFixed(1)}` : "Rounds to party collapse: ∞")
              }
            >
              {props.difficulty.projectedThreat}
            </span>
          ) : null}
        </div>
      }
      actions={
        <div style={{ display: "flex", gap: isPhone ? 4 : 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", minWidth: 0 }}>
          {props.started && props.onResetFight ? (
            <Button variant="primary" onClick={props.onResetFight} title="Reset monsters HP and conditions to full">
              Reset Fight
            </Button>
          ) : (
            <Button variant="primary" onClick={props.onRollOrReset}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconDice size={18} title="Roll Initiative" />
                {rollLabel}
              </span>
            </Button>
          )}

          {props.onOpenRewards && !isPhone && (
            <Button variant="ghost" onClick={props.onOpenRewards} title="Encounter rewards: XP and loot">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconChest size={18} title="Rewards" />
                Rewards
              </span>
            </Button>
          )}

          <Button variant="ghost" onClick={props.onOpenSpellBook} title="Spell Book">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconSpells size={18} title="Spell Book" />
              {!isPhone && "Spell Book"}
            </span>
          </Button>

          <Button variant="ghost" onClick={props.onOpenAdventureNotes} title="Adventure Notes">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconNotes size={18} title="Adventure Notes" />
              {!isPhone && "Notes"}
            </span>
          </Button>

          {props.started ? (
            <Button variant="danger" onClick={props.onEndCombat}>
              End
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
