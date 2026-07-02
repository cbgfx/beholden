import {
  backgroundFromV2,
  classFromV2,
  featFromV2,
  itemFromV2,
  monsterFromV2,
  spellFromV2,
  speciesFromV2,
  backgroundToV2,
  classToV2,
  featToV2,
  itemToV2,
  monsterToV2,
  spellToV2,
  speciesToV2,
} from "./nativeCompendiumV2.js";
import {
  isCanonicalV2Shape,
  upgradeCanonicalV2Entry,
} from "./nativeCompendiumV2Migration.js";

type JsonRecord = Record<string, unknown>;
type StoredCategory =
  | "monsters"
  | "items"
  | "spells"
  | "classes"
  | "species"
  | "backgrounds"
  | "feats";

const toLegacyView: Record<StoredCategory, (entry: JsonRecord) => JsonRecord> = {
  monsters: monsterFromV2,
  items: itemFromV2,
  spells: spellFromV2,
  classes: classFromV2,
  species: speciesFromV2,
  backgrounds: backgroundFromV2,
  feats: featFromV2,
};

const toCanonicalView: Record<StoredCategory, (entry: JsonRecord) => JsonRecord> = {
  monsters: monsterToV2,
  items: itemToV2,
  spells: spellToV2,
  classes: classToV2,
  species: speciesToV2,
  backgrounds: backgroundToV2,
  feats: featToV2,
};

/**
 * Gives existing API consumers their legacy-shaped view without changing storage.
 * Canonical v2 conversion is deterministic; legacy rows pass through untouched.
 */
export function parseStoredCompendiumEntry(
  category: StoredCategory,
  json: string | null | undefined,
): JsonRecord {
  let entry: JsonRecord = {};
  try {
    const parsed = JSON.parse(json ?? "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      entry = parsed as JsonRecord;
    }
  } catch {
    return {};
  }
  return isCanonicalV2Shape(category, entry)
    ? toLegacyView[category](upgradeCanonicalV2Entry(category, entry))
    : entry;
}

export function isStoredCompendiumEntryCanonical(
  category: StoredCategory,
  json: string | null | undefined,
): boolean {
  try {
    const parsed = JSON.parse(json ?? "{}") as unknown;
    return Boolean(
      parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
      && isCanonicalV2Shape(category, parsed as JsonRecord),
    );
  } catch {
    return false;
  }
}

/** Returns canonical V2 for both migrated rows and legacy rows during rollout. */
export function parseStoredCanonicalCompendiumEntry(
  category: StoredCategory,
  json: string | null | undefined,
): JsonRecord {
  let entry: JsonRecord = {};
  try {
    const parsed = JSON.parse(json ?? "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      entry = parsed as JsonRecord;
    }
  } catch {
    return {};
  }
  return isCanonicalV2Shape(category, entry)
    ? upgradeCanonicalV2Entry(category, entry)
    : toCanonicalView[category](entry);
}
