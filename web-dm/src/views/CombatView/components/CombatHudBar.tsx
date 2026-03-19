import * as React from "react";

import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { CombatDeltaControls } from "@/views/CombatView/components/CombatDeltaControls";

import "@/views/CombatView/combatView.css";

type Props = {
  isNarrow: boolean;
  activeLabel: string;
  targetLabel: string;
  round: number;
  seconds?: number | null;
  canNavigate: boolean;
  onPrev: () => void;
  onNext: () => void;

  delta: string;
  targetId: string | null;
  deltaDisabled: boolean;
  onChangeDelta: (v: string) => void;
  onApplyDamage: () => void;
  onApplyHeal: () => void;
};

/**
 * Combat HUD bar ("fighting game" style): Active (left) • Delta (center) • Target (right)
 *
 * View orchestrates state; this component only renders.
 */
export function CombatHudBar(props: Props) {
  // For narrow layouts, CombatView keeps the original stacked layout.
  if (props.isNarrow) return null;

  return (
    <div
      className="cvHudBar"
      style={{
        ["--cv-panelBorder" as any]: theme.colors.panelBorder,
        ["--cv-panelBg" as any]: theme.colors.panelBg,
        ["--cv-bg" as any]: theme.colors.bg,
        ["--cv-text" as any]: theme.colors.text,
        ["--cv-muted" as any]: theme.colors.muted,
        ["--cv-accent" as any]: theme.colors.accentHighlight
      }}
    >
      {/* Active */}
      <div
        className="cvHudBarSide cvHudBarActive"
      >
        <span className="cvHudBarLabel">
          Active
        </span>
        <span
          title={props.activeLabel}
          className="cvHudBarName"
        >
          {props.activeLabel}
        </span>
      </div>

      {/* Center: Round / Prev / Next + Delta */}
      <div className="cvHudBarCenter">
        <div className="cvHudBarTopRow">
          <span
            className="cvHudBarChip"
          >
            Round {props.round}
          </span>
          {typeof props.seconds === "number" && (
            <span
              className="cvHudBarChip"
            >
              {props.seconds}s
            </span>
          )}

          <Button variant="ghost" onClick={props.onPrev} disabled={!props.canNavigate}>
            Prev (p)
          </Button>
          <Button variant="ghost" onClick={props.onNext} disabled={!props.canNavigate}>
            Next (n)
          </Button>
        </div>

        <div className="cvHudBarDeltaWrap">
          <CombatDeltaControls
            value={props.delta}
            targetId={props.targetId}
            disabled={props.deltaDisabled}
            onChange={props.onChangeDelta}
            onApplyDamage={props.onApplyDamage}
            onApplyHeal={props.onApplyHeal}
          />
        </div>
      </div>

      {/* Target */}
      <div
        className="cvHudBarSide cvHudBarTarget"
      >
        <span
          title={props.targetLabel}
          className="cvHudBarName"
        >
          {props.targetLabel}
        </span>
        <span className="cvHudBarLabel">
          Target
        </span>
      </div>
    </div>
  );
}
