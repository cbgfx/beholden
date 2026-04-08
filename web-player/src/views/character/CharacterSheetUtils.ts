import type { TaggedItem } from "@/views/character/CharacterSheetTypes";
import type { AbilKey, ProficiencyMap } from "@/views/character/CharacterSheetTypes";

export function abilityMod(score: number | null | undefined): number {
  return Math.floor(((score ?? 10) - 10) / 2);
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

export function proficiencyValue(level: number, tier: 0 | 0.5 | 1 | 2): number {
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

export function parseInvocationPrereqLevel(text: string): number {
  const m = text.match(/Prerequisite[^:]*:.*?Level\s+(\d+)\+/i);
  return m ? parseInt(m[1], 10) : 1;
}

export function extractPrerequisite(text: string | null | undefined): string | null {
  const raw = String(text ?? "");
  const match = raw.match(/^\s*Prerequisite[^:]*:\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

export function stripPrerequisiteLine(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/^\s*Prerequisite[^:]*:.*(?:\r?\n)?/im, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function spellLooksLikeDamageSpell(spell: { name?: string | null; text?: string | null }): boolean {
  const text = String(spell.text ?? "");
  const name = String(spell.name ?? "");
  return /\bdeal(?:s|ing)?\b.*\bdamage\b/i.test(text)
    || /\btakes?\b.*\bdamage\b/i.test(text)
    || /\b\d+d\d+\b/.test(text)
    || /eldritch blast|poison spray|fire bolt|ray of frost|chill touch|sacred flame|acid splash|mind sliver|toll the dead|vicious mockery|word of radiance|primal savagery|thorn whip|shocking grasp/i.test(name);
}

export function invocationPrerequisitesMet(
  text: string | null | undefined,
  opts: {
    level: number;
    chosenCantripNames?: string[];
    chosenDamageCantripNames?: string[];
    chosenInvocationNames?: string[];
  }
): boolean {
  const raw = String(text ?? "");
  if (parseInvocationPrereqLevel(raw) > opts.level) return false;

  const chosenCantripNames = (opts.chosenCantripNames ?? []).map((name) => String(name).toLowerCase());
  const chosenDamageCantripNames = (opts.chosenDamageCantripNames ?? []).map((name) => String(name).toLowerCase());
  const chosenInvocationNames = (opts.chosenInvocationNames ?? []).map((name) => String(name).toLowerCase());

  if (/prerequisite[^:]*:.*eldritch blast cantrip/i.test(raw) && !chosenCantripNames.includes("eldritch blast")) return false;
  if (/prerequisite[^:]*:.*warlock cantrip that deals damage/i.test(raw) && chosenDamageCantripNames.length === 0) return false;
  if (/prerequisite[^:]*:.*pact of the blade/i.test(raw) && !chosenInvocationNames.some((name) => /pact of the blade/i.test(name))) return false;
  if (/prerequisite[^:]*:.*pact of the chain/i.test(raw) && !chosenInvocationNames.some((name) => /pact of the chain/i.test(name))) return false;
  if (/prerequisite[^:]*:.*pact of the tome/i.test(raw) && !chosenInvocationNames.some((name) => /pact of the tome/i.test(name))) return false;
  if (/prerequisite[^:]*:.*pact of the talisman/i.test(raw) && !chosenInvocationNames.some((name) => /pact of the talisman/i.test(name))) return false;

  return true;
}

export function featPrerequisitesMet(
  text: string | null | undefined,
  opts: {
    level: number;
    className?: string | null;
    scores?: Partial<Record<AbilKey, number | null | undefined>>;
    prof?: ProficiencyMap | null | undefined;
    spellcaster?: boolean;
  }
): boolean {
  const prereq = extractPrerequisite(text);
  if (!prereq) return true;

  const raw = prereq.toLowerCase();
  const levelMatch = raw.match(/\blevel\s+(\d+)\+/i);
  if (levelMatch && opts.level < Number(levelMatch[1])) return false;

  const className = String(opts.className ?? "").toLowerCase();
  const classMatches = [...raw.matchAll(/\b(barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard|artificer)\b/g)].map((match) => match[1]);
  if (classMatches.length > 0 && !classMatches.some((name) => className.includes(name))) return false;

  if (/\bspellcasting\b|\bpact magic\b/i.test(raw) && !opts.spellcaster) return false;

  const abilityRequirements: Array<{ key: AbilKey; patterns: RegExp[] }> = [
    { key: "str", patterns: [/\bstrength\b/i, /\bstr\b/i] },
    { key: "dex", patterns: [/\bdexterity\b/i, /\bdex\b/i] },
    { key: "con", patterns: [/\bconstitution\b/i, /\bcon\b/i] },
    { key: "int", patterns: [/\bintelligence\b/i, /\bint\b/i] },
    { key: "wis", patterns: [/\bwisdom\b/i, /\bwis\b/i] },
    { key: "cha", patterns: [/\bcharisma\b/i, /\bcha\b/i] },
  ];

  for (const requirement of abilityRequirements) {
    const hasAbilityMention = requirement.patterns.some((pattern) => pattern.test(raw));
    if (!hasAbilityMention) continue;
    const scoreMatch = raw.match(/(\d+)\+/);
    if (!scoreMatch) continue;
    const score = Number(opts.scores?.[requirement.key] ?? 0);
    if (score < Number(scoreMatch[1])) return false;
  }

  if (/\bproficiency with a martial weapon\b/i.test(raw) && !hasNamedProficiency(opts.prof?.weapons, "Martial Weapons")) return false;
  if (/\bproficiency with a shield\b/i.test(raw) && !hasNamedProficiency(opts.prof?.armor, "Shields")) return false;
  if (/\bproficiency with light armor\b/i.test(raw) && !hasNamedProficiency(opts.prof?.armor, "Light Armor")) return false;
  if (/\bproficiency with medium armor\b/i.test(raw) && !hasNamedProficiency(opts.prof?.armor, "Medium Armor")) return false;
  if (/\bproficiency in the stealth skill\b/i.test(raw) && !hasNamedProficiency(opts.prof?.skills, "Stealth")) return false;

  return true;
}

export function hpColor(pct: number): string {
  if (pct <= 0) return "#6b7280";
  if (pct < 25) return C.colorPinkRed;
  if (pct < 50) return C.colorOrange;
  if (pct < 75) return C.colorGold;
  return "#4ade80";
}

