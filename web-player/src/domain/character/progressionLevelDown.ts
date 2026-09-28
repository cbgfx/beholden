export interface LevelDownClassDefinition {
  name?: string | null;
  autolevels?: Array<{ level?: number | null; features?: Array<{ name?: string | null; subclass?: string | null }> }>;
}

export interface LevelDownPreview {
  fromLevel: number;
  toLevel: number;
  removedFeatures: string[];
  removedRecordedChoices: string[];
  warnings: string[];
  hpChange?: { before: number; after: number };
  abilityChanges?: string[];
  removedProficiencies?: string[];
  removedGrants?: string[];
}

export function buildLevelDownPreview(args: {
  fromLevel: number;
  toLevel: number;
  classDefinition?: LevelDownClassDefinition | null;
  subclass?: string | null;
  acquisitionLevels?: Record<string, number | null>;
  taggedSpells?: Array<{ id?: string; name?: string; level?: number | null }>;
  taggedInvocations?: Array<{ id?: string; name?: string; level?: number | null }>;
  levelUpChoices?: Array<{ level: number; type?: string | null; featId?: string | null; abilityBonuses?: Record<string, number> }>;
  hpChange?: { before: number; after: number } | null;
  abilityChanges?: string[];
  removedProficiencies?: string[];
  removedGrants?: string[];
}): LevelDownPreview | null {
  const fromLevel = Math.max(0, Math.trunc(args.fromLevel));
  const toLevel = Math.max(0, Math.trunc(args.toLevel));
  if (toLevel >= fromLevel) return null;
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const removedFeatures = unique((args.classDefinition?.autolevels ?? []).flatMap((entry) => {
    const level = Number(entry.level) || 0;
    if (level <= toLevel || level > fromLevel) return [];
    return (entry.features ?? []).flatMap((feature) => {
      if (feature.subclass && feature.subclass !== args.subclass) return [];
      return feature.name ? [`Level ${level}: ${feature.name}`] : [];
    });
  }));
  const recorded = Object.entries(args.acquisitionLevels ?? {}).flatMap(([key, level]) =>
    typeof level === "number" && level > toLevel && level <= fromLevel ? [`Level ${level}: ${key.replace(/^optional:/, "Choice: ").replace(/^extraFeat:/, "Feat: ")}`] : []
  );
  for (const [label, entries] of [["Spell", args.taggedSpells], ["Invocation", args.taggedInvocations]] as const) {
    for (const entry of entries ?? []) {
      const level = Number(entry.level);
      if (Number.isFinite(level) && level > toLevel && level <= fromLevel) recorded.push(`Level ${level}: ${label}: ${entry.name ?? entry.id ?? "Unknown"}`);
    }
  }
  for (const choice of args.levelUpChoices ?? []) {
    if (choice.level <= toLevel || choice.level > fromLevel) continue;
    const description = choice.type === "feat"
      ? `Feat: ${choice.featId ?? "Unknown"}`
      : choice.type === "asi"
        ? `Ability Score Improvement: ${Object.entries(choice.abilityBonuses ?? {}).filter(([, value]) => value > 0).map(([ability, value]) => `${ability.toUpperCase()} +${value}`).join(", ") || "Unknown"}`
        : "Level-up choice";
    recorded.push(`Level ${choice.level}: ${description}`);
  }
  return {
    fromLevel,
    toLevel,
    removedFeatures,
    removedRecordedChoices: unique([...recorded, ...(args.removedGrants ?? [])]),
    warnings: args.hpChange ? [] : ["HP cannot be reversed automatically until this character has complete per-level HP history. Review HP Max before saving."],
    ...(args.hpChange ? { hpChange: args.hpChange } : {}),
    abilityChanges: args.abilityChanges ?? [],
    removedProficiencies: args.removedProficiencies ?? [],
  };
}

export function formatLevelDownPreview(preview: LevelDownPreview): string {
  const sections = [`Reduce this class from level ${preview.fromLevel} to ${preview.toLevel}?`];
  if (preview.removedFeatures.length) sections.push(`Class features removed:\n${preview.removedFeatures.map((value) => `• ${value}`).join("\n")}`);
  if (preview.removedRecordedChoices.length) sections.push(`Recorded choices removed:\n${preview.removedRecordedChoices.map((value) => `• ${value}`).join("\n")}`);
  if (preview.hpChange) sections.push(`HP Max: ${preview.hpChange.before} → ${preview.hpChange.after}`);
  if (preview.abilityChanges?.length) sections.push(`Ability scores:\n${preview.abilityChanges.map((value) => `• ${value}`).join("\n")}`);
  if (preview.removedProficiencies?.length) sections.push(`Proficiencies removed:\n${preview.removedProficiencies.map((value) => `• ${value}`).join("\n")}`);
  if (preview.warnings.length) sections.push(`Review required:\n${preview.warnings.map((value) => `• ${value}`).join("\n")}`);
  return sections.join("\n\n");
}
