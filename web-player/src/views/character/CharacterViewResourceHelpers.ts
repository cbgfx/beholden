import { normalizeResourceKey } from "@/views/character/CharacterSheetUtils";
import type { ResourceCounter } from "@/views/character/CharacterSheetTypes";
import type { ClassRestDetail, ResourceProgressionOverride } from "./CharacterViewTypes";

const RESOURCE_PROGRESSION_OVERRIDES: ResourceProgressionOverride[] = [
  {
    className: "Druid",
    featureName: "Wild Shape",
    values: [
      { level: 2, value: 2 },
      { level: 6, value: 3 },
      { level: 17, value: 4 },
    ],
  },
];

function normalizeCompendiumClassLookupName(name: string | null | undefined): string {
  return String(name ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSubclassLookupName(name: string | null | undefined): string {
  return String(name ?? "").trim().toLowerCase();
}

function shouldDisplayClassCounterResource(name: string | null | undefined): boolean {
  const normalized = String(name ?? "").trim();
  if (!normalized) return false;
  if (/^(spells prepared|plans known|known forms)$/i.test(normalized)) return false;
  return true;
}

function resolveResourceProgressionOverride(
  className: string | null | undefined,
  featureName: string | null | undefined,
  level: number,
): number | null {
  const normalizedClass = normalizeCompendiumClassLookupName(className);
  const normalizedFeature = String(featureName ?? "").trim().toLowerCase();
  const override = RESOURCE_PROGRESSION_OVERRIDES.find((entry) =>
    normalizeCompendiumClassLookupName(entry.className) === normalizedClass
    && entry.featureName.trim().toLowerCase() === normalizedFeature
  );
  if (!override) return null;
  let result: number | null = null;
  for (const row of override.values) {
    if (row.level <= level) result = row.value;
  }
  return result;
}

function parseWordCount(value: string): number | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  const direct = Number.parseInt(normalized, 10);
  if (Number.isFinite(direct)) return direct;
  const words: Record<string, number> = {
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

export function collectClassResources(classDetail: ClassRestDetail | null, level: number, selectedSubclass?: string | null): ResourceCounter[] {
  if (!classDetail) return [];
  const latest = new Map<string, ResourceCounter>();
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level > level) continue;
    for (const counter of autolevel.counters ?? []) {
      const max = Math.max(0, Math.floor(Number(counter.value) || 0));
      const name = String(counter.name ?? "").trim();
      const counterSubclass = String(counter.subclass ?? "").trim();
      if (counterSubclass && normalizeSubclassLookupName(counterSubclass) !== normalizeSubclassLookupName(selectedSubclass)) continue;
      if (!name || max <= 0 || !shouldDisplayClassCounterResource(name)) continue;
      const key = normalizeResourceKey(name);
      latest.set(key, {
        key,
        name,
        current: max,
        max,
        reset: String(counter.reset ?? "L").trim().toUpperCase() || "L",
        restoreAmount: "all",
      });
    }
  }
  return Array.from(latest.values());
}

export function collectFeatureResourceFallbacks(
  features: Array<{ name: string; text?: string | null }>,
  className: string | null | undefined,
  level: number,
): ResourceCounter[] {
  const fallback = new Map<string, ResourceCounter>();
  for (const feature of features) {
    const sourceLabel = String(feature.name ?? "").replace(/^Level\s+\d+\s*:\s*/i, "").trim();
    const text = String(feature.text ?? "").replace(/\s+/g, " ").trim();
    if (!sourceLabel || !text) continue;
    const escapedLabel = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fixedUseMatch = text.match(new RegExp(`you can use (?:the )?(?:${escapedLabel}|this feature)\\s+(once|twice|one|two|three|four|five|six|\\d+)`, "i"));
    const fixedUses = parseWordCount(fixedUseMatch?.[1] ?? "");
    const regainsOneOnShort = /regain one expended use when you finish a short rest/i.test(text);
    const regainsAllOnLong = /regain all expended uses when you finish a long rest/i.test(text);
    const regainsAllOnShortOrLong = /regain all expended uses when you finish a short or long rest/i.test(text);
    const regainsAllOnShort = /regain all expended uses when you finish a short rest/i.test(text);
    const reset =
      regainsOneOnShort ? "S"
      : regainsAllOnShortOrLong ? "SL"
      : regainsAllOnShort ? "S"
      : regainsAllOnLong ? "L"
      : null;
    if (!fixedUses || !reset) continue;
    const scaledMax = resolveResourceProgressionOverride(className, sourceLabel, level) ?? fixedUses;
    const key = normalizeResourceKey(sourceLabel);
    if (fallback.has(key)) continue;
    fallback.set(key, {
      key,
      name: sourceLabel,
      current: scaledMax,
      max: scaledMax,
      reset,
      restoreAmount: regainsOneOnShort ? "one" : "all",
    });
  }
  return Array.from(fallback.values());
}

export function mergeResourceState(saved: ResourceCounter[] | undefined, derived: ResourceCounter[]): ResourceCounter[] {
  const savedList = Array.isArray(saved) ? saved : [];
  const savedByKey = new Map(savedList.map((resource) => [resource.key || normalizeResourceKey(resource.name), resource]));
  const merged = derived.map((resource) => {
    const existing = savedByKey.get(resource.key);
    return {
      ...resource,
      restoreAmount: existing?.restoreAmount ?? resource.restoreAmount,
      current: Math.max(0, Math.min(resource.max, Math.floor(Number(existing?.current ?? resource.current) || 0))),
    };
  });
  const derivedKeys = new Set(merged.map((resource) => resource.key));
  const extras = savedList.filter((resource) => {
    if (derivedKeys.has(resource.key || normalizeResourceKey(resource.name))) return false;
    if (/\(Level \d+:/i.test(resource.name ?? "")) return false;
    return true;
  });
  return [...merged, ...extras];
}

export function shouldResetOnRest(resetCode: string | undefined, restType: "short" | "long"): boolean {
  const code = String(resetCode ?? "").trim().toUpperCase();
  if (restType === "short") return code === "S";
  return code === "S" || code === "L";
}
