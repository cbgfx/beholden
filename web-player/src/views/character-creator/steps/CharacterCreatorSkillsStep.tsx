import React from "react";
import { C } from "@/lib/theme";
import { normalizeChoiceKey } from "../utils/CharacterCreatorUtils";
import { ALL_LANGUAGES, ALL_SKILLS, ALL_TOOLS } from "../constants/CharacterCreatorConstants";
import { NavButtons } from "../shared/CharacterCreatorParts";
import { detailBoxStyle, headingStyle, labelStyle, profChipStyle, sourceTagStyle } from "../shared/CharacterCreatorStyles";
import { renderChoiceChipGroup, renderClassFeatSingleChoicePanel } from "./CharacterCreatorPanelHelpers";
import {
  duplicateLockedForStep5,
  getFeatChoiceOptionsForStep5,
  getFixedGrantsForStep5,
  type Step5ClassExpertiseChoiceLike,
  type Step5ClassFeatChoiceLike,
  type Step5EntryWithChoice,
  type Step5LanguageChoiceLike,
  type Step5ParsedFeatLike,
  type Step5ChoiceState,
  type Step5WeaponMasteryChoiceLike,
} from "../utils/CharacterCreatorStep5Utils";

type StepResult = { main: React.ReactNode; side: React.ReactNode };

interface CreatorFormLike {
  chosenSkills: string[];
  chosenBgLanguages: string[];
  chosenRaceLanguages: string[];
  chosenClassLanguages: string[];
  chosenClassFeatIds: Record<string, string>;
  chosenFeatOptions: Record<string, string[]>;
  chosenWeaponMasteries: string[];
}

interface ClassFeatureProficiencyChoiceLike {
  key: string;
  sourceLabel: string;
  category: "skill" | "tool" | "language";
  count: number;
}

interface SelectedClassFeatEntryLike {
  choice: Step5ClassFeatChoiceLike;
  detail: { name: string; text?: string | null };
}

const SKILL_KEY_SET = new Set(ALL_SKILLS.map((skill) => normalizeChoiceKey(skill.name)));
const TOOL_KEY_SET = new Set(ALL_TOOLS.map((tool) => normalizeChoiceKey(tool)));
const LANGUAGE_KEY_SET = new Set(ALL_LANGUAGES.map((language) => normalizeChoiceKey(language)));

function classifyChoiceOption(option: string): "skill" | "tool" | "language" | null {
  const key = normalizeChoiceKey(option);
  if (SKILL_KEY_SET.has(key)) return "skill";
  if (TOOL_KEY_SET.has(key)) return "tool";
  if (LANGUAGE_KEY_SET.has(key)) return "language";
  return null;
}

function choiceButtonStyle(selected: boolean, locked: boolean, duplicate: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: "var(--fs-subtitle)",
    cursor: locked || duplicate ? "default" : "pointer",
    border: `1px solid ${selected ? C.accentHl : duplicate ? "rgba(160,180,220,0.12)" : "rgba(255,255,255,0.12)"}`,
    background: selected ? "rgba(56,182,255,0.18)" : duplicate ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.055)",
    color: selected ? C.accentHl : (locked || duplicate) ? "rgba(160,180,220,0.35)" : C.text,
    fontWeight: selected ? 700 : 400,
  };
}

