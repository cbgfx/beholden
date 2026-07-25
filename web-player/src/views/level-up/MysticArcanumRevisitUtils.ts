/** Surfaces the Warlock's already-known Mystic Arcanum spell picks so Eldritch Versatility (at
 * levels 12, 16, and 19) can re-offer them for editing, not just the choices newly unlocked at
 * the current level. Each entry reuses the exact historical choice key its spell was originally
 * stored under (`levelupclassfeature:<level it first unlocked>:<choice id>`), so picking a
 * different spell here updates that same record instead of creating a duplicate — and leaving it
 * untouched changes nothing. */

import type { LevelUpResolvedSpellChoiceEntry } from "@/views/level-up/LevelUpTypes";

interface MysticArcanumAutolevelLike {
  level: number;
  features: Array<{
    name: string;
    subclass?: string | null;
    choices?: Array<{ id?: string; kind: string; lists?: string[]; level?: number | null }>;
  }>;
}

export function getMysticArcanumRevisitChoices(args: {
  ruleset: "5e" | "5.5e";
  className: string | null | undefined;
  newFeatureNames: string[];
  autolevels: MysticArcanumAutolevelLike[];
  nextClassLevel: number;
}): LevelUpResolvedSpellChoiceEntry[] {
  const { ruleset, className, newFeatureNames, autolevels, nextClassLevel } = args;
  if (ruleset !== "5e") return [];
  if (className !== "Warlock") return [];
  if (!newFeatureNames.includes("Eldritch Versatility")) return [];

  const entries: LevelUpResolvedSpellChoiceEntry[] = [];
  for (const autolevel of autolevels) {
    if (autolevel.level >= nextClassLevel) continue;
    for (const feature of autolevel.features) {
      if (feature.subclass || !/^Mystic Arcanum\b/.test(feature.name)) continue;
      const choice = feature.choices?.find((entry) => entry.kind === "spell" && entry.id);
      if (!choice || !choice.id || choice.level == null) continue;
      entries.push({
        key: `levelupclassfeature:${autolevel.level}:${choice.id}`,
        title: `${feature.name} (Eldritch Versatility)`,
        sourceLabel: feature.name,
        count: 1,
        level: choice.level,
        listNames: choice.lists ?? [],
        note: "Optional: change this Mystic Arcanum spell, or leave it as-is.",
      });
    }
  }
  return entries;
}
