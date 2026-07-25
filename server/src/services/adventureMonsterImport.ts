import { normalizeKey } from "../lib/text.js";

type ExistingMonster = { id: string; name_key: string };
type BatchLike = { category?: unknown; entries?: unknown; [key: string]: unknown };

export function planAdventureMonsterImports(
  compendium: unknown[],
  existingMonsters: ExistingMonster[],
): { compendium: unknown[]; monsterIdMap: Map<string, string> } {
  const monsterIdMap = new Map<string, string>();
  const byId = new Map(existingMonsters.map((monster) => [monster.id, monster.id]));
  const byName = new Map(existingMonsters.map((monster) => [monster.name_key, monster.id]));

  const planned = compendium.map((rawBatch) => {
    if (!rawBatch || typeof rawBatch !== "object" || Array.isArray(rawBatch)) return rawBatch;
    const batch = rawBatch as BatchLike;
    if (batch.category !== "monsters" || !Array.isArray(batch.entries)) return rawBatch;

    const entries = batch.entries.filter((rawEntry) => {
      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) return true;
      const entry = rawEntry as Record<string, unknown>;
      const importedId = typeof entry.id === "string" ? entry.id.trim() : "";
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const nameKey = normalizeKey(name);
      const existingId = (importedId ? byId.get(importedId) : undefined)
        ?? (nameKey ? byName.get(nameKey) : undefined);

      if (existingId) {
        if (importedId) monsterIdMap.set(importedId, existingId);
        return false;
      }

      if (importedId) byId.set(importedId, importedId);
      if (importedId && nameKey) byName.set(nameKey, importedId);
      return true;
    });

    return { ...batch, entries };
  });

  return { compendium: planned, monsterIdMap };
}
