import { normalizeLanguageName } from "@/views/character/CharacterSheetUtils";

export interface ClassLanguageChoice {
  fixed: string[];
  choose: number;
  from: string[] | null;
  source: string;
}

interface ClassLanguageFeature {
  optional?: boolean;
  name?: string;
  effects?: unknown[];
  choices?: Array<{ kind?: string; category?: string; count?: number; from?: string | string[] }>;
}

interface ClassLanguageAutolevel {
  level: number | null;
  features: ClassLanguageFeature[];
}

interface ClassLanguageDetailLike {
  name: string;
  autolevels: ClassLanguageAutolevel[];
}

interface RaceLanguageDetailLike {
  /** Present only when the species already grants its own language choice (e.g. Warforged) —
   * read from the compendium's structured `choices.languageChoice`, never inferred from a trait
   * named "Language(s)" or its prose. */
  languageChoice?: { count: number; from: string[] | null } | null;
}

export function getClassLanguageChoice(
  classDetail: ClassLanguageDetailLike | null,
  level: number,
  allLanguages: string[],
): ClassLanguageChoice | null {
  if (!classDetail) return null;
  const fixed = new Set<string>();
  let choose = 0;
  let source = classDetail.name;
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level == null || autolevel.level > level) continue;
    for (const feature of autolevel.features) {
      if (feature.optional) continue;
      for (const rawEffect of feature.effects ?? []) {
        const effect = rawEffect as Record<string, unknown>;
        if (effect.type !== "proficiency_grant" || effect.category !== "language" || !Array.isArray(effect.grants)) continue;
        effect.grants.forEach((language) => fixed.add(String(language)));
        source = String(feature.name ?? source);
      }
      for (const choice of feature.choices ?? []) {
        if (choice.kind !== "proficiency" || choice.category !== "language") continue;
        choose += Math.max(0, Number(choice.count) || 0);
        source = String(feature.name ?? source);
      }
    }
  }
  if (fixed.size === 0 && choose === 0) return null;
  return { fixed: [...fixed], choose, from: allLanguages, source };
}

export function getCoreLanguageChoice(
  raceDetail: RaceLanguageDetailLike | null,
  standardLanguages: string[],
) {
  if (raceDetail?.languageChoice != null) return null;
  return {
    fixed: ["Common"],
    choose: 2,
    from: standardLanguages.map(normalizeLanguageName),
    source: "Core Rules",
  };
}
