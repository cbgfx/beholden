import React from "react";
import { C } from "@/lib/theme";
import { NavButtons } from "../shared/CharacterCreatorParts";
import { headingStyle } from "../shared/CharacterCreatorStyles";
import type { CharacterCreatorStepRenderContext, StepRenderResult } from "./CharacterCreatorStepContext";

const RULESET_OPTIONS: Array<{ value: "5e" | "5.5e"; label: string; description: string }> = [
  { value: "5.5e", label: "5.5e Rules", description: "The current Player's Handbook (2024)." },
  { value: "5e", label: "5e Rules", description: "The original Plauer's Handbook (2014)." },
];

function renderRulesetStep({
  ruleset,
  onSelect,
  locked,
  onNext,
}: {
  ruleset: "5e" | "5.5e" | null;
  onSelect: (value: "5e" | "5.5e") => void;
  locked: boolean;
  onNext: () => void;
}): { main: React.ReactNode; side: React.ReactNode } {
  const main = (
    <div>
      <h2 style={headingStyle}>Choose a Ruleset</h2>
      <p style={{ color: C.muted, fontSize: "var(--fs-medium)", marginBottom: 16 }}>
        {locked
          ? "This character's ruleset is locked and can't be changed after creation."
          : "This determines which classes, species, backgrounds, and feats are available — pick carefully, it can't be changed later."}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {RULESET_OPTIONS.map((option) => {
          const selected = ruleset === option.value;
          return (
            <button
              type="button"
              key={option.value}
              disabled={locked}
              onClick={() => onSelect(option.value)}
              style={{
                flex: "1 1 220px",
                minWidth: 220,
                padding: "16px 18px",
                borderRadius: 10,
                textAlign: "left",
                border: `2px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                background: selected ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                color: selected ? C.accentHl : C.text,
                cursor: locked ? "default" : "pointer",
                opacity: locked && !selected ? 0.5 : 1,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)" }}>{option.label}</div>
              <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 4 }}>{option.description}</div>
            </button>
          );
        })}
      </div>
      <NavButtons step={1} onBack={() => {}} onNext={onNext} nextDisabled={!ruleset} />
    </div>
  );

  return { main, side: null };
}

export function renderRulesetFromContext(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  return renderRulesetStep({
    ruleset: ctx.form.ruleset,
    onSelect: (value) => ctx.setForm((f) => ({ ...f, ruleset: value })),
    locked: ctx.isEditing,
    onNext: () => ctx.setStep(2),
  });
}
