import { ALL_SKILLS } from "@/views/character/CharacterSheetConstants";

const SPELL_LIST_NAMES = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const SPELL_SCHOOL_NAMES = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const SKILL_NAME_MAP = new Map(ALL_SKILLS.map((skill) => [skill.name.toLowerCase(), skill.name]));

export function parseWordCount(value: string): number | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  const direct = Number.parseInt(normalized, 10);
  if (Number.isFinite(direct)) return direct;
  const words: Record<string, number> = {
    a: 1,
    an: 1,
    another: 1,
    once: 1,
    one: 1,
    twice: 2,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  return words[normalized] ?? null;
}

export function isProficiencyNoiseToken(value: string): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return true;
  if (/\bof your choice\b/i.test(normalized)) return true;
  if (parseWordCount(normalized) != null) return true;
  return /^(?:\d+|this|that|these|those|extra|another|any|language|languages|tool|tools|skill|skills)$/i.test(normalized);
}

export function cleanupText(text: string): string {
  return String(text ?? "")
    .replace(/Source:.*$/gim, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSkillName(raw: string): string | null {
  const normalized = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return SKILL_NAME_MAP.get(normalized) ?? null;
}

export function splitSkillNames(raw: string): string[] {
  return raw
    .split(/\s*,\s*|\s+and\s+|\s+or\s+/i)
    .map((part) => normalizeSkillName(part))
    .filter((name): name is string => Boolean(name));
}

export function hasContextualQualifier(text: string, matchEndIndex: number): boolean {
  const tail = text.slice(matchEndIndex).trimStart().toLowerCase();
  return [
    "against ",
    "made ",
    "to ",
    "where ",
    "when ",
    "during ",
    "as part of ",
    "that rely on ",
    "using ",
    "within ",
  ].some((prefix) => tail.startsWith(prefix));
}

function normalizeBrokenWord(raw: string, candidates: string[]): string | null {
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  for (const candidate of candidates) {
    if (candidate.replace(/\s+/g, "").toLowerCase() === compact) return candidate;
  }
  return null;
}

export function parseSpellLists(text: string): string[] {
  const found = new Set<string>();
  for (const name of SPELL_LIST_NAMES) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) found.add(name);
  }
  return Array.from(found);
}

export function parseSpellSchools(text: string): string[] {
  const found = new Set<string>();
  for (const rawPart of text.split(/\s*,\s*|\s+and\s+|\s+or\s+/i)) {
    const normalized = normalizeBrokenWord(rawPart.trim(), SPELL_SCHOOL_NAMES);
    if (normalized) found.add(normalized);
  }
  return Array.from(found);
}

export function splitNamedSpellList(raw: string): string[] {
  return raw
    .split(/\s*,\s*|\s+and\s+/i)
    .map((part) => part.trim().replace(/^the\s+/i, ""))
    .filter(Boolean)
    .filter(isLikelySpellName);
}

export function hasLikelySpellNameCapitalization(spellName: string): boolean {
  return /[A-Z]/.test(spellName) && spellName !== spellName.toLowerCase();
}

function looksLikePreparedSpellList(raw: string): boolean {
  const cleaned = String(raw ?? "").trim();
  if (!cleaned) return false;
  if (/[.;:!?]/.test(cleaned)) return false;
  if (/\b(count|prepare|prepared spells|whenever|replace|thereafter|otherwise|with this feature|finish a long rest|finish a short rest)\b/i.test(cleaned)) {
    return false;
  }
  return splitNamedSpellList(cleaned).length > 0;
}

export function isLikelySpellName(spellName: string): boolean {
  const cleaned = spellName.trim().replace(/^the\s+/i, "");
  if (!cleaned) return false;
  if (/[|]/.test(cleaned)) return false;
  if (/^[\d/]+$/.test(cleaned)) return false;
  if (/^(yes|no)$/i.test(cleaned)) return false;
  if (!hasLikelySpellNameCapitalization(spellName)) return false;
  if (/^(it|that|these|those)(?:\s+spell|\s+spells)?$/i.test(cleaned)) return false;
  if (/^(a|an|another)\s+/i.test(cleaned)) return false;
  if (/^(prepared|chosen|listed|extra|one extra)\b/i.test(cleaned)) return false;
  if (/^different\b/i.test(cleaned)) return false;
  if (/^(wizard|cleric|druid|bard|sorcerer|warlock|paladin|ranger|artificer)\b/i.test(cleaned)) return false;
  if (/\bof your choice\b/i.test(cleaned)) return false;
  if (/\bspell list\b/i.test(cleaned)) return false;
  if (/\bfrom the\b/i.test(cleaned)) return false;
  if (/\bcount against\b/i.test(cleaned)) return false;
  if (/\bwith this feature\b/i.test(cleaned)) return false;
  if (/\buntil the number on the table\b/i.test(cleaned)) return false;
  return true;
}

export { SPELL_LIST_NAMES };
export { looksLikePreparedSpellList };
