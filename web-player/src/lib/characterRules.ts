import type { ParsedFeatChoiceLike, ParsedFeatLike as SharedParsedFeatLike, ParsedFeatDetailLike as SharedParsedFeatDetailLike } from "@/views/character-creator/utils/FeatChoiceTypes";

export type Ruleset = "5.5e";

export interface RuleTaggedRecord {
  ruleset?: Ruleset | null;
  name?: string | null;
}

export type ParsedFeatLike = SharedParsedFeatLike<ParsedFeatChoiceLike>;
export type { ParsedFeatChoiceLike };

export type BackgroundFeatLike = SharedParsedFeatDetailLike<ParsedFeatChoiceLike>;

export interface BackgroundDetailLike {
  proficiencies?: {
    feats?: BackgroundFeatLike[];
  } | null;
}

export interface BackgroundFeatChoiceEntry {
  featName: string;
  feat: ParsedFeatLike;
  choice: ParsedFeatChoiceLike;
  key: string;
}

export interface RaceChoices {
  hasChosenSize: boolean;
  skillChoice: { count: number; from: string[] | null } | null;
  toolChoice: { count: number; from: string[] | null } | null;
  languageChoice: { count: number; from: string[] | null } | null;
  hasFeatChoice: boolean;
}

export function wordOrNumberToInt(value: string): number | null {
  const lowered = value.trim().toLowerCase();
  const numeric = Number.parseInt(lowered, 10);
  if (Number.isFinite(numeric)) return numeric;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return words[lowered] ?? null;
}

export function matchesRuleset(value: RuleTaggedRecord, ruleset: Ruleset | null): boolean {
  if (!ruleset) return true;
  if (value.ruleset) return value.ruleset === "5.5e";
  return true;
}

function parseRaceChoices(traits: { name: string; text: string }[], allSkills: string[]): RaceChoices {
  let hasChosenSize = false;
  let skillChoice: RaceChoices["skillChoice"] = null;
  let toolChoice: RaceChoices["toolChoice"] = null;
  let languageChoice: RaceChoices["languageChoice"] = null;
  let hasFeatChoice = false;

  for (const t of traits) {
    const text = t.text;
    if (/^size$/i.test(t.name) && /chosen when you select/i.test(text)) hasChosenSize = true;
    if (/origin feat of your choice/i.test(text)) hasFeatChoice = true;

    const skillListMatch = text.match(/proficiency in the\s+([\w\s,]+?)\s+skills?\b/i);
    if (skillListMatch) {
      const from = skillListMatch[1]
        .split(/,\s*|\s+or\s+/i)
        .map((s) => s.trim())
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .filter((s) => allSkills.includes(s));
      if (from.length > 0 && !skillChoice) skillChoice = { count: 1, from };
    } else if (
      /one skill proficiency|proficiency in one skill|gain proficiency in one skill of your choice/i.test(text) ||
      /one skill of your choice/i.test(text)
    ) {
      if (!skillChoice) skillChoice = { count: 1, from: null };
    }

    if (/one tool proficiency of your choice/i.test(text)) {
      if (!toolChoice) toolChoice = { count: 1, from: null };
    }

    const langListMatch = text.match(/your choice of (\w+)\s+of the following[^:]*languages?:\s*([^\n.]+)/i);
    if (langListMatch) {
      const count = wordOrNumberToInt(langListMatch[1]) ?? 1;
      const from = langListMatch[2]
        .split(/[,\n\t]+/)
        .map((s) => s.trim()).filter(Boolean)
        .map((s) => s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "));
      if (!languageChoice) languageChoice = { count, from: from.length > 0 ? from : null };
    } else if (/one(?:\s+extra)?\s+language.*(?:of your )?choice/i.test(text)) {
      if (!languageChoice) languageChoice = { count: 1, from: null };
    }
  }

  return { hasChosenSize, skillChoice, toolChoice, languageChoice, hasFeatChoice };
}

export function getBackgroundFeatChoices(bgDetail: BackgroundDetailLike | null): BackgroundFeatChoiceEntry[] {
  const feats = bgDetail?.proficiencies?.feats ?? [];
  return feats.flatMap((feat) =>
    feat.parsed.choices
      .filter((choice) =>
        choice.type === "proficiency"
        || choice.type === "weapon_mastery"
        || choice.type === "expertise"
        || choice.type === "ability_score"
        || choice.type === "spell"
        || choice.type === "spell_list"
      )
      .map((choice) => ({
        featName: feat.name,
        feat: feat.parsed,
        choice,
        key: `bg:${feat.name}:${choice.id}`,
      }))
  );
}
