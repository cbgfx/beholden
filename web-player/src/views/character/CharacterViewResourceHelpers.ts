import { normalizeResourceKey } from "@/views/character/CharacterSheetUtils";
import type { ResourceCounter } from "@/views/character/CharacterSheetTypes";
import type { ClassRestDetail } from "./CharacterViewTypes";

function normalizeSubclassLookupName(name: string | null | undefined): string {
  return String(name ?? "").trim().toLowerCase();
}

function shouldDisplayClassCounterResource(name: string | null | undefined): boolean {
  const normalized = String(name ?? "").trim();
  if (!normalized) return false;
  if (/^(spells prepared|plans known|known forms)$/i.test(normalized)) return false;
  return true;
}


export function collectClassResources(classDetail: ClassRestDetail | null, level: number, selectedSubclass?: string | null): ResourceCounter[] {
  if (!classDetail) return [];
  const latest = new Map<string, ResourceCounter>();
  const autolevels = Array.isArray(classDetail.autolevels) ? classDetail.autolevels : [];
  for (const autolevel of autolevels) {
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
