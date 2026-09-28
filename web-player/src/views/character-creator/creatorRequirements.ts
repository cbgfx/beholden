import { classProgressionRequirements } from "@beholden/shared/domain/classProgressionRequirements";
import { evaluateChoiceRequirement, evaluateSpellSelectionRequirement, scoresBeforeEachAsi, validAsiAllocation, type ProgressionRequirement } from "@beholden/shared/domain/progressionRequirements";
import { getCantripCount, getPreparedSpellCount, getSubclassLevel, getSubclassList, usesFlexiblePreparedSpells } from "./utils/CharacterCreatorUtils";
import type { FormState } from "./utils/CharacterCreatorFormUtils";
import type { ClassDetail } from "./utils/CharacterCreatorTypes";
import type { Step5ChoiceState } from "./utils/CharacterCreatorStep5Utils";

export function creatorRequirements(args: {
  existingClasses?: Array<{ id?: string; classId?: string | null; className?: string | null; level?: number }>;
  form: FormState;
  classDetail: ClassDetail | null;
  scores: Record<string, number>;
  scoresBeforeAsi?: Record<string, number>;
  levelUpFeatLevels: number[];
  levelUpFeatConflict: boolean;
  loads: ProgressionRequirement[];
  optionsLoaded: boolean;
  step5: Step5ChoiceState;
  skillsCount: number;
  skillOptions: string[];
  invocCount: number;
  invocationIds: string[];
  spellLists: Array<{ key: string; count: number; options: string[]; sourceLabel?: string | null }>;
  spellChoices: Array<{ key: string; count: number; title?: string; sourceLabel?: string | null }>;
  spellOptions: Record<string, Array<{ id: string }>>;
}): ProgressionRequirement[] {
  const { form, classDetail } = args;
  const result = [...args.loads];
  if (form.classId) result.push(...classProgressionRequirements([
    { id: args.existingClasses?.[0]?.id, classId: form.classId, level: form.level },
    ...(args.existingClasses ?? []).slice(1),
  ]));
  const check = (id: string, complete: boolean, message: string, step: number) =>
    result.push({ id, state: complete ? "complete" : "incomplete", message, step });
  const choice = (id: string, selected: string[], count: number, options: string[] | undefined, step: number, loading = false, repeatable = false, label = id) =>
    result.push(evaluateChoiceRequirement({ id, selected, count, options, step, loading, repeatable, message: loading ? `Loading options for ${label}…` : `Complete ${label} (${count} selection${count === 1 ? "" : "s"}).` }));
  check("ruleset", Boolean(form.ruleset), "Choose a ruleset.", 1);
  check("hp-max", Number.isSafeInteger(Number(form.hpMax)) && Number(form.hpMax) > 0, "Enter a positive whole number for HP Max.", 9);
  check("name", Boolean(form.characterName.trim()), "Enter a character name.", 10);
  check("age", Number.isInteger(Number(form.age)) && Number(form.age) > 0 && Number(form.age) <= 10_000, "Enter a valid age.", 10);
  check("gender", form.gender === "male" || form.gender === "female", "Choose a gender.", 10);
  check("level", Number.isInteger(form.level) && form.level >= 1 && form.level <= 20, "Choose a level from 1 to 20.", 6);
  if (classDetail) {
    if (form.creationHpMethod === "physical") {
      const hitDie = Number(classDetail.hd) || 0;
      const rollsComplete = Array.from({ length: Math.max(0, form.level - 1) }, (_, index) => Number(form.creationHpRolls[String(index + 2)]))
        .every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= hitDie);
      check("physical-hp-rolls", rollsComplete, `Enter every physical d${hitDie} result for levels 2 through ${form.level}.`, 9);
    }
    const subclasses = getSubclassList(classDetail);
    const subclassLevel = getSubclassLevel(classDetail);
    if (subclassLevel != null && form.level >= subclassLevel && subclasses.length > 0)
      check("subclass", subclasses.includes(form.subclass), "Choose a valid subclass.", 6);
    const asiScores = scoresBeforeEachAsi(args.scoresBeforeAsi ?? args.scores, args.levelUpFeatLevels, form.chosenLevelUpFeats);
    for (const level of args.levelUpFeatLevels) {
      const entry = form.chosenLevelUpFeats.find((candidate) => candidate.level === level);
      check(`level-${level}-choice`, entry?.type === "asi" ? validAsiAllocation(entry.abilityBonuses ?? {}, asiScores[level]) : entry?.type === "feat" && Boolean(entry.featId), `Complete the ASI or feat choice at level ${level}.`, 6);
    }
    check("duplicate-feats", !args.levelUpFeatConflict, "A non-repeatable feat is selected more than once.", 6);
    choice("class skills", form.chosenSkills, args.skillsCount, args.skillOptions, 7);
    const cantrips = getCantripCount(classDetail, form.level, form.subclass);
    if (cantrips > 0) choice("class cantrips", form.chosenCantrips, cantrips, undefined, 8, !args.optionsLoaded);
    const capacity = getPreparedSpellCount(classDetail, form.level, form.subclass, args.scores[String(classDetail.spellAbility ?? "").toLowerCase()]);
    result.push({ ...evaluateSpellSelectionRequirement({ selected: form.chosenSpells, capacity, managedOnSheet: usesFlexiblePreparedSpells(classDetail), applicable: capacity > 0, loading: !args.optionsLoaded }), step: 8 });
    if (args.invocCount > 0) choice("invocations", form.chosenInvocations, args.invocCount, args.invocationIds, 8, !args.optionsLoaded, true);
  }
  const proficiencyChecks = [
    ["class feat choices", args.step5.missingClassFeatChoices],
    ["expertise", args.step5.missingClassExpertiseChoices],
    ["feat options", args.step5.missingFeatOptionSelections],
    ["core languages", args.step5.missingCoreLanguages],
    ["class languages", args.step5.missingClassLanguages],
    ["weapon masteries", args.step5.missingWeaponMasteries],
    ["class tools", args.step5.missingClassToolChoices],
  ] as const;
  for (const [id, missing] of proficiencyChecks) check(id, !missing, `Complete ${id}.`, 7);
  for (const entry of args.spellLists) choice(entry.key, form.chosenFeatOptions[entry.key] ?? [], entry.count, entry.options, 8, false, false, entry.sourceLabel ? entry.sourceLabel + " spell list" : "spell list");
  for (const entry of args.spellChoices) {
    const options = args.spellOptions[entry.key];
    choice(entry.key, form.chosenFeatOptions[entry.key] ?? [], entry.count, options?.map((option) => option.id), 8, options === undefined, false, [entry.sourceLabel, entry.title ?? "spell choices"].filter(Boolean).join(": "));
  }
  return result;
}
