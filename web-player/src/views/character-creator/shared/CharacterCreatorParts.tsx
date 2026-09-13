import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { C, withAlpha } from "@/lib/theme";
import { Button } from "@/ui/Button";

export { SpellPicker } from "./CharacterCreatorSpellPicker";
export { ItemPicker } from "./CharacterCreatorItemPicker";

export function StepHeader({ current, onStepClick, isEditing }: { current: number; onStepClick: (s: number) => void; isEditing?: boolean }) {
  const translateUi = useUiTranslation("playerUi");
  const steps = ["Ruleset", "Class", "Species", "Background", "Ability Scores", "Class Details", "Skills", "Spells", "Stats", "Identity", "Assign"];
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 28 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        if (isEditing && n === 1) return null;
        const active = n === current;
        const done = n < current;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onStepClick(n)}
            style={{
              padding: "5px 13px",
              borderRadius: 20,
              background: active ? C.accentHl : done ? withAlpha(C.accentHl, 0.18) : withAlpha(C.panelBorder, 0.06),
              color: active ? C.textDark : done ? C.accentHl : withAlpha(C.muted, 0.50),
              fontWeight: active ? 700 : done ? 600 : 500,
              fontSize: "var(--fs-small)",
              border: `1px solid ${active ? C.accentHl : done ? withAlpha(C.accentHl, 0.35) : withAlpha(C.panelBorder, 0.10)}`,
              cursor: active ? "default" : "pointer",
              transition: "opacity 0.12s, background 0.12s",
            }}
          >
            {done ? "✓ " : `${n}. `}
            {translateUi(label)}
          </button>
        );
      })}
    </div>
  );
}

export function NavButtons({
  step,
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  const translateUi = useUiTranslation("playerUi");
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
      <Button type="button" variant="ghost" onClick={onBack} disabled={step === 1}>
        {translateUi("← Back")}
      </Button>
      <Button type="button" variant="primary" onClick={onNext} disabled={nextDisabled}>
        {nextLabel ?? translateUi("Next →")}
      </Button>
    </div>
  );
}

