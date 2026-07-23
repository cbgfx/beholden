import { collectFeatTaggedEntries } from "./FeatGrantUtils";
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
  CreatorItemSummaryLike,
  CreatorInventoryItemSeed,
  CreatorBackgroundFeatLike,
  CreatorLevelUpFeatDetailLike,
  CreatorClassDetailLike,
  CreatorRaceDetailLike,
  CreatorBgDetailLike,
  CreatorSpellSummaryLike,
  CreatorFormLike,
  CreatorWeaponMasteryChoice,
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
    const classLanguageChoice = getClassLanguageChoice(classDetail as never, form.level, ALL_LANGUAGES);
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
      const choiceKey = `classfeature:${choice.id}`;
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
    const classFeatureSpellChoices = collectSpellChoicesFromEffects(parsedClassFeatures);
    classFeatureSpellChoices.forEach((choice) => {
      const key = `classfeature:${choice.id}`;
      const fallbackOptions =
        choice.level === 0 ? classCantrips
        : choice.level != null && choice.level > 0 ? classSpells.filter((spell) => Number(spell.level ?? 0) === choice.level)
        : classSpells;
      resolveSelectedSpellOptionEntries(form.chosenFeatOptions[key] ?? [], spellChoiceOptionsByKey[key] ?? fallbackOptions)
        .forEach((spell) => spells.push({ id: String(spell.id), name: spell.name, source: choice.source.name }));
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

    const raceTraitSpellChoices = collectSpellChoicesFromEffects(parseAppliedSpeciesTraitEffects(raceDetail));
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

  const classExpertiseChoices = getClassExpertiseChoices(classDetail as never, form.level).filter((choice) => !choice.replace);
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
    if (definition.category === "maneuver" || definition.category === "metamagic") {
      const selectedAbility = getGrowthChoiceSelectedAbility(form.chosenFeatureChoices, definition);
      const target = definition.category === "maneuver" ? maneuvers : metamagic;
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

  return {
    skills: dedupeTaggedItems(skills).filter((entry) => !isProficiencyNoiseToken(entry.name)),
    expertise: dedupeTaggedItems(expertise).filter((entry) => !isProficiencyNoiseToken(entry.name)),
    saves: dedupeTaggedItems(saves),
    armor: dedupeTaggedItems(armor, normalizeArmorProficiencyName),
    tools: dedupeTaggedItems(tools).filter((entry) => !isProficiencyNoiseToken(entry.name)),
    languages: dedupeTaggedItems(languages, normalizeLanguageName).filter((entry) => !isProficiencyNoiseToken(entry.name)),
    weapons: dedupeTaggedItems(weapons, normalizeWeaponProficiencyName),
    spells: dedupeTaggedItems(spells, normalizeSpellTrackingName),
    invocations: dedupeTaggedItems(invocations),
    maneuvers: dedupeTaggedItems(maneuvers),
    metamagic: dedupeTaggedItems(metamagic),
    plans: dedupeTaggedItems(plans),
  };
}
