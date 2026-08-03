import { collectFeatTaggedEntries } from "./FeatGrantUtils";
import { buildAcquisitionLevelIndex, tagAcquisitionLevel } from "@/domain/character/spellAcquisition";
import {
  ABILITY_SCORE_NAMES,
  ALL_LANGUAGES,
  STANDARD_55E_LANGUAGES,
} from "../constants/CharacterCreatorConstants";
import {
  getClassExpertiseChoices,
} from "./CharacterCreatorUtils";
import {
  dedupeTaggedItems,
  normalizeArmorProficiencyName,
  normalizeLanguageName,
  normalizeSpellTrackingName,
  splitArmorProficiencyNames,
  splitWeaponProficiencyNames,
  normalizeWeaponProficiencyName,
} from "@/views/character/CharacterSheetUtils";
import {
  getClassLanguageChoice,
  getCoreLanguageChoice,
} from "@/views/character/CharacterRuleParsers";
import {
  collectProficiencyChoiceEffectsFromEffects,
  collectSpellChoicesFromEffects,
  collectTaggedGrantsFromEffects,
  parseFeatureEffects,
} from "@/domain/character/parseFeatureEffects";
import { resolveSelectedSpellOptionEntries } from "./SpellChoiceUtils";
import { resolveFeatSpellEntries } from "./FeatSpellcastingUtils";
import {
  getGrowthChoiceDefinitions,
  getGrowthChoiceSelectedAbility,
  getGrowthChoiceSelectedIds,
} from "./GrowthChoiceUtils";
import type { ProficiencyMap, TaggedItem } from "@/views/character/CharacterSheetTypes";
import {
  parseAppliedClassFeatureEffects,
  parseAppliedSpeciesTraitEffects,
  getWeaponMasteryChoice,
} from "./CharacterCreatorClassFeatureUtils";
import type {
  CreatorBackgroundFeatLike,
  CreatorLevelUpFeatDetailLike,
  CreatorClassDetailLike,
  CreatorRaceDetailLike,
  CreatorBgDetailLike,
  CreatorSpellSummaryLike,
  CreatorFormLike,
} from "./CharacterCreatorProficiencyTypes";

export type {
  CreatorBackgroundFeatLike,
  CreatorLevelUpFeatDetailLike,
  CreatorClassDetailLike,
  CreatorRaceDetailLike,
  CreatorBgDetailLike,
  CreatorSpellSummaryLike,
  CreatorFormLike,
} from "./CharacterCreatorProficiencyTypes";

export {
  parseAppliedClassFeatureEffects,
  buildStartingInventory,
  getWeaponMasteryChoice,
} from "./CharacterCreatorClassFeatureUtils";

function splitComma(s: string): string[] {
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

function isProficiencyNoiseToken(value: string): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return true;
  if (/\bof your choice\b/i.test(normalized)) return true;
  if (/^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(normalized)) return true;
  return /^(?:this|that|these|those|extra|another|any|language|languages|tool|tools|skill|skills)$/i.test(normalized);
}

