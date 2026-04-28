import {
  buildEquipmentItems as buildEquipmentItemsFromUtils,
  getBackgroundGrantedToolSelections as getBackgroundGrantedToolSelectionsFromUtils,
} from "./CharacterCreatorEquipmentUtils";
import { collectFeatTaggedEntries } from "./FeatGrantUtils";
import {
  ABILITY_SCORE_NAMES,
  ALL_LANGUAGES,
  STANDARD_55E_LANGUAGES,
} from "../constants/CharacterCreatorConstants";
import {
  classifyFeatSelection,
  extractClassStartingEquipment,
  featureMatchesSubclass,
  getFeatureSubclassName,
  getClassExpertiseChoices,
  isSubclassChoiceFeature,
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
  type ParseFeatureEffectsInput,
} from "@/domain/character/parseFeatureEffects";
import { resolveSelectedSpellOptionEntries } from "./SpellChoiceUtils";
import { resolveFeatSpellEntries } from "./FeatSpellcastingUtils";
import {
  getGrowthChoiceDefinitions,
  getGrowthChoiceSelectedAbility,
  getGrowthChoiceSelectedIds,
} from "./GrowthChoiceUtils";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import type { ProficiencyMap, TaggedItem } from "@/views/character/CharacterSheetTypes";
import type { ParsedFeatChoiceLike as CreatorParsedFeatChoiceLike, ParsedFeatDetailLike } from "./FeatChoiceTypes";

export interface CreatorItemSummaryLike {
  id: string;
  name: string;
  type: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
}

export interface CreatorInventoryItemSeed {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  equipState?: "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand";
  notes?: string;
  source?: "compendium" | "custom";
  itemId?: string;
  type?: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
}

export type CreatorBackgroundFeatLike = ParsedFeatDetailLike<CreatorParsedFeatChoiceLike>;

export interface CreatorLevelUpFeatDetailLike {
  level: number;
  featId: string;
  feat: CreatorBackgroundFeatLike;
}

export interface CreatorClassDetailLike {
  name: string;
  armor: string;
  weapons: string;
  tools?: string;
  proficiency: string;
  autolevels: Array<{
    level: number | null;
    features: Array<{ name: string; text: string; optional: boolean }>;
  }>;
}

export interface CreatorRaceDetailLike {
  name: string;
  traits: Array<{ name: string; text: string; modifier: string[] }>;
}

export interface CreatorBgDetailLike {
  name: string;
  proficiency: string;
  equipment?: string;
  proficiencies?: {
    skills: { fixed: string[] };
    tools: { fixed: string[] };
    languages: { fixed: string[] };
    feats: CreatorBackgroundFeatLike[];
  };
  traits: Array<{ name: string; text: string }>;
}

export interface CreatorSpellSummaryLike {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
}

export interface CreatorFormLike {
  level: number;
  subclass?: string | null;
  chosenSkills: string[];
  chosenClassLanguages: string[];
  chosenWeaponMasteries: string[];
  chosenOptionals: string[];
  chosenFeatOptions: Record<string, string[]>;
  chosenFeatureChoices: Record<string, string[]>;
  chosenBgSkills: string[];
  chosenBgTools: string[];
  chosenBgLanguages: string[];
  chosenRaceSkills: string[];
  chosenRaceLanguages: string[];
  chosenRaceTools: string[];
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenInvocations: string[];
  chosenBgEquipmentOption: string | null;
  chosenClassEquipmentOption: string | null;
}

export interface CreatorWeaponMasteryChoice {
  source: string;
  count: number;
}

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

export function parseSelectedClassOptionalFeatureEffects(
  classDetail: CreatorClassDetailLike | null,
  level: number,
  chosenOptionals: string[],
): ParsedFeatureEffects[] {
  if (!classDetail || chosenOptionals.length === 0) return [];
  const selected = new Set(chosenOptionals);
  const parsed: ParsedFeatureEffects[] = [];
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level == null || autolevel.level > level) continue;
    for (const feature of autolevel.features) {
      if (!feature.optional || !selected.has(feature.name) || !String(feature.text ?? "").trim()) continue;
      parsed.push(parseFeatureEffects({
        source: {
          id: `creator-class-optional:${autolevel.level}:${feature.name}`,
          kind: "class",
          name: feature.name,
          level: autolevel.level,
          parentName: classDetail.name,
          text: feature.text,
        },
        text: feature.text,
      } satisfies ParseFeatureEffectsInput));
    }
  }
  return parsed;
}

