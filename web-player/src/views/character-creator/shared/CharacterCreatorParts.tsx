import React from "react";
import { C } from "@/lib/theme";

export { SpellPicker } from "./CharacterCreatorSpellPicker";
export { ItemPicker } from "./CharacterCreatorItemPicker";

function btnStyle(primary: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "9px 22px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
    background: disabled
      ? "rgba(255,255,255,0.06)"
      : primary
        ? C.accentHl
        : "rgba(255,255,255,0.08)",
    color: disabled ? "rgba(160,180,220,0.40)" : primary ? C.textDark : C.text,
    fontSize: "var(--fs-medium)",
    transition: "opacity 0.15s",
  };
}

export function StepHeader({ current, onStepClick }: { current: number; onStepClick: (s: number) => void }) {
  const steps = ["Class", "Species", "Background", "Ability Scores", "Class Details", "Skills", "Spells", "Stats", "Identity", "Assign"];
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 28 }}>
      {steps.map((label, i) => {
        const n = i + 1;
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
              background: active ? C.accentHl : done ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.06)",
              color: active ? C.textDark : done ? C.accentHl : "rgba(160,180,220,0.50)",
              fontWeight: active ? 700 : done ? 600 : 500,
              fontSize: "var(--fs-small)",
              border: `1px solid ${active ? C.accentHl : done ? "rgba(56,182,255,0.35)" : "rgba(255,255,255,0.10)"}`,
              cursor: active ? "default" : "pointer",
              transition: "opacity 0.12s, background 0.12s",
            }}
          >
            {done ? "✓ " : `${n}. `}
            {label}
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
  nextLabel = "Next →",
  nextDisabled = false,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
      <button type="button" onClick={onBack} disabled={step === 1} style={btnStyle(false, step === 1)}>
        ← Back
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled} style={btnStyle(true, nextDisabled)}>
        {nextLabel}
      </button>
    </div>
  );
}

