import * as React from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconNotes, IconSpells } from "@/icons";

type Props = {
  backTo: string;
  backTitle?: string;
  title: string;
  round: number;
  seconds?: number | null;
  canNavigate: boolean;
  rollLabel: string;
  onRollOrReset: () => void;
  onResetFight?: () => void;
  onEndCombat: () => void;
  onOpenSpellBook: () => void;
  onOpenAdventureNotes: () => void;
  onPrev: () => void;
  onNext: () => void;
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

  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Button
            onClick={() => navigate(props.backTo)}
            title={props.backTitle ?? "Back"}
          >
            Back
          </Button>
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: theme.colors.text }}>{title}</span>
        </div>
      }
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="primary" onClick={props.onRollOrReset}>
            {rollLabel}
          </Button>

          {props.onResetFight && (
            <Button variant="ghost" onClick={props.onResetFight} title="Reset monsters HP and conditions to full">
              Reset Fight
            </Button>
          )}

          <Button variant="ghost" onClick={props.onOpenSpellBook} title="Spell Book">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconSpells size={18} title="Spell Book" />
              Spell Book
            </span>
          </Button>

          <Button variant="ghost" onClick={props.onOpenAdventureNotes} title="Adventure Notes">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconNotes size={18} title="Adventure Notes" />
              Notes
            </span>
          </Button>

          <Button variant="danger" onClick={props.onEndCombat}>
            End
          </Button>
        </div>
      }
    >
      {/* no body */}
      <div />
    </Panel>
  );
}