export function parseAppliedClassFeatureEffects(
  classDetail: CreatorClassDetailLike | null,
  level: number,
  selectedSubclass: string | null | undefined,
  chosenOptionals: string[],
): ParsedFeatureEffects[] {
  if (!classDetail) return [];
  const selected = new Set(chosenOptionals);
  const parsed: ParsedFeatureEffects[] = [];
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level == null || autolevel.level > level) continue;
    for (const feature of autolevel.features) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      const isSubclassFeature = Boolean(getFeatureSubclassName(feature));
      if (feature.optional && !isSubclassFeature && !selected.has(feature.name)) continue;
      if (!String(feature.text ?? "").trim()) continue;
      parsed.push(parseFeatureEffects({
        source: {
          id: `creator-class-feature:${autolevel.level}:${feature.name}`,
          kind: isSubclassFeature ? "subclass" : "class",
          name: feature.name,
          level: autolevel.level,
          parentName: classDetail.name,
          text: feature.text,
        },
        text: feature.text,
      } satisfies ParseFeatureEffectsInput));
    }
  }
  return parsed;
}

export function buildStartingInventory(
  form: CreatorFormLike,
  bgDetail: CreatorBgDetailLike | null,
  classDetail: CreatorClassDetailLike | null,
  itemIndex: CreatorItemSummaryLike[],
): CreatorInventoryItemSeed[] {
  const bgItems = buildEquipmentItemsFromUtils(
    form.chosenBgEquipmentOption,
    bgDetail?.equipment,
    "bg",
    getBackgroundGrantedToolSelectionsFromUtils(form as never, bgDetail as never, [], classifyFeatSelection),
    itemIndex as never,
  );
  const classItems = buildEquipmentItemsFromUtils(
    form.chosenClassEquipmentOption,
    extractClassStartingEquipment(classDetail as never),
    "class",
    [],
    itemIndex as never,
  );
  return [...classItems, ...bgItems];
}

