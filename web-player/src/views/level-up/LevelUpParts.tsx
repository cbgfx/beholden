import React from "react";
import { C } from "@/lib/theme";
import { abilityMod, formatModifier } from "@/views/character/CharacterSheetUtils";
import { normalizeChoiceKey } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { ABILITY_KEYS, ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import type { HpChoice } from "@/views/level-up/LevelUpTypes";
import type { FeatPrerequisite } from "@/views/character/CharacterSheetUtils";

export { FeatSelectionSection } from "./LevelUpFeatSelectionSection";

export interface LevelUpSpellSummary {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
  /** Typed ClassTalent prerequisite (invocations) — rendered from the record, never parsed from prose. */
  prerequisite?: import("@/views/character/CharacterSheetUtils").ClassTalentPrerequisite | null;
  repeatable?: boolean;
}

export interface LevelUpFeatDetail {
  id: string;
  name: string;
  text?: string | null;
  parsed: { prerequisite?: FeatPrerequisite | null; repeatable?: boolean };
}

export interface LevelUpExpertiseChoice {
  key: string;
  source: string;
  count: number;
  options: string[] | null;
}

/** Renders a typed `selection_replacement` choice for a class-level exclusive option group
 * (Fighting Style, Pact Boon): shows the currently-held option and lets the player switch to a
 * different one from the same group. Optional — leaving it untouched keeps the current pick. */
export function ExclusiveChoiceReplacementSection(props: {
  accentColor: string;
  title: string;
  choice: { key: string; currentOptionId: string | null; options: Array<{ id: string; name: string }> };
  chosenFeatureChoices: Record<string, string[]>;
  onSelect: (choiceKey: string, optionId: string) => void;
}) {
  const { accentColor, title, choice, chosenFeatureChoices, onSelect } = props;
  const pending = chosenFeatureChoices[choice.key]?.[0] ?? choice.currentOptionId;

  return (
    <div>
      <div style={{ fontSize: "var(--fs-body)", fontWeight: 800, color: "#fff", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {choice.options.map((option) => (
          <ChoiceBtn
            key={option.id}
            active={pending === option.id}
            onClick={() => onSelect(choice.key, option.id)}
            accent={accentColor}
          >
            {option.name}
          </ChoiceBtn>
        ))}
      </div>
    </div>
  );
}

export function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{
        width: "min(75vw, 1100px)", maxWidth: "1100px", margin: "0 auto", padding: "24px 16px 140px",
        fontFamily: "system-ui, Segoe UI, Arial", color: C.text,
      }}>
        {children}
      </div>
    </div>
  );
}

export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer", color: C.muted,
      fontSize: "var(--fs-subtitle)", padding: "6px 0",
    }}>← Back</button>
  );
}

