import { nativeEntryKey } from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import { normalizeKey } from "../lib/text.js";

export type MonsterRuleset = "5e" | "5.5e";
type ExistingMonster = { id: string; ruleset: MonsterRuleset; name_key: string };
type BatchLike = { category?: unknown; entries?: unknown; [key: string]: unknown };

export function adventureMonsterKey(id: string, ruleset: MonsterRuleset): string {
  return nativeEntryKey("monsters", { id, ruleset });
}

export function planAdventureMonsterImports(
  compendium: unknown[],
  existingMonsters: ExistingMonster[],
): { compendium: unknown[]; monsterIdMap: Map<string, string> } {
  const monsterIdMap = new Map<string, string>();
  const byId = new Map(existingMonsters.map((monster) => [adventureMonsterKey(monster.id, monster.ruleset), monster.id]));
  const byName = new Map(existingMonsters.map((monster) => [`${monster.ruleset}:${monster.name_key}`, monster.id]));

  const planned = compendium.map((rawBatch) => {
    if (!rawBatch || typeof rawBatch !== "object" || Array.isArray(rawBatch)) return rawBatch;
    const batch = rawBatch as BatchLike;
    if (batch.category !== "monsters" || !Array.isArray(batch.entries)) return rawBatch;

    const entries = batch.entries.filter((rawEntry) => {
      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) return true;
      const entry = rawEntry as Record<string, unknown>;
      const importedId = typeof entry.id === "string" ? entry.id.trim() : "";
      const ruleset: MonsterRuleset = entry.ruleset === "5e" ? "5e" : "5.5e";
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const nameKey = normalizeKey(name);
      const importedKey = adventureMonsterKey(importedId, ruleset);
      const existingId = (importedId ? byId.get(importedKey) : undefined)
        ?? (nameKey ? byName.get(`${ruleset}:${nameKey}`) : undefined);

      if (existingId) {
        if (importedId) monsterIdMap.set(importedKey, existingId);
        return false;
      }

      if (importedId) byId.set(importedKey, importedId);
      if (importedId && nameKey) byName.set(`${ruleset}:${nameKey}`, importedId);
      return true;
    });

    return { ...batch, entries };
  });

  return { compendium: planned, monsterIdMap };
}
