// Canonical identity for a native compendium entry, shared between the server (which owns the
// database) and the client (which needs to compute the exact same key to diff content before
// upload -- see computeContentHash.ts). There must be exactly one implementation of this key
// scheme; do not hand-roll `ruleset + ":" + id` (or any other separator) anywhere else.

export const NATIVE_COMPENDIUM_CATEGORIES = [
  "monsters",
  "items",
  "spells",
  "classTalents",
  "classes",
  "species",
  "backgrounds",
  "feats",
  "decks",
  "bastions",
] as const;

export type NativeCompendiumCategory = (typeof NATIVE_COMPENDIUM_CATEGORIES)[number];

const categorySet = new Set<string>(NATIVE_COMPENDIUM_CATEGORIES);

export function isNativeCompendiumCategory(value: string): value is NativeCompendiumCategory {
  return categorySet.has(value);
}

// classes/species/backgrounds/feats/spells/classTalents have a composite PRIMARY KEY (id, ruleset)
// -- bare id membership isn't enough to tell "already exists" from "new" for these categories, so
// their ids are read alongside ruleset and composite-keyed as "ruleset:id".
export const RULESET_SCOPED_CATEGORIES = new Set<NativeCompendiumCategory>([
  "classes",
  "species",
  "backgrounds",
  "feats",
  "spells",
  "classTalents",
]);

export function nativeEntryKey(
  category: NativeCompendiumCategory,
  row: { id: string; ruleset?: string | undefined },
): string {
  return RULESET_SCOPED_CATEGORIES.has(category) ? `${String(row.ruleset)}:${row.id}` : row.id;
}
