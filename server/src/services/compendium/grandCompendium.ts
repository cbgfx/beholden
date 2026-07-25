import {
  CATEGORY_SCHEMAS,
  formatGrandCompendiumIssues,
  isGrandCompendiumEntry,
} from "./grandCompendiumSchemas.js";
import { type JsonRecord, record, list, text } from "./grandCompendium.helpers.js";

export type { JsonRecord };

export function assertGrandCompendiumEntry(category: string, entry: JsonRecord, index: number): void {
  if (!(category in CATEGORY_SCHEMAS)) {
    throw new Error(`Unsupported canonical category "${category}".`);
  }
  const result = CATEGORY_SCHEMAS[category as keyof typeof CATEGORY_SCHEMAS].safeParse(entry);
  if (!result.success) {
    throw new Error(
      `${category} entry ${index + 1} is invalid:\n${formatGrandCompendiumIssues(result.error)}`,
    );
  }
}

export { isGrandCompendiumEntry };

export function collectGrandMonsterSpellIds(entries: JsonRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const monster of entries) {
    for (const rawSpell of list(monster.spells)) {
      const spellId = text(record(rawSpell).id);
      if (spellId) ids.add(spellId);
    }
  }
  return ids;
}

export { projectGrandMonster } from "./grandCompendium.monster.js";
export { projectGrandItem } from "./grandCompendium.item.js";
export { projectGrandSpell } from "./grandCompendium.spell.js";
export { projectGrandFeat } from "./grandCompendium.feat.js";
