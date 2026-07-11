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