export function renderSkillsStep<TForm extends CreatorFormLike>(args: {
  form: TForm;
  setForm: React.Dispatch<React.SetStateAction<TForm>>;
  classDetailName: string | null;
  bgDetailName?: string | null;
  skillList: string[];
  numSkills: number;
  bgLangChoice: { fixed: string[]; choose: number; from: string[] | null };
  coreLanguageChoice: Step5LanguageChoiceLike | null;
  classLanguageChoice: Step5LanguageChoiceLike | null;
  classFeatChoices: Step5ClassFeatChoiceLike[];
  classExpertiseChoices: Step5ClassExpertiseChoiceLike[];
  classSelectedFeatChoices: Step5EntryWithChoice[];
  selectedClassFeatEntries: SelectedClassFeatEntryLike[];
  bgFeatChoices: Step5EntryWithChoice[];
  raceFeatChoices: Step5EntryWithChoice[];
  classFeatureProficiencyChoices: ClassFeatureProficiencyChoiceLike[];
  chosenFeatureChoices: Record<string, string[]>;
  setChosenFeatureChoices: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  weaponMasteryChoice: Step5WeaponMasteryChoiceLike | null;
  weaponOptions: string[];
  choiceState: Pick<
    Step5ChoiceState,
    | "missingClassFeatChoices"
    | "missingClassExpertiseChoices"
    | "missingFeatOptionSelections"
    | "missingCoreLanguages"
    | "missingClassLanguages"
    | "missingWeaponMasteries"
    | "hasAnything"
    | "takenSkillKeys"
    | "takenToolKeys"
    | "takenLanguageKeys"
    | "takenExpertiseKeys"
  >;
  getClassFeatChoiceLabel: (featGroup: string) => string;
  getClassFeatOptionLabel: (optionName: string, featGroup: string) => string;
  sideSummary: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
}): StepResult {
  const { form, setForm, classDetailName, bgDetailName, skillList, numSkills, bgLangChoice, coreLanguageChoice, classLanguageChoice, classFeatChoices, classExpertiseChoices, classSelectedFeatChoices, selectedClassFeatEntries, bgFeatChoices, raceFeatChoices, weaponMasteryChoice, weaponOptions, choiceState, getClassFeatChoiceLabel, getClassFeatOptionLabel, sideSummary, onBack, onNext } = args;
  const { classFeatureProficiencyChoices, chosenFeatureChoices, setChosenFeatureChoices } = args;
  const { missingClassFeatChoices, missingClassExpertiseChoices, missingFeatOptionSelections, missingCoreLanguages, missingClassLanguages, missingWeaponMasteries, hasAnything, takenSkillKeys, takenToolKeys, takenLanguageKeys, takenExpertiseKeys } = choiceState;

  const takenFeatureSkillKeys = new Set(
    classFeatureProficiencyChoices
      .filter((choice) => choice.category === "skill")
      .flatMap((choice) => chosenFeatureChoices[choice.key] ?? [])
      .map(normalizeChoiceKey)
  );
  const takenFeatureToolKeys = new Set(
    classFeatureProficiencyChoices
      .filter((choice) => choice.category === "tool")
      .flatMap((choice) => chosenFeatureChoices[choice.key] ?? [])
      .map(normalizeChoiceKey)
  );
  const takenFeatureLanguageKeys = new Set(
    classFeatureProficiencyChoices
      .filter((choice) => choice.category === "language")
      .flatMap((choice) => chosenFeatureChoices[choice.key] ?? [])
      .map(normalizeChoiceKey)
  );

  function duplicateLocked(kind: "skill" | "tool" | "language" | "expertise", value: string, selected: boolean): boolean {
    if (!selected) {
      const normalized = normalizeChoiceKey(value);
      if (kind === "skill" && takenFeatureSkillKeys.has(normalized)) return true;
      if (kind === "tool" && takenFeatureToolKeys.has(normalized)) return true;
      if (kind === "language" && takenFeatureLanguageKeys.has(normalized)) return true;
    }
    return duplicateLockedForStep5(kind, value, selected, { takenSkillKeys, takenToolKeys, takenLanguageKeys, takenExpertiseKeys });
  }

  function toggleList(key: "chosenBgLanguages" | "chosenRaceLanguages" | "chosenClassLanguages" | "chosenWeaponMasteries" | "chosenSkills", value: string, max: number) {
    setForm((prev) => {
      const current = prev[key];
      const selected = current.includes(value);
      const next = selected ? current.filter((name) => name !== value) : current.length < max ? [...current, value] : current;
      return { ...prev, [key]: next };
    });
  }

  function toggleFeatChoice(choiceKey: string, option: string, max: number) {
    setForm((prev) => {
      const current = prev.chosenFeatOptions[choiceKey] ?? [];
      const selected = current.includes(option);
      const next = selected ? current.filter((value) => value !== option) : current.length < max ? [...current, option] : current;
      return { ...prev, chosenFeatOptions: { ...prev.chosenFeatOptions, [choiceKey]: next } };
    });
  }

  const renderFeatGroup = (entries: Step5EntryWithChoice[], sourceLabel?: string, sourceStyle?: React.CSSProperties) =>
    entries
      .filter(({ choice }) => choice.type !== "spell" && choice.type !== "spell_list")
      .map(({ featName, feat, choice, key, sourceLabel: entrySourceLabel }) => {
      const selected = form.chosenFeatOptions[key] ?? [];
      return renderChoiceChipGroup({
        title: featName,
        sourceLabel: entrySourceLabel ?? sourceLabel ?? undefined,
        sourceStyle,
        selectedCount: selected.length,
        maxCount: choice.count,
        fixedGrants: getFixedGrantsForStep5(feat),
        options: getFeatChoiceOptionsForStep5(choice),
        isSelected: (option) => selected.includes(option),
        isLocked: (option, isSelected) => {
          const duplicate = (() => {
            if (choice.type === "expertise") return duplicateLocked("expertise", option, isSelected);
            if (choice.type !== "proficiency") return false;
            const optionKind = classifyChoiceOption(option);
            if (!optionKind) return false;
            if (!choice.anyOf?.includes(optionKind)) return false;
            return duplicateLocked(optionKind, option, isSelected);
          })();
          return (!isSelected && selected.length >= choice.count) || duplicate;
        },
        onToggle: (option) => toggleFeatChoice(key, option, choice.count),
        note: choice.note,
      });
    });

  const main = (
    <div>
      <h2 style={headingStyle}>Skills &amp; Proficiencies</h2>

      {numSkills > 0 && skillList.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ ...labelStyle, margin: 0 }}>
              Skill Proficiencies {classDetailName ? <span style={sourceTagStyle}>from {classDetailName}</span> : null}
            </div>
            <span style={{ fontSize: "var(--fs-small)", color: form.chosenSkills.length >= numSkills ? C.accentHl : C.muted }}>
              {form.chosenSkills.length} / {numSkills}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {skillList.map((skill) => {
              const selected = form.chosenSkills.includes(skill);
              const duplicate = duplicateLocked("skill", skill, selected);
              const locked = (!selected && form.chosenSkills.length >= numSkills) || duplicate;
              return (
                <button key={skill} type="button" disabled={locked} onClick={() => toggleList("chosenSkills", skill, numSkills)} style={choiceButtonStyle(selected, locked, duplicate)}>
                  {skill}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(bgLangChoice.fixed.length > 0 || bgLangChoice.choose > 0) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ ...labelStyle, margin: 0 }}>Languages {bgDetailName ? <span style={sourceTagStyle}>from {bgDetailName}</span> : null}</div>
            {bgLangChoice.choose > 0 && <span style={{ fontSize: "var(--fs-small)", color: form.chosenBgLanguages.length >= bgLangChoice.choose ? C.accentHl : C.muted }}>{form.chosenBgLanguages.length} / {bgLangChoice.choose}</span>}
          </div>
          {bgLangChoice.fixed.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: bgLangChoice.choose > 0 ? 10 : 0 }}>{bgLangChoice.fixed.map((language) => <span key={language} style={profChipStyle}>{language}</span>)}</div>}
          {bgLangChoice.choose > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(bgLangChoice.from ?? ALL_LANGUAGES).map((language) => {
            const selected = form.chosenBgLanguages.includes(language);
            const duplicate = duplicateLocked("language", language, selected);
            const locked = (!selected && form.chosenBgLanguages.length >= bgLangChoice.choose) || duplicate;
            return <button key={language} type="button" disabled={locked} onClick={() => toggleList("chosenBgLanguages", language, bgLangChoice.choose)} style={choiceButtonStyle(selected, locked, duplicate)}>{language}</button>;
          })}</div>}
        </div>
      )}

      {coreLanguageChoice && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ ...labelStyle, margin: 0 }}>Languages <span style={sourceTagStyle}>{coreLanguageChoice.source}</span></div>
            <span style={{ fontSize: "var(--fs-small)", color: form.chosenRaceLanguages.length >= coreLanguageChoice.choose ? C.accentHl : C.muted }}>{form.chosenRaceLanguages.length} / {coreLanguageChoice.choose}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>{coreLanguageChoice.fixed.map((language) => <span key={language} style={profChipStyle}>{language}</span>)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(coreLanguageChoice.from ?? ALL_LANGUAGES).map((language) => {
            const selected = form.chosenRaceLanguages.includes(language);
            const duplicate = duplicateLocked("language", language, selected);
            const locked = (!selected && form.chosenRaceLanguages.length >= coreLanguageChoice.choose) || duplicate;
            return <button key={language} type="button" disabled={locked} onClick={() => toggleList("chosenRaceLanguages", language, coreLanguageChoice.choose)} style={choiceButtonStyle(selected, locked, duplicate)}>{language}</button>;
          })}</div>
        </div>
      )}

      {classLanguageChoice && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ ...labelStyle, margin: 0 }}>Languages <span style={sourceTagStyle}>{classLanguageChoice.source}</span></div>
            {classLanguageChoice.choose > 0 && <span style={{ fontSize: "var(--fs-small)", color: form.chosenClassLanguages.length >= classLanguageChoice.choose ? C.accentHl : C.muted }}>{form.chosenClassLanguages.length} / {classLanguageChoice.choose}</span>}
          </div>
          {classLanguageChoice.fixed.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: classLanguageChoice.choose > 0 ? 10 : 0 }}>{classLanguageChoice.fixed.map((language) => <span key={language} style={profChipStyle}>{language}</span>)}</div>}
          {classLanguageChoice.choose > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(classLanguageChoice.from ?? ALL_LANGUAGES).map((language) => {
            const selected = form.chosenClassLanguages.includes(language);
            const duplicate = duplicateLocked("language", language, selected);
            const locked = (!selected && form.chosenClassLanguages.length >= classLanguageChoice.choose) || duplicate;
            return <button key={language} type="button" disabled={locked} onClick={() => toggleList("chosenClassLanguages", language, classLanguageChoice.choose)} style={choiceButtonStyle(selected, locked, duplicate)}>{language}</button>;
          })}</div>}
        </div>
      )}

      {classFeatChoices.map((choice) => renderClassFeatSingleChoicePanel({
        choice,
        selectedId: form.chosenClassFeatIds[choice.featureName] ?? "",
        getChoiceLabel: getClassFeatChoiceLabel,
        getOptionLabel: getClassFeatOptionLabel,
        onSelect: (id) => setForm((prev) => ({ ...prev, chosenClassFeatIds: { ...prev.chosenClassFeatIds, [choice.featureName]: id } })),
      }))}

      {renderFeatGroup(bgFeatChoices, bgDetailName ?? undefined)}
      {renderFeatGroup(raceFeatChoices, undefined, { ...sourceTagStyle, background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.4)", color: C.colorOrange })}

      {classExpertiseChoices.map((choice) => {
        const selected = form.chosenFeatOptions[choice.key] ?? [];
        const options = (choice.options ?? ALL_SKILLS.map((skill) => skill.name)).filter((skill) => takenSkillKeys.has(normalizeChoiceKey(skill)) || selected.includes(skill));
        return renderChoiceChipGroup({
          title: "Expertise",
          sourceLabel: choice.source,
          selectedCount: selected.length,
          maxCount: choice.count,
          options,
          isSelected: (skill) => selected.includes(skill),
          isLocked: (skill, isSelected) => (!isSelected && selected.length >= choice.count) || duplicateLocked("expertise", skill, isSelected),
          onToggle: (skill) => toggleFeatChoice(choice.key, skill, choice.count),
        });
      })}

      {renderFeatGroup(classSelectedFeatChoices)}

      {classFeatureProficiencyChoices.map((choice) => {
        const selected = chosenFeatureChoices[choice.key] ?? [];
        const options =
          choice.category === "skill" ? ALL_SKILLS.map((skill) => skill.name)
          : choice.category === "tool" ? ALL_TOOLS
          : ALL_LANGUAGES;
        return renderChoiceChipGroup({
          title:
            choice.category === "skill" ? "Bonus Proficiencies"
            : choice.category === "tool" ? "Bonus Tool Proficiencies"
            : "Bonus Languages",
          sourceLabel: choice.sourceLabel,
          selectedCount: selected.length,
          maxCount: choice.count,
          options,
          isSelected: (option) => selected.includes(option),
          isLocked: (option, isSelected) =>
            (!isSelected && selected.length >= choice.count)
            || duplicateLocked(choice.category === "language" ? "language" : choice.category, option, isSelected),
          onToggle: (option) =>
            setChosenFeatureChoices((prev) => {
              const current = prev[choice.key] ?? [];
              const next = current.includes(option)
                ? current.filter((value) => value !== option)
                : current.length < choice.count
                  ? [...current, option]
                  : current;
              return { ...prev, [choice.key]: next };
            }),
        });
      })}

      {weaponMasteryChoice && renderChoiceChipGroup({
        title: "Weapon Mastery",
        sourceLabel: weaponMasteryChoice.source,
        selectedCount: form.chosenWeaponMasteries.length,
        maxCount: weaponMasteryChoice.count,
        options: weaponOptions,
        isSelected: (weapon) => form.chosenWeaponMasteries.includes(weapon),
        isLocked: (_weapon, selected) => !selected && form.chosenWeaponMasteries.length >= weaponMasteryChoice.count,
        onToggle: (weapon) => toggleList("chosenWeaponMasteries", weapon, weaponMasteryChoice.count),
      })}

      {!hasAnything && classFeatureProficiencyChoices.length === 0 && <p style={{ color: C.muted, fontSize: "var(--fs-medium)" }}>There are no skill, language, mastery, or expertise choices at this level.</p>}
      <NavButtons
        step={5}
        onBack={onBack}
        onNext={onNext}
        nextDisabled={
          missingClassFeatChoices
          || missingClassExpertiseChoices
          || missingFeatOptionSelections
          || missingCoreLanguages
          || missingClassLanguages
          || missingWeaponMasteries
          || classFeatureProficiencyChoices.some((choice) => (chosenFeatureChoices[choice.key] ?? []).length < choice.count)
        }
      />
    </div>
  );

  const side = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selectedClassFeatEntries.map(({ choice, detail }) => (
        <div key={choice.featureName} style={detailBoxStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: C.accentHl, marginBottom: 10 }}>{getClassFeatChoiceLabel(choice.featGroup)}</div>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", marginBottom: 8 }}>{getClassFeatOptionLabel(detail.name, choice.featGroup)}</div>
          <div style={{ color: "rgba(160,180,220,0.75)", fontSize: "var(--fs-small)", lineHeight: 1.5 }}>{(detail.text ?? "").replace(/Source:.*$/m, "").trim()}</div>
        </div>
      ))}
      {sideSummary}
    </div>
  );

  return { main, side };
}
