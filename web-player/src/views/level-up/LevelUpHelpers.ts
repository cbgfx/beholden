import type { LevelUpClassDetail as ClassDetail, LevelUpSpellSummary as SpellSummary } from "@/views/level-up/LevelUpTypes";

interface NamedOptionEntry {
  id: string;
  name: string;
}

export function normalizeSpellSelectionKey(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/u, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function reconcileSelectedSpellIds(
  selected: string[],
  options: SpellSummary[],
  knownSpellNames: string[] = [],
): string[] {
  const byId = new Map(options.map((spell) => [String(spell.id), String(spell.id)]));
  const byName = new Map(options.map((spell) => [normalizeSpellSelectionKey(spell.name), String(spell.id)]));
  const resolved = new Set<string>();

  for (const entry of selected) {
    const direct = byId.get(String(entry));
    if (direct) {
      resolved.add(direct);
      continue;
    }
    const bySavedName = byName.get(normalizeSpellSelectionKey(entry));
    if (bySavedName) resolved.add(bySavedName);
  }

  for (const name of knownSpellNames) {
    const matched = byName.get(normalizeSpellSelectionKey(name));
    if (matched) resolved.add(matched);
  }

  return Array.from(resolved);
}

export function cleanFeatureText(text: string | null | undefined): string {
  return String(text ?? "").replace(/Source:.*$/ms, "").trim();
}

export function stripRulesetSuffix(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s*\[[^\]]+\]\s*$/u, "").trim();
}

export function hasKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function sameStringArrays(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

export function sameSelectionMap(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!sameStringArrays(aKeys, bKeys)) return false;
  return aKeys.every((key) => sameStringArrays(a[key] ?? [], b[key] ?? []));
}

export function sameSpellChoiceOptionMap<T extends NamedOptionEntry>(
  a: Record<string, T[]>,
  b: Record<string, T[]>,
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!sameStringArrays(aKeys, bKeys)) return false;
  return aKeys.every((key) => {
    const aValues = (a[key] ?? []).map((spell) => `${spell.id}:${spell.name}`);
    const bValues = (b[key] ?? []).map((spell) => `${spell.id}:${spell.name}`);
    return sameStringArrays(aValues, bValues);
  });
}

export function mergeAutoLevels(classDetail: ClassDetail | null): ClassDetail["autolevels"] {
  if (!classDetail) return [];
  const byLevel = new Map<number, ClassDetail["autolevels"][number]>();
  for (const autolevel of classDetail.autolevels ?? []) {
    const existing = byLevel.get(autolevel.level);
    if (!existing) {
      byLevel.set(autolevel.level, {
        ...autolevel,
        features: [...(autolevel.features ?? [])],
        counters: [...(autolevel.counters ?? [])],
        slots: autolevel.slots ? [...autolevel.slots] : autolevel.slots,
      });
      continue;
    }
    existing.scoreImprovement = Boolean(existing.scoreImprovement || autolevel.scoreImprovement);
    existing.features = [...(existing.features ?? []), ...(autolevel.features ?? [])];
    existing.counters = [...(existing.counters ?? []), ...(autolevel.counters ?? [])];
    if (autolevel.slots && autolevel.slots.length > 0) existing.slots = [...autolevel.slots];
  }
  return Array.from(byLevel.values()).sort((a, b) => a.level - b.level);
}
