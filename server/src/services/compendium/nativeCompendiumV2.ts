import {
  CATEGORY_SCHEMAS,
  formatCanonicalV2Issues,
  isCanonicalV2Entry,
} from "./nativeCompendiumV2Schemas.js";
import { type JsonRecord, record, list, text } from "./nativeCompendiumV2.helpers.js";

export type { JsonRecord };

export function assertCanonicalV2Entry(category: string, entry: JsonRecord, index: number): void {
  if (!(category in CATEGORY_SCHEMAS)) {
    throw new Error(`Unsupported canonical category "${category}".`);
  }
  const result = CATEGORY_SCHEMAS[category as keyof typeof CATEGORY_SCHEMAS].safeParse(entry);
  if (!result.success) {
    throw new Error(
      `${category} entry ${index + 1} is invalid:\n${formatCanonicalV2Issues(result.error)}`,
    );
  }
}

export { isCanonicalV2Entry };

export function collectV2MonsterSpellIds(entries: JsonRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const monster of entries) {
    for (const rawSpell of list(monster.spells)) {
      const spellId = text(record(rawSpell).id);
      if (spellId) ids.add(spellId);
    }
  }
  return ids;
}

export { monsterToV2, monsterFromV2 } from "./nativeCompendiumV2.monster.js";
export { classToV2 } from "./nativeCompendiumV2.class.js";
export { itemToV2, itemFromV2 } from "./nativeCompendiumV2.item.js";
export { spellToV2, spellFromV2 } from "./nativeCompendiumV2.spell.js";
export { speciesToV2 } from "./nativeCompendiumV2.species.js";
export { backgroundToV2 } from "./nativeCompendiumV2.background.js";
export { featToV2, featFromV2 } from "./nativeCompendiumV2.feat.js";
