import { api } from "@/services/api";
import type { ItemSummary } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { GrowthChoiceDefinition } from "@/views/character-creator/utils/GrowthChoiceUtils";

interface ItemLookupBody {
  names?: string[];
  includeCommonMagic?: boolean;
  includeWondrousRarities?: string[];
}

function normalizeLookupName(value: string): string {
  return String(value ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function buildItemLookupBodyFromNames(rawNames: Array<string | null | undefined>): ItemLookupBody {
  const seen = new Set<string>();
  const names = rawNames
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .filter((entry) => {
      const key = normalizeLookupName(entry);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return names.length > 0 ? { names } : {};
}

export function buildGrowthItemLookupBody(definitions: GrowthChoiceDefinition[]): ItemLookupBody {
  const names: string[] = [];
  const wondrousRaritySet = new Set<string>();
  let includeCommonMagic = false;
  for (const definition of definitions) {
    if (definition.category !== "plan") continue;
    for (const option of definition.itemOptions ?? []) {
      if (option.repeatableGroup === "common-magic-item") {
        includeCommonMagic = true;
        continue;
      }
      if (option.repeatableGroup === "wondrous-item") {
        const rarity = String(option.rarity ?? "").trim().toLowerCase();
        if (rarity) wondrousRaritySet.add(rarity);
        continue;
      }
      names.push(option.name);
    }
  }
  const base = buildItemLookupBodyFromNames(names);
  if (includeCommonMagic) base.includeCommonMagic = true;
  if (wondrousRaritySet.size > 0) base.includeWondrousRarities = Array.from(wondrousRaritySet);
  return base;
}

export function isItemLookupBodyEmpty(body: ItemLookupBody): boolean {
  return !body.includeCommonMagic
    && (!body.includeWondrousRarities || body.includeWondrousRarities.length === 0)
    && (!body.names || body.names.length === 0);
}

export async function fetchCompendiumItemsByLookup(body: ItemLookupBody): Promise<ItemSummary[]> {
  if (isItemLookupBodyEmpty(body)) return [];
  const result = await api<{ rows: ItemSummary[] }>("/api/compendium/items/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return Array.isArray(result?.rows) ? result.rows : [];
}