export function buildProficiencyMap(args: {
  form: CreatorFormLike;
  classDetail: CreatorClassDetailLike | null;
  raceDetail: CreatorRaceDetailLike | null;
  bgDetail: CreatorBgDetailLike | null;
  classCantrips: CreatorSpellSummaryLike[];
  classSpells: CreatorSpellSummaryLike[];
  classInvocations: CreatorSpellSummaryLike[];
  bgOriginFeatDetail: CreatorBackgroundFeatLike | null;
  raceFeatDetail: CreatorBackgroundFeatLike | null;
  classFeatDetails: Record<string, CreatorBackgroundFeatLike>;
  levelUpFeatDetails: CreatorLevelUpFeatDetailLike[];
  extraFeatDetails?: CreatorBackgroundFeatLike[];
  spellChoiceOptionsByKey?: Record<string, CreatorSpellSummaryLike[]>;
  itemChoiceOptionsByKey?: Record<string, Array<{ id: string; name: string }>>;
  /** The character's previously saved spell/invocation entries (editing an existing character
   * only) -- used to preserve each entry's acquisition level across saves instead of re-stamping
   * everything with the current build level. See tagAcquisitionLevel. */
  existingSpells?: Array<{ id?: string; level?: number | null }>;
  existingInvocations?: Array<{ id?: string; level?: number | null }>;
  /** Every class entry the character had before this save, including any beyond the primary one
   * this form exposes (see creatorSubmission.ts's `classes` comment). Together with
   * `existingProficiencies`, used to carry a multiclass character's *other* class's proficiencies
   * through untouched -- this function otherwise only ever computes grants for the single
   * `classDetail` passed in, so a second class's skills/tools/spells/etc. would silently vanish
   * on every save without this. */
  existingClasses?: Array<{ id?: string; classId?: string | null; className?: string | null }>;
  existingProficiencies?: Partial<ProficiencyMap>;
  primaryClassEntryId?: string;
}): ProficiencyMap {
  const {
    form,
    classDetail,
    raceDetail,
    bgDetail,
    classCantrips,
    classSpells,
    classInvocations,
    bgOriginFeatDetail,
    raceFeatDetail,
    classFeatDetails,
    levelUpFeatDetails,
    extraFeatDetails = [],
    spellChoiceOptionsByKey = {},
    itemChoiceOptionsByKey = {},
    existingSpells,
    existingInvocations,
    existingClasses = [],
    existingProficiencies,
    primaryClassEntryId,
  } = args;

  const className = classDetail?.name ?? "";
  const raceName = raceDetail?.name ?? "";
  const bgName = bgDetail?.name ?? "";

  const skills: TaggedItem[] = [];
  const expertise: TaggedItem[] = [];
  const saves: TaggedItem[] = [];
  const armor: TaggedItem[] = [];
  const weapons: TaggedItem[] = [];
  const tools: TaggedItem[] = [];
  const languages: TaggedItem[] = [];
  const spells: TaggedItem[] = [];
  const invocations: TaggedItem[] = [];
  const maneuvers: TaggedItem[] = [];
  const metamagic: TaggedItem[] = [];
  const infusions: TaggedItem[] = [];
  const plans: TaggedItem[] = [];

  const pushArmor = (name: string, source: string) => {
    splitArmorProficiencyNames(name).forEach((formatted) => {
      if (formatted) armor.push({ name: formatted, source });
    });
  };
  const pushWeapon = (name: string, source: string) => {
    splitWeaponProficiencyNames(name).forEach((formatted) => {
      if (formatted) weapons.push({ name: formatted, source });
    });
  };
  const pushTool = (name: string, source: string) => {
    const formatted = String(name ?? "").trim();
    if (!formatted) return;
    if (
      /\b(?:choose|choice|of your choice|any one type)\b/i.test(formatted)
      || /^(?:\d+|one|two|three|four|five|six)\s+musical instruments?$/i.test(formatted)
      || isProficiencyNoiseToken(formatted)
    ) return;
    tools.push({ name: formatted, source });
  };
  const pushLanguage = (name: string, source: string) => {
    const formatted = normalizeLanguageName(name);
    if (!formatted || isProficiencyNoiseToken(formatted)) return;
    languages.push({ name: formatted, source });
  };
  const pushExpertise = (name: string, source: string) => {
    const formatted = String(name ?? "").trim();
    if (!formatted || isProficiencyNoiseToken(formatted)) return;
    expertise.push({ name: formatted, source });
  };
  const cantripById = Object.fromEntries(classCantrips.map((spell) => [spell.id, spell]));
  const spellById = Object.fromEntries(classSpells.map((spell) => [spell.id, spell]));
  const invocationById = Object.fromEntries(classInvocations.map((spell) => [spell.id, spell]));
  if (classDetail) {
    splitComma(classDetail.armor).forEach((name) => pushArmor(name, className));
    splitComma(classDetail.weapons).forEach((name) => pushWeapon(name, className));
    const classToolProf = classDetail.proficiencies?.tools;
    if (classToolProf) {
      // Structured Grand tool data: fixed tools are auto-granted,
      // choices come from the user's selections, notes are display-only.
      classToolProf.fixed.forEach((name) => pushTool(name, className));
      form.chosenClassTools.forEach((name) => pushTool(name, className));
    }

    (classDetail.proficiencies?.savingThrows ?? splitComma(classDetail.proficiency)
      .filter((name) => ABILITY_SCORE_NAMES.has(name)))
      .forEach((name) => saves.push({ name, source: className }));

    form.chosenSkills.forEach((name) => skills.push({ name, source: className }));
    const classLanguageChoice = getClassLanguageChoice(classDetail as never, form.level, ALL_LANGUAGES, form.subclass);
    classLanguageChoice?.fixed.forEach((name) => pushLanguage(name, classLanguageChoice.source));
    form.chosenClassLanguages.forEach((name) => pushLanguage(name, classLanguageChoice?.source ?? className));
    const masteryChoice = getWeaponMasteryChoice(classDetail, form.level);
    if (masteryChoice) {
      form.chosenWeaponMasteries.forEach((name) => weapons.push({ name, source: masteryChoice.source }));
    }

    const parsedClassFeatures = parseAppliedClassFeatureEffects(classDetail, form.level, form.subclass ?? null, form.chosenOptionals);
    const classFeatureGrants = collectTaggedGrantsFromEffects(parsedClassFeatures);
    classFeatureGrants.armor.forEach((entry) => pushArmor(entry.name, entry.source));
    classFeatureGrants.weapons.forEach((entry) => weapons.push(entry));
    classFeatureGrants.tools.forEach((entry) => pushTool(entry.name, entry.source));
    classFeatureGrants.skills.forEach((entry) => skills.push(entry));
    classFeatureGrants.expertise.forEach((entry) => pushExpertise(entry.name, entry.source));
    classFeatureGrants.saves.forEach((entry) => saves.push(entry));
    classFeatureGrants.languages.forEach((entry) => pushLanguage(entry.name, entry.source));
    const classFeatureProficiencyChoices = collectProficiencyChoiceEffectsFromEffects(parsedClassFeatures);
    classFeatureProficiencyChoices.forEach((choice) => {
      const choiceKey = `classfeature:${choice.choiceId ?? choice.id}`;
      const selected = form.chosenFeatureChoices[choiceKey] ?? [];
      selected.forEach((value) => {
        if (choice.category === "skill") skills.push({ name: value, source: choice.source.name });
        if (choice.category === "tool") pushTool(value, choice.source.name);
        if (choice.category === "language") pushLanguage(value, choice.source.name);
        if (choice.category === "armor") pushArmor(value, choice.source.name);
        if (choice.category === "weapon") pushWeapon(value, choice.source.name);
        if (choice.category === "saving_throw") saves.push({ name: value, source: choice.source.name });
      });
    });
    const classFeatureSpellChoices = collectSpellChoicesFromEffects(parsedClassFeatures)
      // Replacement cantrips (Eldritch/Cantrip/Bardic/Sorcerous Versatility) aren't a bonus spell
      // grant — they're resolved by the player directly re-picking from the main cantrip list, so
      // they must not also be tagged in here or they'd double the character's known cantrips.
      .filter((choice) => !(choice.canReplace && choice.level === 0 && choice.mode === "learn"));
    classFeatureSpellChoices.forEach((choice) => {
      // Canonical key: `classfeature:<compendium choice id>` -- must match
      // useCharacterCreatorDerivedState.ts's step6ClassFeatureSpellChoices key exactly, since this
      // reads back whatever the picker there wrote to form.chosenFeatOptions.
      const key = `classfeature:${choice.choiceId ?? choice.id}`;
      const fallbackOptions =
        choice.level === 0 ? classCantrips
        : choice.level != null && choice.level > 0 ? classSpells.filter((spell) => Number(spell.level ?? 0) === choice.level)
        : classSpells;
      resolveSelectedSpellOptionEntries(form.chosenFeatOptions[key] ?? [], spellChoiceOptionsByKey[key] ?? fallbackOptions)
        .forEach((spell) => spells.push({ id: String(spell.id), name: spell.name, source: choice.source.name, level: choice.source.level }));
    });

    for (const [featureName, feat] of Object.entries(classFeatDetails)) {
      const grants = collectFeatTaggedEntries({
        feat,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `classfeat:${featureName}:${choice.id}`,
        resolveSelectedValue: (choice, key, value) => choice.type === "spell"
          ? resolveSelectedSpellOptionEntries([value], spellChoiceOptionsByKey[key] ?? [])[0]?.name ?? value
          : value,
      });
      grants.skills.forEach((entry) => skills.push(entry));
      grants.tools.forEach((entry) => pushTool(entry.name, entry.source));
      grants.languages.forEach((entry) => pushLanguage(entry.name, entry.source));
      grants.armor.forEach((entry) => pushArmor(entry.name, entry.source));
      grants.weapons.forEach((entry) => pushWeapon(entry.name, entry.source));
      grants.saves.forEach((entry) => saves.push(entry));
      grants.expertise.forEach((entry) => pushExpertise(entry.name, entry.source));
      grants.maneuvers.forEach((entry) => maneuvers.push(entry));
      resolveFeatSpellEntries({
        feat,
        sourceLabel: feat.name,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `classfeat:${featureName}:${choice.id}`,
        spellChoiceOptionsByKey,
      }).forEach((entry) => spells.push(entry));
    }
  }

  // Everything collected before race/background processing is owned by the class currently
  // displayed in this single-class editor. Persist that stable owner so a later multiclass edit
  // can preserve it without guessing from mutable display labels such as "Expertise".
  if (primaryClassEntryId) {
    for (const list of [skills, expertise, saves, armor, weapons, tools, languages, spells, invocations, maneuvers, metamagic, infusions, plans]) {
      for (const entry of list) {
        entry.classEntryId ??= primaryClassEntryId;
        entry.sourceKey ??= `class:${primaryClassEntryId}`;
      }
    }
  }

  if (bgDetail) {
    // Background proficiencies are read exclusively from the compendium's structured
    // `proficiencies` facts — never re-parsed from trait names/prose at runtime.
    // (backgroundGrandToPlayerView always populates the structured object for canonical data.)
    const prof = bgDetail.proficiencies;
    prof?.skills.fixed.forEach((name) => skills.push({ name, source: bgName }));
    form.chosenBgSkills.forEach((name) => skills.push({ name, source: bgName }));
    if (prof) {
      prof.tools.fixed.forEach((name) => pushTool(name, bgName));
      form.chosenBgTools.forEach((name) => pushTool(name, bgName));
      prof.languages.fixed.forEach((name) => pushLanguage(name, bgName));
      form.chosenBgLanguages.forEach((name) => pushLanguage(name, bgName));
    }

    for (const feat of prof?.feats ?? []) {
      const grants = collectFeatTaggedEntries({
        feat,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `bg:${feat.name}:${choice.id}`,
        resolveSelectedValue: (choice, key, value) => choice.type === "spell"
          ? resolveSelectedSpellOptionEntries([value], spellChoiceOptionsByKey[key] ?? [])[0]?.name ?? value
          : value,
      });
      grants.skills.forEach((entry) => skills.push(entry));
      grants.tools.forEach((entry) => pushTool(entry.name, entry.source));
      grants.languages.forEach((entry) => pushLanguage(entry.name, entry.source));
      grants.armor.forEach((entry) => pushArmor(entry.name, entry.source));
      grants.weapons.forEach((entry) => pushWeapon(entry.name, entry.source));
      grants.saves.forEach((entry) => saves.push(entry));
      grants.expertise.forEach((entry) => pushExpertise(entry.name, entry.source));
      grants.maneuvers.forEach((entry) => maneuvers.push(entry));
      resolveFeatSpellEntries({
        feat,
        sourceLabel: feat.name,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `bg:${feat.name}:${choice.id}`,
        spellChoiceOptionsByKey,
      }).forEach((entry) => spells.push(entry));
    }

    if (bgOriginFeatDetail) {
      const grants = collectFeatTaggedEntries({
        feat: bgOriginFeatDetail,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `bg:${bgOriginFeatDetail.name}:${choice.id}`,
        resolveSelectedValue: (choice, key, value) => choice.type === "spell"
          ? resolveSelectedSpellOptionEntries([value], spellChoiceOptionsByKey[key] ?? [])[0]?.name ?? value
          : value,
      });
      grants.skills.forEach((entry) => skills.push(entry));
      grants.tools.forEach((entry) => pushTool(entry.name, entry.source));
      grants.languages.forEach((entry) => pushLanguage(entry.name, entry.source));
      grants.armor.forEach((entry) => pushArmor(entry.name, entry.source));
      grants.weapons.forEach((entry) => pushWeapon(entry.name, entry.source));
      grants.saves.forEach((entry) => saves.push(entry));
      grants.expertise.forEach((entry) => pushExpertise(entry.name, entry.source));
      grants.maneuvers.forEach((entry) => maneuvers.push(entry));
      resolveFeatSpellEntries({
        feat: bgOriginFeatDetail,
        sourceLabel: bgOriginFeatDetail.name,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `bg:${bgOriginFeatDetail.name}:${choice.id}`,
        spellChoiceOptionsByKey,
      }).forEach((entry) => spells.push(entry));
    }
  }

  const coreLanguageChoice = getCoreLanguageChoice(raceDetail?.parsedChoices ?? null, STANDARD_55E_LANGUAGES);
  if (raceDetail) {
    form.chosenRaceSkills.forEach((name) => skills.push({ name, source: raceName }));
    if (!coreLanguageChoice) form.chosenRaceLanguages.forEach((name) => pushLanguage(name, raceName));
    form.chosenRaceTools.forEach((name) => pushTool(name, raceName));

    const parsedRaceTraits = parseAppliedSpeciesTraitEffects(raceDetail, form.chosenFeatureChoices);
    const raceTraitGrants = collectTaggedGrantsFromEffects(parsedRaceTraits);
    raceTraitGrants.armor.forEach((entry) => pushArmor(entry.name, entry.source));
    raceTraitGrants.weapons.forEach((entry) => pushWeapon(entry.name, entry.source));
    raceTraitGrants.tools.forEach((entry) => pushTool(entry.name, entry.source));
    raceTraitGrants.skills.forEach((entry) => skills.push(entry));
    raceTraitGrants.expertise.forEach((entry) => pushExpertise(entry.name, entry.source));
    raceTraitGrants.saves.forEach((entry) => saves.push(entry));
    raceTraitGrants.languages.forEach((entry) => pushLanguage(entry.name, entry.source));

    const raceTraitSpellChoices = collectSpellChoicesFromEffects(parsedRaceTraits);
    raceTraitSpellChoices.forEach((choice) => {
      const key = `racetrait:${choice.id}`;
      resolveSelectedSpellOptionEntries(form.chosenFeatOptions[key] ?? [], spellChoiceOptionsByKey[key] ?? [])
        .forEach((spell) => spells.push({ id: String(spell.id), name: spell.name, source: choice.source.name }));
    });

    if (raceFeatDetail) {
      const grants = collectFeatTaggedEntries({
        feat: raceFeatDetail,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `race:${raceFeatDetail.name}:${choice.id}`,
        resolveSelectedValue: (choice, key, value) => choice.type === "spell"
          ? resolveSelectedSpellOptionEntries([value], spellChoiceOptionsByKey[key] ?? [])[0]?.name ?? value
          : value,
      });
      grants.skills.forEach((entry) => skills.push(entry));
      grants.tools.forEach((entry) => pushTool(entry.name, entry.source));
      grants.languages.forEach((entry) => pushLanguage(entry.name, entry.source));
      grants.armor.forEach((entry) => pushArmor(entry.name, entry.source));
      grants.weapons.forEach((entry) => pushWeapon(entry.name, entry.source));
      grants.saves.forEach((entry) => saves.push(entry));
      grants.expertise.forEach((entry) => pushExpertise(entry.name, entry.source));
      grants.maneuvers.forEach((entry) => maneuvers.push(entry));
      resolveFeatSpellEntries({
        feat: raceFeatDetail,
        sourceLabel: raceFeatDetail.name,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `race:${raceFeatDetail.name}:${choice.id}`,
        spellChoiceOptionsByKey,
      }).forEach((entry) => spells.push(entry));
    }
  }

  const classExpertiseChoices = getClassExpertiseChoices(classDetail as never, form.level, form.subclass).filter((choice) => !choice.replace);
  for (const choice of classExpertiseChoices) {
    const selected = form.chosenFeatOptions[choice.key] ?? [];
    selected.forEach((name) => pushExpertise(name, choice.source));
  }

  for (const { level, featId, feat } of levelUpFeatDetails) {
    const grants = collectFeatTaggedEntries({
      feat,
      selectedChoices: form.chosenFeatOptions,
      getChoiceKey: (choice) => `levelupfeat:${level}:${featId}:${choice.id}`,
      resolveSelectedValue: (choice, key, value) => choice.type === "spell"
        ? resolveSelectedSpellOptionEntries([value], spellChoiceOptionsByKey[key] ?? [])[0]?.name ?? value
        : value,
    });
    grants.skills.forEach((entry) => skills.push(entry));
    grants.tools.forEach((entry) => pushTool(entry.name, entry.source));
    grants.languages.forEach((entry) => pushLanguage(entry.name, entry.source));
    grants.armor.forEach((entry) => pushArmor(entry.name, entry.source));
    grants.weapons.forEach((entry) => pushWeapon(entry.name, entry.source));
    grants.saves.forEach((entry) => saves.push(entry));
    grants.expertise.forEach((entry) => pushExpertise(entry.name, entry.source));
    grants.maneuvers.forEach((entry) => maneuvers.push(entry));
    resolveFeatSpellEntries({
      feat,
      sourceLabel: feat.name,
      selectedChoices: form.chosenFeatOptions,
      getChoiceKey: (choice) => `levelupfeat:${level}:${featId}:${choice.id}`,
      spellChoiceOptionsByKey,
    }).forEach((entry) => spells.push(entry));
  }

  for (const feat of extraFeatDetails) {
    const grants = collectFeatTaggedEntries({
      feat,
      selectedChoices: form.chosenFeatOptions,
      getChoiceKey: (choice) => `extra:${feat.id}:${choice.id}`,
    });
    grants.skills.forEach((entry) => skills.push(entry));
    grants.tools.forEach((entry) => pushTool(entry.name, entry.source));
    grants.languages.forEach((entry) => pushLanguage(entry.name, entry.source));
    grants.armor.forEach((entry) => pushArmor(entry.name, entry.source));
    grants.weapons.forEach((entry) => pushWeapon(entry.name, entry.source));
    grants.saves.forEach((entry) => saves.push(entry));
    grants.expertise.forEach((entry) => pushExpertise(entry.name, entry.source));
    grants.maneuvers.forEach((entry) => maneuvers.push(entry));
    resolveFeatSpellEntries({
      feat,
      sourceLabel: feat.name,
      selectedChoices: form.chosenFeatOptions,
      getChoiceKey: (choice) => `extra:${feat.id}:${choice.id}`,
      spellChoiceOptionsByKey,
    }).forEach((entry) => spells.push(entry));
  }

  if (coreLanguageChoice) {
    coreLanguageChoice.fixed.forEach((name) => pushLanguage(name, coreLanguageChoice.source));
    form.chosenRaceLanguages.forEach((name) => pushLanguage(name, coreLanguageChoice.source));
  }

  const chosenInvocationEffects = form.chosenInvocations
    .map((id) => invocationById[id])
    .filter((spell): spell is CreatorSpellSummaryLike => Boolean(spell))
    .map((spell) => parseFeatureEffects({
      source: {
        id: `creator-invocation:${spell.id}`,
        kind: "invocation",
        name: spell.name,
        text: spell.text ?? "",
      },
      text: spell.text ?? "",
      classEffects: spell.effects,
    }));
  const invocationSpellChoices = collectSpellChoicesFromEffects(chosenInvocationEffects);
  invocationSpellChoices.forEach((choice) => {
    if (choice.mode === "select") return;
    const key = `invocation:${choice.choiceId ?? choice.id}`;
    resolveSelectedSpellOptionEntries(form.chosenFeatOptions[key] ?? [], spellChoiceOptionsByKey[key] ?? classInvocations)
      .forEach((spell) => spells.push({ id: String(spell.id), name: spell.name, source: choice.source.name }));
  });

  form.chosenCantrips.forEach((id) => {
    const spell = cantripById[id];
    if (spell) spells.push({ id: spell.id, name: spell.name, source: className });
  });
  form.chosenSpells.forEach((id) => {
    const spell = spellById[id];
    if (spell) spells.push({ id: spell.id, name: spell.name, source: className });
  });
  form.chosenInvocations.forEach((id) => {
    const spell = invocationById[id];
    if (spell) invocations.push({ id: spell.id, name: spell.name, source: className });
  });

  const growthChoiceDefinitions = getGrowthChoiceDefinitions({
    classId: String((classDetail as { id?: string } | null)?.id ?? ""),
    className,
    classDetail,
    level: form.level,
    selectedSubclass: form.subclass ?? null,
  });
  growthChoiceDefinitions.forEach((definition) => {
    const selectedIds = getGrowthChoiceSelectedIds(form.chosenFeatureChoices, definition);
    if (definition.category === "maneuver" || definition.category === "metamagic" || definition.category === "infusion") {
      const selectedAbility = getGrowthChoiceSelectedAbility(form.chosenFeatureChoices, definition);
      const target = definition.category === "maneuver" ? maneuvers : definition.category === "metamagic" ? metamagic : infusions;
      resolveSelectedSpellOptionEntries(selectedIds, spellChoiceOptionsByKey[definition.key] ?? [])
        .forEach((spell) => target.push({
          id: String(spell.id),
          name: spell.name,
          source: definition.sourceLabel,
          ability: selectedAbility,
          sourceKey: definition.sourceKey,
        }));
      return;
    }
    if (definition.category === "plan") {
      const byId = new Map((itemChoiceOptionsByKey[definition.key] ?? []).map((item) => [String(item.id), item]));
      selectedIds
        .map((id) => byId.get(String(id)))
        .filter((item): item is { id: string; name: string } => Boolean(item))
        .forEach((item) => plans.push({
          id: String(item.id),
          name: item.name,
          source: definition.sourceLabel,
          sourceKey: definition.sourceKey,
        }));
    }
  });

  // Carry a multiclass character's *other* class's proficiencies through untouched. Everything
  // above this point was computed from `classDetail` alone (the one class this form edits), so a
  // second/third class's skills, tools, spells, etc. have no way to be regenerated here -- without
  // this they'd be silently dropped from every category on every save. Matching by `source` (every
  // TaggedItem already carries one) rather than re-deriving the other class's grants means this
  // works without needing that class's own compendium data loaded.
  if (existingProficiencies) {
    const otherClassNames = new Set(
      existingClasses.slice(1).map((entry) => entry.className).filter((name): name is string => Boolean(name)),
    );
    const otherClassEntryIds = new Set(
      existingClasses.slice(1).map((entry) => entry.id).filter((id): id is string => Boolean(id)),
    );
    if (otherClassNames.size > 0 || otherClassEntryIds.size > 0) {
      const preserveOtherClass = (list?: TaggedItem[]) =>
        (list ?? []).filter((entry) =>
          Boolean(entry.classEntryId && otherClassEntryIds.has(entry.classEntryId))
          || Boolean(entry.sourceKey?.startsWith("class:") && otherClassEntryIds.has(entry.sourceKey.slice(6)))
          || otherClassNames.has(entry.source),
        );
      skills.push(...preserveOtherClass(existingProficiencies.skills));
      expertise.push(...preserveOtherClass(existingProficiencies.expertise));
      saves.push(...preserveOtherClass(existingProficiencies.saves));
      armor.push(...preserveOtherClass(existingProficiencies.armor));
      weapons.push(...preserveOtherClass(existingProficiencies.weapons));
      tools.push(...preserveOtherClass(existingProficiencies.tools));
      languages.push(...preserveOtherClass(existingProficiencies.languages));
      spells.push(...preserveOtherClass(existingProficiencies.spells));
      invocations.push(...preserveOtherClass(existingProficiencies.invocations));
      maneuvers.push(...preserveOtherClass(existingProficiencies.maneuvers));
      metamagic.push(...preserveOtherClass(existingProficiencies.metamagic));
      infusions.push(...preserveOtherClass(existingProficiencies.infusions));
      plans.push(...preserveOtherClass(existingProficiencies.plans));
    }
  }

  // Preserve each spell/invocation's original acquisition level across saves (editing an existing
  // character) instead of re-stamping every entry with the current build level -- see
  // tagAcquisitionLevel. For a brand-new character there's nothing to preserve, so everything
  // falls back to form.level (or the feature's own precise unlock level, where already set above).
  const existingSpellsById = buildAcquisitionLevelIndex(existingSpells);
  const existingInvocationsById = buildAcquisitionLevelIndex(existingInvocations);
  const taggedSpells = tagAcquisitionLevel(spells, existingSpellsById, form.level);
  const taggedInvocations = tagAcquisitionLevel(invocations, existingInvocationsById, form.level);

  return {
    skills: dedupeTaggedItems(skills).filter((entry) => !isProficiencyNoiseToken(entry.name)),
    expertise: dedupeTaggedItems(expertise).filter((entry) => !isProficiencyNoiseToken(entry.name)),
    saves: dedupeTaggedItems(saves),
    armor: dedupeTaggedItems(armor, normalizeArmorProficiencyName),
    tools: dedupeTaggedItems(tools).filter((entry) => !isProficiencyNoiseToken(entry.name)),
    languages: dedupeTaggedItems(languages, normalizeLanguageName).filter((entry) => !isProficiencyNoiseToken(entry.name)),
    weapons: dedupeTaggedItems(weapons, normalizeWeaponProficiencyName),
    weaponMasteries: Array.from(new Set(form.chosenWeaponMasteries.map((name) => normalizeWeaponProficiencyName(name)))),
    spells: dedupeTaggedItems(taggedSpells, normalizeSpellTrackingName),
    invocations: dedupeTaggedItems(taggedInvocations),
    maneuvers: dedupeTaggedItems(maneuvers),
    metamagic: dedupeTaggedItems(metamagic),
    infusions: dedupeTaggedItems(infusions),
    plans: dedupeTaggedItems(plans),
  };
}