export function getWeaponMasteryChoice(
  classDetail: CreatorClassDetailLike | null,
  level: number,
): CreatorWeaponMasteryChoice | null {
  if (!classDetail) return null;
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level == null || autolevel.level > level) continue;
    for (const feature of autolevel.features) {
      const parsed = parseFeatureEffects({
        source: {
          id: `creator-class-feature:${autolevel.level}:${feature.name}`,
          kind: "class",
          name: feature.name,
          text: feature.text,
        },
        text: feature.text,
      });
      const masteryEffect = parsed.effects.find((effect) => effect.type === "weapon_mastery");
      if (masteryEffect?.type !== "weapon_mastery") continue;
      const count = masteryEffect.choice?.count?.kind === "fixed" ? masteryEffect.choice.count.value : null;
      if (count && count > 0) return { source: feature.name, count };
    }
  }
  return null;
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
    splitComma(classDetail.tools ?? "").forEach((name) => pushTool(name, className));

    splitComma(classDetail.proficiency)
      .filter((name) => ABILITY_SCORE_NAMES.has(name))
      .forEach((name) => saves.push({ name, source: className }));

    if (saves.length === 0) {
      outer: for (const autolevel of classDetail.autolevels) {
        for (const feature of autolevel.features) {
          if (feature.optional) continue;
          const match = feature.text.match(/Saving Throw Proficiencies?:\s*([^\n.]+)/i);
          if (match) {
            match[1].split(/,|\s+and\s+/i).map((s) => s.trim()).filter(Boolean)
              .forEach((name) => saves.push({ name, source: className }));
            break outer;
          }
        }
      }
    }

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
    classFeatureGrants.weapons.forEach((entry) => pushWeapon(entry.name, entry.source));
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
    const prof = bgDetail.proficiencies;
    const bgSkills = prof ? prof.skills.fixed : splitComma(bgDetail.proficiency);
    bgSkills.forEach((name) => skills.push({ name, source: bgName }));
    form.chosenBgSkills.forEach((name) => skills.push({ name, source: bgName }));
    if (prof) {
      prof.tools.fixed.forEach((name) => pushTool(name, bgName));
      form.chosenBgTools.forEach((name) => pushTool(name, bgName));
      prof.languages.fixed.forEach((name) => pushLanguage(name, bgName));
      form.chosenBgLanguages.forEach((name) => pushLanguage(name, bgName));
    } else {
      for (const trait of bgDetail.traits) {
        if (/tool/i.test(trait.name)) splitComma(trait.text).forEach((name) => pushTool(name, bgName));
        else if (/language/i.test(trait.name)) splitComma(trait.text).forEach((name) => pushLanguage(name, bgName));
      }
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
      resolveFeatSpellEntries({
        feat: bgOriginFeatDetail,
        sourceLabel: bgOriginFeatDetail.name,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `bg:${bgOriginFeatDetail.name}:${choice.id}`,
        spellChoiceOptionsByKey,
      }).forEach((entry) => spells.push(entry));
    }
  }

  const coreLanguageChoice = getCoreLanguageChoice(raceDetail as never, STANDARD_55E_LANGUAGES);
  if (raceDetail) {
    for (const trait of raceDetail.traits) {
      for (const mod of trait.modifier) {
        const match = mod.match(/^(language|tool|skill)[:\s]+(.+)/i);
        if (!match) continue;
        const value = match[2].trim();
        if (/language/i.test(match[1])) pushLanguage(value, raceName);
        else if (/tool/i.test(match[1])) pushTool(value, raceName);
        else if (/skill/i.test(match[1])) skills.push({ name: value, source: raceName });
      }
      if (/^languages?$/i.test(trait.name) && trait.modifier.length === 0) {
        splitComma(trait.text).forEach((name) => {
          if (name && !/choose/i.test(name)) pushLanguage(name, raceName);
        });
      }
    }
    form.chosenRaceSkills.forEach((name) => skills.push({ name, source: raceName }));
    if (!coreLanguageChoice) form.chosenRaceLanguages.forEach((name) => pushLanguage(name, raceName));
    form.chosenRaceTools.forEach((name) => pushTool(name, raceName));

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
      resolveFeatSpellEntries({
        feat: raceFeatDetail,
        sourceLabel: raceFeatDetail.name,
        selectedChoices: form.chosenFeatOptions,
        getChoiceKey: (choice) => `race:${raceFeatDetail.name}:${choice.id}`,
        spellChoiceOptionsByKey,
      }).forEach((entry) => spells.push(entry));
    }
  }

  const classExpertiseChoices = getClassExpertiseChoices(classDetail as never, form.level);
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
    resolveFeatSpellEntries({
      feat,
      sourceLabel: feat.name,
      selectedChoices: form.chosenFeatOptions,
      getChoiceKey: (choice) => `levelupfeat:${level}:${featId}:${choice.id}`,
      spellChoiceOptionsByKey,
    }).forEach((entry) => spells.push(entry));
  }

  if (coreLanguageChoice) {
    coreLanguageChoice.fixed.forEach((name) => pushLanguage(name, coreLanguageChoice.source));
    form.chosenRaceLanguages.forEach((name) => pushLanguage(name, coreLanguageChoice.source));
  }

  const chosenInvocationEffects = form.chosenInvocations
    .map((id) => invocationById[id])
    .filter((spell): spell is CreatorSpellSummaryLike => Boolean(spell && String(spell.text ?? "").trim()))
    .map((spell) => parseFeatureEffects({
      source: {
        id: `creator-invocation:${spell.id}`,
        kind: "invocation",
        name: spell.name,
        text: spell.text ?? "",
      },
      text: spell.text ?? "",
    }));
  const invocationSpellChoices = collectSpellChoicesFromEffects(chosenInvocationEffects);
  invocationSpellChoices.forEach((choice) => {
    const key = `invocation:${choice.id}`;
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
    if (definition.category === "maneuver") {
      const selectedAbility = getGrowthChoiceSelectedAbility(form.chosenFeatureChoices, definition);
      resolveSelectedSpellOptionEntries(selectedIds, spellChoiceOptionsByKey[definition.key] ?? [])
        .forEach((spell) => maneuvers.push({
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
    plans: dedupeTaggedItems(plans),
  };
}
