import { C } from "@/lib/theme";
import { matchesRuleset, type Ruleset } from "@/lib/characterRules";
import {
  ABILITY_KEYS,
  ABILITY_NAME_TO_KEY,
  STANDARD_ARRAY,
  POINT_BUY_COSTS,
} from "@/views/character-creator/constants/CharacterCreatorConstants";
import {
  abilityNamesToKeys,
  getFeatureSubclassName,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import type { ClassDetail, ClassFeatChoice } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type {
  ParsedFeatChoiceLike as ParsedFeatChoice,
} from "@/views/character-creator/utils/FeatChoiceTypes";

export type AbilityMethod = "standard" | "pointbuy" | "manual";
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface FormState {
  ruleset?: Ruleset | null;
  classId: string;
  raceId: string;
  bgId: string;
  level: number;
  subclass: string;
  chosenOptionals: string[];
  chosenClassFeatIds: Record<string, string>;
  chosenLevelUpFeats: any[];
  chosenRaceSkills: string[];
  chosenRaceLanguages: string[];
  chosenRaceTools: string[];
  chosenRaceFeatId: string | null;
  chosenRaceSize: string | null;
  chosenBgSkills: string[];
  chosenBgOriginFeatId: string | null;
  chosenBgTools: string[];
  chosenBgLanguages: string[];
  chosenClassEquipmentOption: string | null;
  chosenBgEquipmentOption: string | null;
  chosenFeatOptions: Record<string, string[]>;
  chosenFeatureChoices: Record<string, string[]>;
  bgAbilityMode: "split" | "even";
  bgAbilityBonuses: Record<string, number>;
  chosenSkills: string[];
  chosenClassLanguages: string[];
  chosenWeaponMasteries: string[];
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenInvocations: string[];
  abilityMethod: AbilityMethod;
  standardAssign: Record<string, number>;
  pbScores: Record<string, number>;
  manualScores: Record<string, number>;
  hpMax: string;
  ac: string;
  speed: string;
  characterName: string;
  playerName: string;
  alignment: string;
  hair: string;
  skin: string;
  heightText: string;
  age: string;
  weight: string;
  gender: string;
  color: string;
  campaignIds: string[];
}

const DEFAULT_SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

export function matchesClassFeatGroup(featName: string, featGroup: string): boolean {
  const normalizedGroup = featGroup.trim().toLowerCase();
  if (normalizedGroup === "fighting style") return /^fighting style:/i.test(featName);
  if (normalizedGroup === "origin") return /^origin:/i.test(featName);
  if (normalizedGroup === "epic boon" || normalizedGroup === "boon") return /^boon of\b/i.test(featName);
  const escaped = featGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}:`, "i").test(featName) || new RegExp(`\\b${escaped}\\b`, "i").test(featName);
}

export function getClassFeatChoices(
  classDetail: ClassDetail | null,
  level: number,
  featSummaries: Array<{ id: string; name: string; ruleset?: Ruleset | null }>,
  ruleset: Ruleset | null,
): ClassFeatChoice[] {
  if (!classDetail) return [];
  const choices: ClassFeatChoice[] = [];
  const seen = new Set<string>();
  for (const al of classDetail.autolevels) {
    if (al.level == null || al.level > level) continue;
    for (const f of al.features) {
      const match = f.text.match(/gain\s+an?\s+(.+?)\s+feat\s+of\s+your\s+choice/i);
      const featGroup = match?.[1]?.trim();
      if (!featGroup) continue;
      const key = `${al.level}:${f.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const options = featSummaries
        .filter((feat) => matchesRuleset(feat, ruleset))
        .filter((feat) => matchesClassFeatGroup(feat.name, featGroup))
        .map((feat) => ({ id: feat.id, name: feat.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      choices.push({ featureName: f.name, featGroup, options });
    }
  }
  return choices;
}

export function getClassFeatChoiceLabel(featGroup: string): string {
  if (/^fighting style$/i.test(featGroup)) return "Fighting Style";
  return `${featGroup} Choice`;
}

export function getClassFeatOptionLabel(optionName: string, featGroup: string): string {
  let label = optionName.replace(/\s*\[(?:5\.5e|2024)\]\s*$/i, "").trim();
  if (new RegExp(`^${featGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i").test(label)) {
    label = label.replace(new RegExp(`^${featGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i"), "").trim();
  }
  return label;
}

export function isToughFeat(name: string | null | undefined): boolean {
  return /\bTough\b/i.test(String(name ?? "").trim());
}

export function toAbilityKey(value: string): string | null {
  const lowered = String(value ?? "").trim().toLowerCase();
  return ABILITY_NAME_TO_KEY[lowered] ?? null;
}

export function getSelectedAbilityIncrease(choice: ParsedFeatChoice, selected: string[]): Record<string, number> {
  if (choice.type !== "ability_score") return {};
  const amount = Math.max(1, Number(choice.amount ?? 1) || 1);
  const next: Record<string, number> = {};
  for (const raw of selected) {
    const key = toAbilityKey(raw);
    if (!key) continue;
    next[key] = (next[key] ?? 0) + amount;
  }
  return next;
}

export function getOptionalGroups(cls: ClassDetail, level: number): { level: number; features: { name: string; text: string }[] }[] {
  const map = new Map<number, { name: string; text: string }[]>();
  for (const al of cls.autolevels) {
    if (al.level == null || al.level > level) continue;
    const opts = al.features.filter((f) => {
      if (!f.optional) return false;
      if (/subclass/i.test(f.name) || /^Becoming\b/i.test(f.name)) return false;
      const featureSubclass = getFeatureSubclassName(f);
      if (featureSubclass) return false;
      return true;
    });
    if (opts.length > 0) {
      const existing = map.get(al.level) ?? [];
      map.set(al.level, [...existing, ...opts]);
    }
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([lvl, features]) => ({ level: lvl, features }));
}

export function pointBuySpent(scores: Record<string, number>): number {
  return ABILITY_KEYS.reduce((sum, k) => {
    const s = Math.min(15, Math.max(8, scores[k] ?? 8));
    return sum + (POINT_BUY_COSTS[s] ?? 0);
  }, 0);
}

export function initForm(user: { name?: string } | null, params: URLSearchParams): FormState {
  const preselectedCampaign = params.get("campaign");
  return {
    ruleset: null,
    classId: "", raceId: "", bgId: "",
    level: 1, subclass: "", chosenOptionals: [], chosenClassFeatIds: {}, chosenLevelUpFeats: [],
    chosenRaceSkills: [], chosenRaceLanguages: [], chosenRaceTools: [], chosenRaceFeatId: null, chosenRaceSize: null,
    chosenBgSkills: [], chosenBgOriginFeatId: null,
    chosenBgTools: [], chosenBgLanguages: [], chosenClassEquipmentOption: null, chosenBgEquipmentOption: null, chosenFeatOptions: {}, chosenFeatureChoices: {}, bgAbilityMode: "split", bgAbilityBonuses: {},
    chosenSkills: [], chosenClassLanguages: [], chosenWeaponMasteries: [], chosenCantrips: [], chosenSpells: [], chosenInvocations: [],
    abilityMethod: "standard",
    standardAssign: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
    pbScores: { ...DEFAULT_SCORES },
    manualScores: { ...DEFAULT_SCORES },
    hpMax: "", ac: "10", speed: "30",
    characterName: "", playerName: user?.name ?? "",
    alignment: "", hair: "", skin: "", heightText: "",
    age: "", weight: "", gender: "",
    color: C.accentHl,
    campaignIds: preselectedCampaign ? [preselectedCampaign] : [],
  };
}

export function resolvedScores(form: FormState, featAbilityBonuses?: Record<string, number>): Record<string, number> {
  let base: Record<string, number>;
  if (form.abilityMethod === "manual") base = { ...form.manualScores };
  else if (form.abilityMethod === "pointbuy") base = { ...form.pbScores };
  else {
    base = {};
    for (const k of ABILITY_KEYS) {
      const idx = form.standardAssign[k];
      base[k] = idx >= 0 ? STANDARD_ARRAY[idx] : 8;
    }
  }
  for (const [k, v] of Object.entries(form.bgAbilityBonuses)) {
    if (k in base) base[k] = (base[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(featAbilityBonuses ?? {})) {
    if (k in base) base[k] = Math.min(20, (base[k] ?? 0) + v);
  }
  return base;
}

export function getPrimaryAbilityKeys(classDetail: ClassDetail | null): string[] {
  if (!classDetail) return [];
  for (const al of classDetail.autolevels) {
    if (al.level !== 1) continue;
    for (const f of al.features) {
      const m = f.text.match(/Primary Ability:\s*([^\n]+)/i);
      if (m) return abilityNamesToKeys(m[1].split(/,|\s+and\s+|\s+or\s+/i).map((s) => s.trim()).filter(Boolean));
    }
  }
  return [];
}
