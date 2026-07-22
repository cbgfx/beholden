import React from "react";
import { Select } from "@/ui/Select";
import { C } from "@/lib/theme";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { ABILITY_KEYS, ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import {
  featuresUpToLevelForSubclass,
  getSubclassLevel,
  getSubclassList,
  parseStartingEquipmentOptions,
  type StartingEquipmentOption,
} from "../utils/CharacterCreatorUtils";
import { NavButtons } from "../shared/CharacterCreatorParts";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  labelStyle,
  sourceTagStyle,
} from "../shared/CharacterCreatorStyles";
import { PreparedSpellProgressionBlock } from "@/views/character/CharacterViewParts";
import { getOptionalGroups, resolvedScores } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { CharacterCreatorStepRenderContext, StepRenderResult } from "./CharacterCreatorStepContext";

interface OptionalGroupLike {
  level: number;
  name: string;
  exclusive: boolean;
  features: Array<{ name: string; text: string; selectionNames: string[]; preparedSpellProgression?: PreparedSpellProgressionTable[] }>;
}

function renderLevelStep({
  level,
  subclass,
  setSubclass,
  showSubclass,
  subclassList,
  optGroups,
  chosenOptionals,
  toggleOptional,
  classEquipmentOptions,
  chosenClassEquipmentOption,
  chooseClassEquipmentOption,
  className,
  features,
  levelUpFeatChoices,
  levelUpScores,
  toggleLevelUpChoiceMode,
  toggleLevelUpAsiPoint,
  chooseLevelUpFeat,
  levelUpFeatConflict,
  onBack,
  onNext,
}: {
  level: number;
  subclass: string;
  setSubclass: (value: string) => void;
  showSubclass: boolean | null;
  subclassList: string[];
  optGroups: OptionalGroupLike[];
  chosenOptionals: string[];
  toggleOptional: (selectionNames: string[], exclusive: boolean, groupFeatures: string[]) => void;
  classEquipmentOptions: StartingEquipmentOption[];
  chosenClassEquipmentOption: string | null;
  chooseClassEquipmentOption: (id: string) => void;
  className: string | null;
  features: Array<{ level: number; name: string; text: string; preparedSpellProgression?: PreparedSpellProgressionTable[] }>;
  levelUpFeatChoices: Array<{
    level: number;
    mode: "asi" | "feat" | null;
    selectedFeatId: string | null;
    options: Array<{ id: string; name: string }>;
    asiBonuses: Record<string, number>;
  }>;
  levelUpScores: Record<number, Record<string, number>>;
  toggleLevelUpChoiceMode: (level: number, mode: "asi" | "feat") => void;
  toggleLevelUpAsiPoint: (level: number, ability: string) => void;
  chooseLevelUpFeat: (level: number, featId: string) => void;
  levelUpFeatConflict: boolean;
  onBack: () => void;
  onNext: () => void;
}): { main: React.ReactNode; side: React.ReactNode } {
  const trimmedClassName = String(className ?? "").trim();
  const main = (
    <div>
      <h2 style={headingStyle}>Class Details</h2>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <label style={{ color: C.muted, fontWeight: 600 }}>Level</label>
        <div style={{ ...inputStyle, width: 80, opacity: 0.68, cursor: "default" }}>{level}</div>
      </div>

      {showSubclass && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...labelStyle }}>Subclass</label>
          <Select value={subclass} onChange={(e) => setSubclass(e.target.value)} style={{ width: 280 }}>
            <option value="">— Choose subclass —</option>
            {subclassList.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      )}

      {optGroups.map((grp) => {
        const names = grp.features.flatMap((feature) => feature.selectionNames);
        return (
          <div key={`${grp.level}:${grp.name}`} style={{ marginBottom: 20 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>
              Level {grp.level} — {grp.name}: {grp.exclusive ? "Choose one" : "Choose any"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {grp.features.map((f) => {
                const chosen = f.selectionNames.every((name) => chosenOptionals.includes(name));
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => toggleOptional(f.selectionNames, grp.exclusive, names)}
                    style={{
                      textAlign: "left",
                      padding: "11px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border: `2px solid ${chosen ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: chosen ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      transition: "border-color 0.12s, background 0.12s",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: chosen ? C.accentHl : C.text }}>{f.name}</div>
                    {f.text && (
                      <div style={{ color: "rgba(160,180,220,0.65)", fontSize: "var(--fs-small)", marginTop: 3, lineHeight: 1.45 }}>
                        {f.text.replace(/Source:.*$/m, "").trim().slice(0, 140)}
                        {f.text.length > 140 ? "…" : ""}
                      </div>
                    )}
                    {f.preparedSpellProgression?.length ? (
                      <PreparedSpellProgressionBlock tables={f.preparedSpellProgression} compact accentColor={chosen ? C.accentHl : C.colorMagic} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {levelUpFeatChoices.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Level-Up Feats</div>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 10 }}>
            Review feats for each Ability Score Improvement level included in this character.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {levelUpFeatChoices.map((choice) => (
              <div key={choice.level}>
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.accentHl, marginBottom: 6 }}>Level {choice.level}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => toggleLevelUpChoiceMode(choice.level, "asi")}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border: `1px solid ${choice.mode === "asi" ? C.accentHl : "rgba(255,255,255,0.14)"}`,
                      background: choice.mode === "asi" ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: choice.mode === "asi" ? C.accentHl : "rgba(160,180,220,0.7)",
                      fontWeight: choice.mode === "asi" ? 700 : 500,
                      fontSize: "var(--fs-small)",
                    }}
                  >
                    Ability Score Improvement
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLevelUpChoiceMode(choice.level, "feat")}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border: `1px solid ${choice.mode === "feat" ? C.accentHl : "rgba(255,255,255,0.14)"}`,
                      background: choice.mode === "feat" ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: choice.mode === "feat" ? C.accentHl : "rgba(160,180,220,0.7)",
                      fontWeight: choice.mode === "feat" ? 700 : 500,
                      fontSize: "var(--fs-small)",
                    }}
                  >
                    Level-Up Feat
                  </button>
                </div>
                <Select
                  value={choice.selectedFeatId ?? ""}
                  onChange={(e) => chooseLevelUpFeat(choice.level, e.target.value)}
                  disabled={choice.mode !== "feat"}
                  style={{ width: "100%", maxWidth: 380, opacity: choice.mode === "feat" ? 1 : 0.55 }}
                >
                  <option value="">- Choose feat -</option>
                  {choice.options.map((feat) => (
                    <option key={feat.id} value={feat.id}>{feat.name}</option>
                  ))}
                </Select>
                {choice.mode === "asi" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
                    {ABILITY_KEYS.map((ability) => {
                      const current = levelUpScores[choice.level]?.[ability] ?? 10;
                      const bonus = choice.asiBonuses[ability] ?? 0;
                      const totalAssigned = Object.values(choice.asiBonuses).reduce((sum, value) => sum + value, 0);
                      const capped = current >= 20;
                      const blocked = bonus === 0 && (totalAssigned >= 2 || capped);
                      return (
                        <button
                          key={`${choice.level}:${ability}`}
                          type="button"
                          disabled={blocked}
                          onClick={() => toggleLevelUpAsiPoint(choice.level, ability)}
                          style={{
                            padding: "10px 8px",
                            borderRadius: 8,
                            textAlign: "center",
                            cursor: blocked ? "default" : "pointer",
                            border: `1px solid ${bonus > 0 ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                            background: bonus > 0 ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                            color: blocked && bonus === 0 ? "rgba(160,180,220,0.4)" : C.text,
                          }}
                        >
                          <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 3 }}>{ABILITY_LABELS[ability]}</div>
                          <div style={{ fontWeight: 800, fontSize: "var(--fs-medium)" }}>
                            {Math.min(20, current + bonus)}
                            {bonus > 0 ? <span style={{ fontSize: "var(--fs-small)", color: C.accentHl }}> +{bonus}</span> : null}
                          </div>
                          <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{capped && bonus === 0 ? "MAX" : bonus > 0 ? "Click to remove" : "Click to add"}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          {levelUpFeatConflict && (
            <div style={{ color: C.red, fontSize: "var(--fs-small)", marginTop: 10 }}>
              A non-repeatable feat has been selected more than once.
            </div>
          )}
        </div>
      )}

      {classEquipmentOptions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>
            Class Starting Equipment {trimmedClassName ? <span style={sourceTagStyle}>{trimmedClassName}</span> : null}
          </div>
          {classEquipmentOptions.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {classEquipmentOptions.map((option) => {
                const selected = chosenClassEquipmentOption === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => chooseClassEquipmentOption(option.id)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      cursor: "pointer",
                      fontSize: "var(--fs-small)",
                      fontWeight: 600,
                      border: `1px solid ${selected ? C.accentHl : "rgba(255,255,255,0.15)"}`,
                      background: selected ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.04)",
                      color: selected ? C.accentHl : C.muted,
                    }}
                  >
                    Option {option.id}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {classEquipmentOptions.map((option) => (
                <div
                  key={`class-eq-${option.id}`}
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${chosenClassEquipmentOption === option.id ? `${C.accentHl}66` : "rgba(255,255,255,0.12)"}`,
                    background: chosenClassEquipmentOption === option.id ? "rgba(56,182,255,0.10)" : "rgba(255,255,255,0.03)",
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: chosenClassEquipmentOption === option.id ? C.accentHl : C.text, marginBottom: 4 }}>
                    Option {option.id}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {option.entries.map((entry, index) => (
                      <div key={`class-eq-${option.id}-${index}`} style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.45 }}>
                        {entry}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
          {chosenClassEquipmentOption && classEquipmentOptions.length > 0 && (
            <div style={{ color: C.accentHl, fontSize: "var(--fs-small)", marginTop: 8 }}>
              Inventory will start with class option {chosenClassEquipmentOption}.
            </div>
          )}
        </div>
      )}

      <NavButtons
        step={6}
        onBack={onBack}
        onNext={onNext}
        nextDisabled={
          (Boolean(showSubclass) && !subclass)
          || (classEquipmentOptions.length > 0 && !chosenClassEquipmentOption)
          || levelUpFeatChoices.some((choice) => (
            !choice.mode
            || (choice.mode === "feat" && !choice.selectedFeatId)
            || (choice.mode === "asi" && Object.values(choice.asiBonuses).reduce((sum, value) => sum + value, 0) !== 2)
          ))
          || levelUpFeatConflict
        }
      />
    </div>
  );

  const side = (
    <div style={{ ...detailBoxStyle, maxHeight: 600, overflowY: "auto" }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: "var(--fs-subtitle)", color: C.accentHl }}>Class Features — Level {level}</div>
      {features.length === 0 && <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>No features yet. Select a class first.</div>}
      {features.map((f) => (
        <div key={`${f.level}:${f.name}`} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-small)", color: C.accentHl }}>Lv{f.level} · {f.name}</div>
          <div style={{ color: "rgba(160,180,220,0.65)", fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
            {f.text.replace(/Source:.*$/m, "").trim()}
          </div>
          {f.preparedSpellProgression?.length ? (
            <PreparedSpellProgressionBlock tables={f.preparedSpellProgression} compact accentColor={C.accentHl} />
          ) : null}
        </div>
      ))}
    </div>
  );
  return { main, side };
}

export function renderLevelFromContext(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const subclassList = ctx.classDetail ? getSubclassList(ctx.classDetail) : [];
  const scNeeded = ctx.classDetail ? (getSubclassLevel(ctx.classDetail) ?? 99) : 99;
  const showSubclass = Boolean(ctx.classDetail && ctx.form.level >= scNeeded && subclassList.length > 0);
  const features = (ctx.classDetail ? featuresUpToLevelForSubclass(ctx.classDetail, ctx.form.level, ctx.form.subclass) : []).map((f) => ({ ...f, text: f.text ?? "" }));
  const optGroups = ctx.classDetail
    ? getOptionalGroups(ctx.classDetail, ctx.form.level)
        .map((group) => ({
          ...group,
          features: group.features.filter((feature) => !/ability score improvement/i.test(feature.name.trim())),
        }))
        .filter((group) => group.features.length > 0)
    : [];
  const classEquipmentOptions = parseStartingEquipmentOptions(ctx.classDetail?.equipmentOptions);
  const scoresBeforeLevelUpAsi = resolvedScores(ctx.form, ctx.selectedFeatGrantedAbilityBonuses);
  const levelUpScores = ctx.levelUpFeatLevels.reduce<Record<number, Record<string, number>>>((acc, level) => {
    const previousLevel = ctx.levelUpFeatLevels.filter((candidate) => candidate < level).sort((a, b) => a - b).pop();
    const previousScores = previousLevel != null ? acc[previousLevel] : scoresBeforeLevelUpAsi;
    const nextScores = { ...previousScores };
    const previousEntry = previousLevel != null ? ctx.form.chosenLevelUpFeats.find((entry) => entry.level === previousLevel) : null;
    if (previousEntry?.type === "asi") {
      for (const [ability, bonus] of Object.entries(previousEntry.abilityBonuses ?? {})) {
        nextScores[ability] = Math.min(20, (nextScores[ability] ?? 10) + bonus);
      }
    }
    acc[level] = nextScores;
    return acc;
  }, {});
  function toggleOptional(selectionNames: string[], exclusive: boolean, groupFeatures: string[]) {
    ctx.setForm((f) => {
      let next = [...f.chosenOptionals];
      const selected = selectionNames.every((name) => next.includes(name));
      if (exclusive) {
        next = next.filter((n) => !groupFeatures.includes(n));
        if (!selected) next.push(...selectionNames);
      } else {
        next = selected ? next.filter((n) => !selectionNames.includes(n)) : [...next, ...selectionNames];
      }
      return { ...f, chosenOptionals: Array.from(new Set(next)) };
    });
  }

  return renderLevelStep({
    level: ctx.form.level,
    subclass: ctx.form.subclass,
    setSubclass: (value) => ctx.setField("subclass", value),
    showSubclass,
    subclassList,
    optGroups,
    chosenOptionals: ctx.form.chosenOptionals,
    toggleOptional,
    classEquipmentOptions,
    chosenClassEquipmentOption: ctx.form.chosenClassEquipmentOption,
    chooseClassEquipmentOption: (id) => ctx.setForm((f) => ({ ...f, chosenClassEquipmentOption: id })),
    className: ctx.classDetail?.name ?? null,
    features,
    levelUpFeatChoices: ctx.levelUpFeatLevels.map((level) => {
      const entry = ctx.form.chosenLevelUpFeats.find((candidate) => candidate.level === level);
      return {
        level,
        mode: entry?.type ?? null,
        selectedFeatId: entry?.featId ?? null,
        options: ctx.availableLevelUpFeats,
        asiBonuses: entry?.abilityBonuses ?? {},
      };
    }),
    levelUpScores,
    toggleLevelUpChoiceMode: (level, mode) => ctx.setForm((f) => ({
      ...f,
      chosenLevelUpFeats: [
        ...f.chosenLevelUpFeats.filter((entry) => entry.level !== level),
        { level, type: mode as "feat" | "asi" | undefined, featId: null, abilityBonuses: {} },
      ].sort((a, b) => a.level - b.level),
      chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([key]) => !key.startsWith(`levelupfeat:${level}:`))),
    })),
    toggleLevelUpAsiPoint: (level, ability) => ctx.setForm((f) => {
      const existing = f.chosenLevelUpFeats.find((entry) => entry.level === level);
      const bonuses = { ...(existing?.abilityBonuses ?? {}) };
      const assigned = Object.values(bonuses).reduce((sum, value) => sum + value, 0);
      const current = bonuses[ability] ?? 0;
      if (current >= 2) bonuses[ability] = current - 1;
      else if (current > 0 && assigned >= 2) {
        if (current === 1) delete bonuses[ability];
        else bonuses[ability] = current - 1;
      } else if (assigned < 2) bonuses[ability] = current + 1;
      return {
        ...f,
        chosenLevelUpFeats: [
          ...f.chosenLevelUpFeats.filter((entry) => entry.level !== level),
          { level, type: "asi" as const, featId: null, abilityBonuses: bonuses },
        ].sort((a, b) => a.level - b.level),
      };
    }),
    chooseLevelUpFeat: (level, featId) => ctx.setForm((f) => ({
      ...f,
      chosenLevelUpFeats: [
        ...f.chosenLevelUpFeats.filter((entry) => entry.level !== level),
        { level, type: "feat" as const, featId: featId || null, abilityBonuses: {} },
      ].sort((a, b) => a.level - b.level),
      chosenFeatOptions: featId
        ? f.chosenFeatOptions
        : Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([key]) => !key.startsWith(`levelupfeat:${level}:`))),
    })),
    levelUpFeatConflict: Boolean(ctx.levelUpFeatConflict),
    onBack: () => ctx.setStep(5),
    onNext: () => ctx.setStep(7),
  });
}
