import { normalizeResourceKey } from "@/views/character/CharacterSheetUtils";
import type { GrantedSpellCast, ResourceCounter } from "@/views/character/CharacterSheetTypes";
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


export function collectClassResources(classDetail: ClassRestDetail | null, level: number, selectedSubclass?: string | null, classSourceId?: string): ResourceCounter[] {
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
      const key = classSourceId ? `class:${classSourceId}:${normalizeResourceKey(name)}` : normalizeResourceKey(name);
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
  // A resource's key can change underneath a saved character — a class/feat migrating from a
  // counter table to a structured effect, or a compendium id getting canonicalized, both change
  // the derived key without changing what the resource actually is. Name is the fallback match so
  // a stale-keyed saved entry still carries its current/max forward instead of showing twice.
  const savedByName = new Map(savedList.map((resource) => [normalizeResourceKey(resource.name), resource]));
  const merged = derived.map((resource) => {
    const existing = savedByKey.get(resource.key) ?? savedByName.get(normalizeResourceKey(resource.name));
    return {
      ...resource,
      restoreAmount: existing?.restoreAmount ?? resource.restoreAmount,
      current: Math.max(0, Math.min(resource.max, Math.floor(Number(existing?.current ?? resource.current) || 0))),
    };
  });
  const derivedKeys = new Set(merged.map((resource) => resource.key));
  const derivedNames = new Set(merged.map((resource) => normalizeResourceKey(resource.name)));
  const extras = savedList.filter((resource) => {
    if (derivedKeys.has(resource.key || normalizeResourceKey(resource.name))) return false;
    if (derivedNames.has(normalizeResourceKey(resource.name))) return false;
    if (/\(Level \d+:/i.test(resource.name ?? "")) return false;
    return true;
  });
  return [...merged, ...extras];
}

/** 2014 multiclass Channel Divinity grants additional effects, but not an extra pool.
 * The highest explicitly granted use count across owned classes is the shared maximum. */
export function coalesceSharedClassResources(resources: ResourceCounter[]): ResourceCounter[] {
  const channelDivinity = resources.filter((resource) => normalizeResourceKey(resource.name) === "channel-divinity");
  if (channelDivinity.length <= 1) return resources;
  const strongest = channelDivinity.reduce((best, resource) => resource.max > best.max ? resource : best);
  return [
    ...resources.filter((resource) => normalizeResourceKey(resource.name) !== "channel-divinity"),
    { ...strongest, key: "class:shared:channel_divinity", current: strongest.max },
  ];
}

export function isSpellLinkedResource(args: {
  resource: ResourceCounter;
  grantedSpells: GrantedSpellCast[];
  spellLinkedResourceKeys: Set<string>;
}): boolean {
  if (args.spellLinkedResourceKeys.has(args.resource.key)) return true;
  const resourceName = normalizeResourceKey(args.resource.name);
  return args.grantedSpells.some((spell) =>
    spell.resourceKey === args.resource.key
    || resourceName === normalizeResourceKey(`${spell.spellName} (${spell.sourceName})`)
  );
}

export function shouldResetOnRest(resetCode: string | undefined, restType: "short" | "long"): boolean {
  const code = String(resetCode ?? "").trim().toUpperCase();
  if (restType === "short") return code === "S";
  return code === "S" || code === "L";
}
