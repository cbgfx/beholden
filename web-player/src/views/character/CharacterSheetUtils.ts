import type { TaggedItem } from "@/views/character/CharacterSheetTypes";
import type { AbilKey, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { C } from "@/lib/theme";

export function abilityMod(score: number | null | undefined): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}

export function normalizeAbilityKey(value: string | null | undefined): AbilKey | null {
  const aliases: Record<string, AbilKey> = {
    strength: "str", str: "str",
    dexterity: "dex", dex: "dex",
    constitution: "con", con: "con",
    intelligence: "int", int: "int",
    wisdom: "wis", wis: "wis",
    charisma: "cha", cha: "cha",
  };
  return aliases[String(value ?? "").trim().toLowerCase()] ?? null;
}

export function formatModifier(n: number): string {
  return (n >= 0 ? "+" : "") + n;
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function hasNamedProficiency(list: Array<Pick<TaggedItem, "name">> | null | undefined, name: string): boolean {
  return (list ?? []).some((s) => String(s.name).toLowerCase() === name.toLowerCase());
}

function proficiencyValue(level: number, tier: 0 | 0.5 | 1 | 2): number {
  const pb = proficiencyBonus(level);
  if (tier === 2) return pb * 2;
  if (tier === 1) return pb;
  if (tier === 0.5) return Math.floor(pb / 2);
  return 0;
}

export function getSkillProficiencyTier(
  prof: ProficiencyMap | null | undefined,
  skillName: string,
  opts?: { jackOfAllTrades?: boolean },
): 0 | 0.5 | 1 | 2 {
  if (hasNamedProficiency(prof?.expertise, skillName)) return 2;
  if (hasNamedProficiency(prof?.skills, skillName)) return 1;
  if (opts?.jackOfAllTrades) return 0.5;
  return 0;
}

export function getSkillBonus(
  skillName: string,
  abilityKey: AbilKey,
  scores: Record<AbilKey, number | null>,
  level: number,
  prof: ProficiencyMap | null | undefined,
  opts?: { jackOfAllTrades?: boolean },
): number {
  return abilityMod(scores[abilityKey]) + proficiencyValue(level, getSkillProficiencyTier(prof, skillName, opts));
}

export function getSaveBonus(
  abilityName: string,
  abilityKey: AbilKey,
  scores: Record<AbilKey, number | null>,
  level: number,
  prof: ProficiencyMap | null | undefined,
  extraBonus = 0,
): number {
  return abilityMod(scores[abilityKey]) + (hasNamedProficiency(prof?.saves, abilityName) ? proficiencyBonus(level) : 0) + extraBonus;
}

export function getInitiativeBonus(
  dexScore: number | null | undefined,
  level: number,
  opts?: { jackOfAllTrades?: boolean },
): number {
  return abilityMod(dexScore) + (opts?.jackOfAllTrades ? Math.floor(proficiencyBonus(level) / 2) : 0);
}

export function getPassiveScore(skillBonus: number): number {
  return 10 + skillBonus;
}

export function normalizeWeaponProficiencyName(name: string): string {
  const normalized = String(name ?? "").trim();
  if (!normalized) return normalized;
  if (/^simple$/i.test(normalized)) return "Simple Weapons";
  if (/^martial$/i.test(normalized)) return "Martial Weapons";
  if (/^light$/i.test(normalized)) return "Light Weapons";
  if (/^improvised$/i.test(normalized)) return "Improvised Weapons";
  if (/^finesse$/i.test(normalized)) return "Finesse Weapons";
  if (/^thrown$/i.test(normalized)) return "Thrown Weapons";
  if (/^heavy$/i.test(normalized)) return "Heavy Weapons";
  if (/^range(?:d)?$/i.test(normalized)) return "Ranged Weapons";
  if (/^versatile$/i.test(normalized)) return "Versatile Weapons";
  if (/^two[-\s]?handed$/i.test(normalized)) return "Two-Handed Weapons";
  if (/^special$/i.test(normalized)) return "Special Weapons";
  if (/^reach$/i.test(normalized)) return "Reach Weapons";
  if (/^loading$/i.test(normalized)) return "Loading Weapons";
  return normalized.replace(/\s+/g, " ");
}

export function splitWeaponProficiencyNames(name: string): string[] {
  const normalized = String(name ?? "").trim();
  if (!normalized) return [];
  const results = new Set<string>();
  const lower = normalized.toLowerCase();

  const add = (value: string) => results.add(normalizeWeaponProficiencyName(value));

  if (/\bsimple\b/.test(lower)) add("Simple");
  if (/\bmartial\b/.test(lower)) add("Martial");
  if (/\blight\b/.test(lower)) add("Light");
  if (/\bimprovised\b/.test(lower)) add("Improvised");
  if (/\bfinesse\b/.test(lower)) add("Finesse");
  if (/\bthrown\b/.test(lower)) add("Thrown");
  if (/\bheavy\b/.test(lower)) add("Heavy");
  if (/\brange(?:d)?\b/.test(lower)) add("Ranged");
  if (/\bversatile\b/.test(lower)) add("Versatile");
  if (/\btwo[-\s]?handed\b|\b2h\b/.test(lower)) add("Two-Handed");
  if (/\bspecial\b/.test(lower)) add("Special");
  if (/\breach\b/.test(lower)) add("Reach");
  if (/\bloading\b/.test(lower)) add("Loading");

  if (results.size > 0) return Array.from(results);

  return [normalizeWeaponProficiencyName(normalized)];
}

export function normalizeArmorProficiencyName(name: string): string {
  const normalized = String(name ?? "").trim();
  if (!normalized) return normalized;
  if (/^shield$/i.test(normalized)) return "Shields";
  return normalized;
}

export function splitArmorProficiencyNames(name: string): string[] {
  const normalized = String(name ?? "").trim();
  if (!normalized) return [];

  const results = new Set<string>();
  if (/\blight armor\b/i.test(normalized)) results.add("Light Armor");
  if (/\bmedium armor\b/i.test(normalized)) results.add("Medium Armor");
  if (/\bheavy armor\b/i.test(normalized)) results.add("Heavy Armor");
  if (/\bshields?\b/i.test(normalized)) results.add("Shields");

  if (results.size > 0) return Array.from(results);

  const formatted = normalizeArmorProficiencyName(normalized);
  return formatted ? [formatted] : [];
}

export function normalizeLanguageName(name: string): string {
  const normalized = String(name ?? "").trim();
  if (!normalized) return normalized;
  if (/^thieves'? cant$/i.test(normalized)) return "Thieves' Cant";
  if (/^common$/i.test(normalized)) return "Common";
  return normalized;
}

export function normalizeSpellTrackingName(name: string): string {
  return String(name ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSpellTrackingKey(name: string): string {
  return normalizeSpellTrackingName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function isLikelyTrackedSpellName(name: string): boolean {
  const normalized = normalizeSpellTrackingName(name);
  if (!normalized) return false;
  if (normalized.includes("|")) return false;
  if (/^\d+(?:\s*\|\s*[^|]+)+$/i.test(normalized)) return false;
  if (/\b\d+\/\d+\b/.test(normalized)) return false;
  if (!/[A-Za-z]/.test(normalized)) return false;
  return true;
}

export function dedupeTaggedItems(
  list: TaggedItem[] | null | undefined,
  normalizeName?: (name: string) => string,
): TaggedItem[] {
  const out: TaggedItem[] = [];
  const seen = new Set<string>();
  for (const item of list ?? []) {
    const name = (normalizeName ? normalizeName(item.name) : String(item.name ?? "").trim()).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...item,
      name,
    });
  }
  return out;
}

export function normalizeResourceKey(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Renders a ClassTalent's typed prerequisite for display. Only invocations carry
 * prerequisites, and invocations are Warlock-only by acquisition, so the class label is
 * fixed. `resolveTalentName` maps a `ct_` dependency id to its display name. */
export function classTalentPrerequisiteLabel(
  prerequisite: ClassTalentPrerequisite | null | undefined,
  resolveTalentName?: (id: string) => string | null | undefined,
): string | null {
  if (!prerequisite) return null;
  const parts: string[] = [];
  if (prerequisite.level) parts.push(`Level ${prerequisite.level}+ Warlock`);
  if (prerequisite.talent) {
    const name = resolveTalentName?.(prerequisite.talent);
    parts.push(name ? `${name.replace(/^Invocation:\s*/i, "")} Invocation` : prerequisite.talent);
  }
  if (prerequisite.cantrip === "damage") parts.push("a Warlock cantrip that deals damage");
  if (prerequisite.cantrip === "attack_damage") parts.push("a Warlock cantrip that deals damage via an attack roll");
  if (prerequisite.pactBoon) parts.push(`Pact of the ${prerequisite.pactBoon.charAt(0).toUpperCase()}${prerequisite.pactBoon.slice(1)}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function spellLooksLikeDamageSpell(spell: { name?: string | null; text?: string | null; rolls?: Array<{ effect?: string | string[] | null }> | null }): boolean {
  return (spell.rolls ?? []).some((roll) => Array.isArray(roll.effect) || (roll.effect && roll.effect !== "healing" && roll.effect !== "temp_hp"));
}

export type PactBoon = "blade" | "chain" | "tome" | "talisman";

export interface ClassTalentPrerequisite {
  level?: number;
  talent?: string;
  cantrip?: "damage" | "attack_damage";
  /** 2014-only: see the schema comment on `ClassTalentSchema.prerequisite.pactBoon`. */
  pactBoon?: PactBoon;
}

/** 2014's Pact Boon is a class `choices` pick (not a `ct_` talent id), so its selection lives
 * in `chosenOptionals` as a `cf_..._pact_of_the_<x>` feature id rather than in the chosen-
 * invocations list. Extracts which boon (if any) that implies. 5.5e represents Pact Boons as
 * invocations instead, so this always returns null for 5.5e characters — harmless, since their
 * invocations gate on `prerequisite.talent`/`chosenTalentIds`, not `pactBoon`. */
export function resolvePactBoonFromChosenOptionals(chosenOptionals: string[] | null | undefined): PactBoon | null {
  for (const id of chosenOptionals ?? []) {
    const match = /pact_of_the_(blade|chain|tome|talisman)/.exec(id);
    if (match) return match[1] as PactBoon;
  }
  return null;
}

export function invocationPrerequisitesMet(
  prerequisite: ClassTalentPrerequisite | null | undefined,
  opts: {
    level: number;
    hasDamageCantrip?: boolean;
    hasAttackDamageCantrip?: boolean;
    chosenTalentIds?: string[];
    chosenPactBoon?: PactBoon | null;
  }
): boolean {
  if (!prerequisite) return true;
  if ((prerequisite.level ?? 0) > opts.level) return false;
  if (prerequisite.talent && !(opts.chosenTalentIds ?? []).includes(prerequisite.talent)) return false;
  if (prerequisite.cantrip === "damage" && !opts.hasDamageCantrip) return false;
  if (prerequisite.cantrip === "attack_damage" && !opts.hasAttackDamageCantrip) return false;
  if (prerequisite.pactBoon && prerequisite.pactBoon !== opts.chosenPactBoon) return false;
  return true;
}

interface FeatPrerequisiteFacts {
  level?: number;
  ability?: { any: readonly AbilKey[]; min?: number } | ReadonlyArray<{ any: readonly AbilKey[]; min?: number }>;
  class?: "paladin";
  feature?: "spellcasting" | "fighting_style";
  training?: "martial_weapon" | "heavy_weapon" | "light_armor" | "medium_armor" | "heavy_armor" | "shield";
  feat?: string;
  anyOfFeats?: string[];
  noneOfFeats?: string[];
  campaign?: "eberron";
  any?: Array<Pick<FeatPrerequisiteFacts, "feat" | "feature" | "training">>;
}

export type FeatPrerequisite = number | FeatPrerequisiteFacts;

function featRequirementMet(
  requirement: Pick<FeatPrerequisiteFacts, "feat" | "feature" | "training">,
  opts: {
    prof?: ProficiencyMap | null;
    spellcaster?: boolean;
    features?: string[];
    featIds?: string[];
  },
): boolean {
  if (requirement.feat) return (opts.featIds ?? []).includes(requirement.feat);
  if (requirement.feature === "spellcasting") return Boolean(opts.spellcaster);
  if (requirement.feature === "fighting_style") return (opts.features ?? []).includes("fighting_style");
  const training = requirement.training;
  if (!training) return true;
  if (training === "martial_weapon") return hasNamedProficiency(opts.prof?.weapons, "Martial Weapons");
  if (training === "heavy_weapon") return hasNamedProficiency(opts.prof?.weapons, "Heavy Weapons") || hasNamedProficiency(opts.prof?.weapons, "Martial Weapons");
  const armor = { light_armor: "Light Armor", medium_armor: "Medium Armor", heavy_armor: "Heavy Armor", shield: "Shields" }[training];
  return hasNamedProficiency(opts.prof?.armor, armor);
}

export function featPrerequisitesMet(
  prerequisite: FeatPrerequisite | null | undefined,
  opts: {
    level: number;
    className?: string | null;
    scores?: Partial<Record<AbilKey, number | null | undefined>>;
    prof?: ProficiencyMap | null | undefined;
    spellcaster?: boolean;
    features?: string[];
    featIds?: string[];
  }
): boolean {
  if (prerequisite == null) return true;
  const facts = typeof prerequisite === "number" ? { level: prerequisite } : prerequisite;
  if (facts.level && opts.level < facts.level) return false;
  if (facts.ability) {
    const requirements: ReadonlyArray<{ any: readonly AbilKey[]; min?: number }> = Array.isArray(facts.ability)
      ? facts.ability as ReadonlyArray<{ any: readonly AbilKey[]; min?: number }>
      : [facts.ability as { any: readonly AbilKey[]; min?: number }];
    if (!requirements.every((requirement) => requirement.any.some((key) => Number(opts.scores?.[key] ?? 0) >= (requirement.min ?? 13)))) return false;
  }
  if (facts.class && !String(opts.className ?? "").toLowerCase().includes(facts.class)) return false;
  if (!featRequirementMet(facts, opts)) return false;
  const featIds = opts.featIds ?? [];
  if (facts.anyOfFeats && !facts.anyOfFeats.some((id) => featIds.includes(id))) return false;
  if (facts.noneOfFeats?.some((id) => featIds.includes(id))) return false;
  if (facts.any && !facts.any.some((requirement) => featRequirementMet(requirement, opts))) return false;
  // Campaign approval is an authored display/table constraint, not a character statistic.
  return true;
}

export function formatFeatPrerequisite(prerequisite: FeatPrerequisite | null | undefined): string | null {
  if (prerequisite == null) return null;
  const facts = typeof prerequisite === "number" ? { level: prerequisite } : prerequisite;
  const parts: string[] = [];
  if (facts.level) parts.push(`Level ${facts.level}+`);
  if (facts.ability) {
    const requirements: ReadonlyArray<{ any: readonly AbilKey[]; min?: number }> = Array.isArray(facts.ability)
      ? facts.ability as ReadonlyArray<{ any: readonly AbilKey[]; min?: number }>
      : [facts.ability as { any: readonly AbilKey[]; min?: number }];
    parts.push(requirements.map((requirement) => `${requirement.any.map((key) => key.toUpperCase()).join(" or ")} ${requirement.min ?? 13}+`).join(" and "));
  }
  if (facts.class) parts.push(`${facts.class[0].toUpperCase()}${facts.class.slice(1)} class`);
  if (facts.feature) parts.push(facts.feature === "spellcasting" ? "Spellcasting or Pact Magic feature" : "Fighting Style feature");
  if (facts.training) parts.push(facts.training.replaceAll("_", " "));
  if (facts.feat) parts.push(`Feat ${facts.feat}`);
  if (facts.anyOfFeats) parts.push("a required Feat");
  if (facts.noneOfFeats) parts.push("no other Dragonmark Feat");
  if (facts.campaign) parts.push(`${facts.campaign[0].toUpperCase()}${facts.campaign.slice(1)} campaign`);
  if (facts.any) parts.push("one listed requirement");
  return parts.join(", ");
}

export function hpColor(pct: number): string {
  if (pct <= 0) return "#6b7280";
  if (pct < 25) return C.colorPinkRed;
  if (pct < 50) return C.colorOrange;
  if (pct < 75) return C.colorGold;
  return "#4ade80";
}

