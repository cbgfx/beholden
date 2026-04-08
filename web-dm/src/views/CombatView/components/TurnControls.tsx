import * as React from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";

type Props = {
  round: number;
  secondsInRound: number | null;
  canNavigate: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function TurnControls({ round, secondsInRound, canNavigate, onPrev, onNext }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingTop: 2,
      }}
    >
      <span
        style={{
          fontSize: "var(--fs-pill)",
          fontWeight: 900,
          color: theme.colors.muted,
          border: `1px solid ${theme.colors.panelBorder}`,
          background: theme.colors.panelBg,
          padding: "4px 8px",
          borderRadius: 999,
        }}
      >
        Round {round}
      </span>

      {typeof secondsInRound === "number" && (
        <span
          style={{
            fontSize: "var(--fs-pill)",
            fontWeight: 900,
            color: theme.colors.muted,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: theme.colors.panelBg,
            padding: "4px 8px",
            borderRadius: 999,
          }}
        >
          {secondsInRound}s
        </span>
      )}

      <Button variant="ghost" onClick={onPrev} disabled={!canNavigate}>
        Prev (p)
      </Button>
      <Button variant="ghost" onClick={onNext} disabled={!canNavigate}>
        Next (n)
      </Button>
    </div>
  );
}