export function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 20, padding: "16px", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function ChoiceBtn({ active, onClick, accent, children }: {
  active: boolean;
  onClick: () => void;
  accent?: string;
  children: React.ReactNode;
}) {
  const color = accent ?? C.accentHl;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 14px", borderRadius: 8, cursor: "pointer",
        border: `2px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
        background: active ? `${color}18` : "rgba(255,255,255,0.03)",
        color: active ? "#fff" : C.muted,
        fontSize: "var(--fs-subtitle)", fontWeight: active ? 700 : 500,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

export function LevelUpHpSection(props: {
  nextLevel: number;
  hd: number;
  conMod: number;
  hpChoice: HpChoice;
  hpAverage: number;
  rolledHp: number | null;
  manualHp: string;
  hpGain: number | null;
  featHpBonus: number;
  hpMax: number;
  accentColor: string;
  onChooseAverage: () => void;
  onChooseRoll: () => void;
  onChooseManual: () => void;
  onManualChange: (value: string) => void;
}) {
  const { nextLevel, hd, conMod, hpChoice, hpAverage, rolledHp, manualHp, hpGain, featHpBonus, hpMax, accentColor, onChooseAverage, onChooseRoll, onChooseManual, onManualChange } = props;
  return (
    <Section title={`HP at Level ${nextLevel}`} accent={accentColor}>
      <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 10 }}>
        Hit Die: d{hd} · CON modifier: {formatModifier(conMod)}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <ChoiceBtn active={hpChoice === "average"} onClick={onChooseAverage}>
          Take average — <strong>+{hpAverage}</strong>
        </ChoiceBtn>
        <ChoiceBtn active={hpChoice === "roll"} onClick={onChooseRoll} accent={C.green}>
          {hpChoice === "roll" && rolledHp !== null
            ? <>🎲 Rolled — <strong>+{rolledHp}</strong> <span style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>(click to re-roll)</span></>
            : <>🎲 Roll 1d{hd}</>}
        </ChoiceBtn>
        <ChoiceBtn active={hpChoice === "manual"} onClick={onChooseManual} accent="#f59e0b">
          Manual HP
        </ChoiceBtn>
      </div>
      {hpChoice === "manual" && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={manualHp}
            onChange={(e) => onManualChange(e.target.value)}
            placeholder={`Enter total gained (e.g. ${Math.max(1, 1 + conMod)}-${Math.max(1, hd + conMod)})`}
            style={{
              flex: "0 1 280px", padding: "10px 12px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)",
              color: C.text, fontSize: "var(--fs-medium)", fontWeight: 700, outline: "none",
            }}
          />
          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
            Enter the final HP gained after applying Constitution.
          </div>
        </div>
      )}
      {hpGain !== null && (
        <div style={{ marginTop: 10, fontSize: "var(--fs-subtitle)", color: C.muted }}>
          New HP max: <span style={{ color: "#fff", fontWeight: 700 }}>{hpMax} + {hpGain}{featHpBonus > 0 ? ` + ${featHpBonus}` : ""} = {hpMax + hpGain + featHpBonus}</span>
        </div>
      )}
    </Section>
  );
}

export function AsiAbilityGrid(props: {
  baseScores: Record<string, number>;
  asiStats: Record<string, number>;
  accentColor: string;
  onToggle: (key: string) => void;
}) {
  const { baseScores, asiStats, accentColor, onToggle } = props;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {ABILITY_KEYS.map((k) => {
        const base = baseScores[k] ?? 10;
        const delta = asiStats[k] ?? 0;
        const preview = Math.min(20, base + delta);
        const maxed = base >= 20;
        const selected = delta > 0;
        return (
          <button
            key={k}
            onClick={() => !maxed && onToggle(k)}
            style={{
              padding: "10px 6px", borderRadius: 8, cursor: maxed ? "default" : "pointer",
              border: `2px solid ${selected ? accentColor : "rgba(255,255,255,0.1)"}`,
              background: selected ? `${accentColor}18` : "rgba(255,255,255,0.03)",
              color: maxed ? C.muted : C.text, textAlign: "center",
            }}
          >
            <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 2 }}>{ABILITY_LABELS[k]}</div>
            <div style={{ fontSize: "var(--fs-large)", fontWeight: 900 }}>
              {preview}
              {selected && <span style={{ fontSize: "var(--fs-small)", color: accentColor }}> +{delta}</span>}
            </div>
            <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{formatModifier(abilityMod(preview))}</div>
            {maxed && <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>MAX</div>}
          </button>
        );
      })}
    </div>
  );
}

export function ExpertiseSelectionSection(props: {
  accentColor: string;
  expertiseChoices: LevelUpExpertiseChoice[];
  chosenExpertise: Record<string, string[]>;
  proficientSkills: string[];
  existingExpertise: string[];
  onToggleExpertise: (choiceKey: string, skill: string, count: number) => void;
}) {
  const { accentColor, expertiseChoices, chosenExpertise, proficientSkills, existingExpertise, onToggleExpertise } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {expertiseChoices.map((choice) => {
        const selected = chosenExpertise[choice.key] ?? [];
        const proficientSkillKeys = new Set(proficientSkills.map((skill) => normalizeChoiceKey(skill)));
        const existingExpertiseKeys = new Set(existingExpertise.map((skill) => normalizeChoiceKey(skill)));
        const options = (choice.options ?? proficientSkills)
          .filter((skill) => proficientSkillKeys.has(normalizeChoiceKey(skill)))
          .filter((skill) => !existingExpertiseKeys.has(normalizeChoiceKey(skill)) || selected.some((entry) => normalizeChoiceKey(entry) === normalizeChoiceKey(skill)));
        return (
          <div key={choice.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: "var(--fs-body)", fontWeight: 800, color: "#fff" }}>{choice.source}</div>
              <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? accentColor : C.muted }}>
                {selected.length} / {choice.count}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {options.map((skill) => {
                const isSelected = selected.some((entry) => normalizeChoiceKey(entry) === normalizeChoiceKey(skill));
                const blocked = !isSelected && (selected.length >= choice.count || existingExpertiseKeys.has(normalizeChoiceKey(skill)));
                return (
                  <ChoiceBtn
                    key={skill}
                    active={isSelected}
                    onClick={() => {
                      if (blocked) return;
                      onToggleExpertise(choice.key, skill, choice.count);
                    }}
                    accent={accentColor}
                  >
                    {skill}
                  </ChoiceBtn>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Renders a typed `{kind:"expertise", replace:true}` choice (e.g. Bardic Versatility): pick which
 * currently-held Expertise skill to give up, then pick its replacement. Net Expertise count never
 * changes — this is a swap, not an additional pick. */
export function ExpertiseReplacementSection(props: {
  accentColor: string;
  replacementChoices: LevelUpExpertiseChoice[];
  chosenExpertise: Record<string, string[]>;
  proficientSkills: string[];
  existingExpertise: string[];
  onToggleExpertise: (choiceKey: string, skill: string, count: number) => void;
}) {
  const { accentColor, replacementChoices, chosenExpertise, proficientSkills, existingExpertise, onToggleExpertise } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {replacementChoices.map((choice) => {
        const targetKey = `${choice.key}:target`;
        const target = chosenExpertise[targetKey]?.[0] ?? null;
        const selected = chosenExpertise[choice.key] ?? [];
        const proficientSkillKeys = new Set(proficientSkills.map((skill) => normalizeChoiceKey(skill)));
        const existingExpertiseKeys = new Set(existingExpertise.map((skill) => normalizeChoiceKey(skill)));
        const newSkillOptions = (choice.options ?? proficientSkills)
          .filter((skill) => proficientSkillKeys.has(normalizeChoiceKey(skill)))
          .filter((skill) =>
            !existingExpertiseKeys.has(normalizeChoiceKey(skill))
            || normalizeChoiceKey(skill) === (target ? normalizeChoiceKey(target) : "")
            || selected.some((entry) => normalizeChoiceKey(entry) === normalizeChoiceKey(skill))
          );
        return (
          <div key={choice.key}>
            <div style={{ fontSize: "var(--fs-body)", fontWeight: 800, color: "#fff", marginBottom: 8 }}>{choice.source}</div>
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 6 }}>Replace this Expertise:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {existingExpertise.map((skill) => (
                <ChoiceBtn
                  key={skill}
                  active={target !== null && normalizeChoiceKey(target) === normalizeChoiceKey(skill)}
                  onClick={() => {
                    // Single-select: switching directly to a different skill requires clearing the
                    // old pick first — toggleMultiChoice alone would no-op since count is already met.
                    if (target && normalizeChoiceKey(target) !== normalizeChoiceKey(skill)) onToggleExpertise(targetKey, target, 1);
                    onToggleExpertise(targetKey, skill, 1);
                  }}
                  accent={accentColor}
                >
                  {skill}
                </ChoiceBtn>
              ))}
            </div>
            {target ? (
              <>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 6 }}>Replace with:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {newSkillOptions.map((skill) => {
                    const isSelected = selected.some((entry) => normalizeChoiceKey(entry) === normalizeChoiceKey(skill));
                    const currentPick = selected[0] ?? null;
                    return (
                      <ChoiceBtn
                        key={skill}
                        active={isSelected}
                        onClick={() => {
                          if (currentPick && normalizeChoiceKey(currentPick) !== normalizeChoiceKey(skill)) onToggleExpertise(choice.key, currentPick, choice.count);
                          onToggleExpertise(choice.key, skill, choice.count);
                        }}
                        accent={accentColor}
                      >
                        {skill}
                      </ChoiceBtn>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
