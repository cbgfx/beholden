import {
  featFromV2,
  itemFromV2,
  monsterFromV2,
  spellFromV2,
} from "./nativeCompendiumV2.js";
import { CATEGORY_SCHEMAS } from "./nativeCompendiumV2Schemas.js";

type JsonRecord = Record<string, unknown>;
type ScreenViewCategory = "monsters" | "items" | "spells" | "feats";
type CanonicalCategory = ScreenViewCategory | "classes" | "species" | "backgrounds";

const toScreenView: Record<ScreenViewCategory, (entry: JsonRecord) => JsonRecord> = {
  monsters: monsterFromV2,
  items: itemFromV2,
  spells: spellFromV2,
  feats: featFromV2,
};

function parseStoredCanonical(
  category: CanonicalCategory,
  json: string | null | undefined,
): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json ?? "");
  } catch (error) {
    throw new Error(`Stored ${category} entry contains invalid JSON.`, { cause: error });
  }
  return CATEGORY_SCHEMAS[category].parse(parsed) as JsonRecord;
}

/** Projects strict canonical V2 storage into the shape consumed by current screens. */
export function parseStoredCompendiumEntry(
  category: ScreenViewCategory,
  json: string | null | undefined,
): JsonRecord {
  return toScreenView[category](parseStoredCanonical(category, json));
}

/** Returns the strict canonical V2 entry stored in the database. */
export function parseStoredCanonicalCompendiumEntry(
  category: CanonicalCategory,
  json: string | null | undefined,
): JsonRecord {
  return parseStoredCanonical(category, json);
}
