import type { GrowthChoiceDefinition } from "./GrowthChoiceUtils";
import { normalizeChoiceKey } from "@/views/character-creator/utils/CharacterCreatorUtils";

export interface GrowthChoiceItemSummaryLike {
  id: string;
  name: string;
  rarity?: string | null;
  type?: string | null;
  typeKey?: string | null;
  magic?: boolean;
  attunement?: boolean;
}

function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesNamedItemOption(itemName: string, optionName: string): boolean {
  return normalizeChoiceKey(itemName) === normalizeChoiceKey(optionName)
    || normalizeChoiceKey(itemName.replace(/\s*\([^)]*\)\s*$/u, "")) === normalizeChoiceKey(optionName);
}

export function buildGrowthChoiceItemOptions(
  definition: GrowthChoiceDefinition,
  items: GrowthChoiceItemSummaryLike[],
): Array<{ id: string; name: string; rarity?: string | null; type?: string | null; typeKey?: string | null; magic?: boolean; attunement?: boolean }> {
  if (definition.category !== "plan") return [];

  const resolved: Array<{ id: string; name: string; rarity?: string | null; type?: string | null; typeKey?: string | null; magic?: boolean; attunement?: boolean }> = [];
  const matchesDefinitionCategory = (item: GrowthChoiceItemSummaryLike) => {
    if (!definition.itemCategory) return true;
    const haystack = `${item.type ?? ""} ${item.typeKey ?? ""}`.toLowerCase();
    return haystack.includes(definition.itemCategory.toLowerCase());
  };
  for (const option of definition.itemOptions ?? []) {
    if (option.repeatableGroup === "common-magic-item") {
      items
        .filter((item) =>
          matchesDefinitionCategory(item)
          && String(item.rarity ?? "").trim().toLowerCase() === "common"
          && Boolean(item.magic)
          && !/\bpotion\b/i.test(String(item.type ?? ""))
          && !/\bscroll\b/i.test(String(item.type ?? ""))
        )
        .forEach((item) => resolved.push({
          id: String(item.id),
          name: item.name,
          rarity: item.rarity ?? null,
          type: item.type ?? null,
          typeKey: item.typeKey ?? null,
          magic: item.magic,
          attunement: item.attunement,
        }));
      continue;
    }
    if (option.repeatableGroup === "wondrous-item") {
      items
        .filter((item) =>
          matchesDefinitionCategory(item)
          && String(item.rarity ?? "").trim().toLowerCase() === String(option.rarity ?? "").trim().toLowerCase()
          && Boolean(item.magic)
          && /\bwondrous\b/i.test(`${item.type ?? ""} ${item.typeKey ?? ""}`)
        )
        .forEach((item) => resolved.push({
          id: String(item.id),
          name: item.name,
          rarity: item.rarity ?? null,
          type: item.type ?? null,
          typeKey: item.typeKey ?? null,
          magic: item.magic,
          attunement: item.attunement,
        }));
      continue;
    }
    items
      .filter((item) => matchesDefinitionCategory(item) && matchesNamedItemOption(item.name, option.name))
      .forEach((item) => resolved.push({
        id: String(item.id), name: item.name, rarity: item.rarity ?? null, type: item.type ?? null,
        typeKey: item.typeKey ?? null, magic: item.magic, attunement: item.attunement,
      }));
  }

  return uniqueByName(resolved).sort((a, b) => a.name.localeCompare(b.name));
}
