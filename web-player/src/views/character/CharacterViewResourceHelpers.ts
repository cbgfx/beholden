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

const ITEM_RESOURCE_SUFFIX = /\s+(charges|uses|use)$/i;

/** Item charges (Staff of Defense, a wand's uses, etc.) are tracked on the inventory item itself
 * (`item.charges`/`chargesMax`) and surfaced only via the Item Spells panel's charge dots — they
 * are never a class-style Resource. Older saves could persist a synthesized "<Item> Charges"
 * resource for the same item; matching by name (with or without that suffix) catches those stale
 * entries even though nothing derives a resource for them anymore. */
function isInventoryItemResourceName(name: string, itemNames: ReadonlySet<string>): boolean {
  if (itemNames.size === 0) return false;
  const normalized = normalizeResourceKey(name);
  if (itemNames.has(normalized)) return true;
  const withoutSuffix = name.replace(ITEM_RESOURCE_SUFFIX, "").trim();
  return withoutSuffix !== name && itemNames.has(normalizeResourceKey(withoutSuffix));
}

/** Drops a trailing "(Light Domain)"/"(Cleric)"-style qualifier. Compendium resource labels are
 * sometimes shortened to drop a redundant class/subclass qualifier (e.g. "Warding Flare (Light
 * Domain)" -> "Warding Flare") without the resource itself changing — the same "qualifier doesn't
 * change identity" reasoning `coalesceSharedClassResources` already applies across classes. */
function stripTrailingQualifier(name: string): string {
  return name.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

export function mergeResourceState(
  saved: ResourceCounter[] | undefined,
  derived: ResourceCounter[],
  itemNames: ReadonlySet<string> = new Set(),
): ResourceCounter[] {
  const savedList = Array.isArray(saved) ? saved : [];
  const savedByKey = new Map(savedList.map((resource) => [resource.key || normalizeResourceKey(resource.name), resource]));
  // A resource's key can change underneath a saved character — a class/feat migrating from a
  // counter table to a structured effect, or a compendium id getting canonicalized, both change
  // the derived key without changing what the resource actually is. Name is the fallback match so
  // a stale-keyed saved entry still carries its current/max forward instead of showing twice.
  const savedByName = new Map(savedList.map((resource) => [normalizeResourceKey(resource.name), resource]));
  // Last resort: the key AND the label both changed together (a qualifier was dropped from the
  // label, which also changed its auto-derived key) — match with the qualifier stripped from both
  // sides so that case still carries the saved current/max forward instead of showing twice.
  const savedByStrippedName = new Map(
    savedList.map((resource) => [normalizeResourceKey(stripTrailingQualifier(resource.name)), resource])
  );
  const merged = derived.map((resource) => {
    const existing = savedByKey.get(resource.key)
      ?? savedByName.get(normalizeResourceKey(resource.name))
      ?? savedByStrippedName.get(normalizeResourceKey(stripTrailingQualifier(resource.name)));
    return {
      ...resource,
      restoreAmount: existing?.restoreAmount ?? resource.restoreAmount,
      current: Math.max(0, Math.min(resource.max, Math.floor(Number(existing?.current ?? resource.current) || 0))),
    };
  });
  const derivedKeys = new Set(merged.map((resource) => resource.key));
  const derivedNames = new Set(merged.map((resource) => normalizeResourceKey(resource.name)));
  const derivedStrippedNames = new Set(merged.map((resource) => normalizeResourceKey(stripTrailingQualifier(resource.name))));
  const extras = savedList.filter((resource) => {
    if (derivedKeys.has(resource.key || normalizeResourceKey(resource.name))) return false;
    if (derivedNames.has(normalizeResourceKey(resource.name))) return false;
    if (derivedStrippedNames.has(normalizeResourceKey(stripTrailingQualifier(resource.name)))) return false;
    if (/\(Level \d+:/i.test(resource.name ?? "")) return false;
    if (isInventoryItemResourceName(resource.name ?? "", itemNames)) return false;
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
