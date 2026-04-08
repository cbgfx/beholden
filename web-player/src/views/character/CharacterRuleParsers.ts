import { normalizeLanguageName } from "@/views/character/CharacterSheetUtils";
import {
  collectTaggedGrantsFromEffects,
  parseFeatureEffects,
} from "@/domain/character/parseFeatureEffects";

export interface FeatureGrants {
  armor: string[];
  weapons: string[];
  tools: string[];
  skills: string[];
  languages: string[];
}

export interface ClassLanguageChoice {
  fixed: string[];
  choose: number;
  from: string[] | null;
  source: string;
}

interface ClassLanguageFeature {
  optional?: boolean;
  text?: string;
  name?: string;
}

interface ClassLanguageAutolevel {
  level: number | null;
  features: ClassLanguageFeature[];
}

interface ClassLanguageDetailLike {
  name: string;
  autolevels: ClassLanguageAutolevel[];
}

interface RaceTraitLike {
  name: string;
}

interface RaceLanguageDetailLike {
  traits?: RaceTraitLike[] | null;
}

export function parseFeatureGrants(text: string): FeatureGrants {
  const parsed = parseFeatureEffects({
    source: { id: "text", kind: "other", name: "Feature Text", text },
    text,
  });
  const grants = collectTaggedGrantsFromEffects([parsed]);
  return {
    armor: grants.armor.map((item) => item.name),
    weapons: grants.weapons.map((item) => item.name),
    tools: grants.tools.map((item) => item.name),
    skills: grants.skills.map((item) => item.name),
    languages: grants.languages.map((item) => item.name),
  };
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
      const text = String(feature.text ?? "");
      if (/know\s+thieves' cant/i.test(text)) {
        fixed.add("Thieves' Cant");
        source = String(feature.name ?? source);
      }
      if (/one\s+other\s+language\s+of\s+your\s+choice/i.test(text) || /one\s+language\s+of\s+your\s+choice/i.test(text)) {
        choose = Math.max(choose, 1);
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
  const hasExplicitLanguageTrait = (raceDetail?.traits ?? []).some((trait) => /^languages?$/i.test(trait.name));
  if (hasExplicitLanguageTrait) return null;
  return {
    fixed: ["Common"],
    choose: 2,
    from: standardLanguages.map(normalizeLanguageName),
    source: "Core Rules",
  };
}
