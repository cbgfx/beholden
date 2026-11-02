import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { useIsNarrow } from "@beholden/shared/ui/useIsNarrow";

type Props = {
  round: number;
  secondsInRound: number | null;
  canNavigate: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function TurnControls({ round, secondsInRound, canNavigate, onPrev, onNext }: Props) {
  const translateUi = useUiTranslation("dmUi");
  const compact = useIsNarrow("(max-width: 1024px)");
  const buttonStyle = compact ? { minHeight: 44, padding: "6px 10px", fontSize: "var(--fs-small)" } : undefined;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 6 : 10,
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
        {translateUi("Round")} {round}
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

      <Button style={buttonStyle} variant="ghost" onClick={onPrev} disabled={!canNavigate}>
        {translateUi("Prev (p)")}
      </Button>
      <Button style={buttonStyle} variant="ghost" onClick={onNext} disabled={!canNavigate}>
        {translateUi("Next (n)")}
      </Button>
    </div>
  );
}
