import * as React from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/app/theme/theme";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

type Props = {
  backTo: string;
  backTitle?: string;
  title: string;
  round: number;
  seconds?: number | null;
  canNavigate: boolean;
  rollLabel: string;
  onRollOrReset: () => void;
  onEndCombat: () => void;
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
  const { title, round, seconds, canNavigate, rollLabel } = props;
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
          <span
            style={{
              fontSize: "var(--fs-pill)",
              fontWeight: 900,
              color: theme.colors.muted,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: theme.colors.panelBg,
              padding: "4px 8px",
              borderRadius: 999
            }}
          >
            Round {round}
          </span>
          {typeof seconds === "number" && (
            <span
              style={{
                fontSize: "var(--fs-pill)",
                fontWeight: 900,
                color: theme.colors.muted,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.panelBg,
                padding: "4px 8px",
                borderRadius: 999
              }}
            >
              {seconds}s
            </span>
          )}
        </div>
      }
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="ghost" onClick={props.onPrev} disabled={!canNavigate}>
            Prev (p)
          </Button>
          <Button variant="ghost" onClick={props.onNext} disabled={!canNavigate}>
            Next (n)
          </Button>

          <Button variant="primary" onClick={props.onRollOrReset}>
            {rollLabel}
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
