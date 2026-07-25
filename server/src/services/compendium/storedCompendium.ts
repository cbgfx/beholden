import {
  projectGrandFeat,
  projectGrandItem,
  projectGrandMonster,
  projectGrandSpell,
} from "./grandCompendium.js";
import { CATEGORY_SCHEMAS } from "./grandCompendiumSchemas.js";

type JsonRecord = Record<string, unknown>;
type ScreenViewCategory = "monsters" | "items" | "spells" | "feats";
type GrandCategory = ScreenViewCategory | "classes" | "species" | "backgrounds" | "classTalents";

const toScreenView: Record<ScreenViewCategory, (entry: JsonRecord) => JsonRecord> = {
  monsters: projectGrandMonster,
  items: projectGrandItem,
  spells: projectGrandSpell,
  feats: projectGrandFeat,
};

function parseStoredGrand(
  category: GrandCategory,
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

/** Projects strict Grand storage into the shape consumed by current screens. */
export function parseStoredPresentationEntry(
  category: ScreenViewCategory,
  json: string | null | undefined,
): JsonRecord {
  return toScreenView[category](parseStoredGrand(category, json));
}

/** Returns the strict Grand entry stored in the database. */
export function parseStoredGrandEntry(
  category: GrandCategory,
  json: string | null | undefined,
): JsonRecord {
  return parseStoredGrand(category, json);
}
