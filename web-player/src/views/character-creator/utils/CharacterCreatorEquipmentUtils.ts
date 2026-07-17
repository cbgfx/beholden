import type { ParsedFeatChoiceLike } from "@/lib/characterRules";
import { parseStartingEquipmentOptions } from "./CharacterCreatorUtils";
import { normalizeInventoryItemLookupName } from "@/views/character/CharacterInventory";
import type { StructuredStartingEquipmentOption } from "./CharacterCreatorClassCoreUtils";

export interface ItemSummaryLike {
  id: string;
  name: string;
  type: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  mastery?: string | null;
  ammo?: "arrow" | "bolt" | "energy-cell" | "firearm-bullet" | "needle" | "sling-bullet" | null;
  weaponAmmo?: "arrow" | "bolt" | "energy-cell" | "firearm-bullet" | "needle" | "sling-bullet" | null;
  usage?: "held" | null;
  effects?: unknown[] | null;
  modifiers?: Array<{ target?: string; amount?: number }>;
}

export interface InventoryItemSeedLike {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  equipState?: "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand";
  notes?: string;
  source?: "compendium" | "custom";
  itemId?: string;
  type?: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
}

export interface BgDetailToolsLike {
  proficiencies?: {
    tools: {
      fixed: string[];
    };
  } | null;
}

export interface FormBgToolsLike {
  chosenBgTools: string[];
  chosenFeatOptions: Record<string, string[]>;
}

export function getBackgroundGrantedToolSelections(
  form: FormBgToolsLike,
  bgDetail: BgDetailToolsLike | null,
  bgFeatChoices: Array<{ key: string; choice: ParsedFeatChoiceLike }>,
  classifyFeatSelection: (choice: ParsedFeatChoiceLike, value: string) => string | null,
): string[] {
  const granted = new Set<string>([
    ...(bgDetail?.proficiencies?.tools.fixed ?? []),
    ...form.chosenBgTools,
  ]);
  for (const featChoice of bgFeatChoices) {
    const selected = form.chosenFeatOptions[featChoice.key] ?? [];
    for (const value of selected) {
      if (classifyFeatSelection(featChoice.choice, value) === "tool") granted.add(value);
    }
  }
  return [...granted];
}

function singularizeEquipmentName(name: string): string {
  const trimmed = name.trim();
  const irregular: Record<string, string> = {
    daggers: "Dagger",
  };
  const lowered = trimmed.toLowerCase();
  if (irregular[lowered]) return irregular[lowered];
  if (/ies$/i.test(trimmed)) return `${trimmed.slice(0, -3)}y`;
  if (/es$/i.test(trimmed) && /(ches|shes|sses|xes|zes)$/i.test(trimmed)) return trimmed.slice(0, -2);
  if (/s$/i.test(trimmed) && !/ss$/i.test(trimmed)) return trimmed.slice(0, -1);
  return trimmed;
}

function resolveStartingInventoryItem(name: string, items: ItemSummaryLike[]): ItemSummaryLike | null {
  const normalized = normalizeInventoryItemLookupName(name);
  const singularNormalized = normalizeInventoryItemLookupName(singularizeEquipmentName(name));
  return items.find((item) => normalizeInventoryItemLookupName(item.name) === normalized)
    ?? items.find((item) => normalizeInventoryItemLookupName(item.name) === singularNormalized)
    ?? null;
}

export function collectEquipmentLookupNames(
  optionId: string | null,
  grantedTools: string[],
  structuredOptions?: StructuredStartingEquipmentOption[],
): string[] {
  const options = parseStartingEquipmentOptions(structuredOptions);
  const selected = options.find((option) => option.id === optionId);
  if (!selected) return [];
  return (selected.structuredEntries ?? []).flatMap((entry) => {
    if (entry.kind === "choiceRef") return grantedTools;
    if (entry.kind === "item" && !entry.itemId && entry.name) return [entry.name];
    return [];
  });
}

export function collectEquipmentLookupIds(
  optionId: string | null,
  structuredOptions?: StructuredStartingEquipmentOption[],
): string[] {
  const selected = structuredOptions?.find((option) => option.id === optionId);
  if (!selected) return [];
  return Array.from(new Set(selected.entries.flatMap((entry) =>
    entry.kind === "item" && entry.itemId ? [entry.itemId]
      : entry.kind === "itemChoice" ? entry.itemIds
      : []
  )));
}
export function buildEquipmentItems(
  optionId: string | null,
  prefix: string,
  grantedTools: string[],
  itemIndex: ItemSummaryLike[],
  structuredOptions?: StructuredStartingEquipmentOption[],
  chosenEquipmentChoices: Record<string, string[]> = {},
): InventoryItemSeedLike[] {
  const options = parseStartingEquipmentOptions(structuredOptions);
  const selected = options.find((option) => option.id === optionId);
  if (!selected) return [];

  const seeds: InventoryItemSeedLike[] = [];
  let autoId = 1;

  function pushItem(name: string, quantity: number, forcedItemId?: string) {
    const trimmed = name.trim();
    if (!trimmed || quantity <= 0) return;
    const matched = forcedItemId
      ? itemIndex.find((item) => item.id === forcedItemId) ?? null
      : resolveStartingInventoryItem(trimmed, itemIndex);
    const canonicalName = matched ? matched.name.replace(/\s+\[(?:2024|5\.5e)\]\s*$/i, "").trim() : trimmed;
    const seedBase = {
      name: canonicalName,
      equipped: false,
      source: matched ? "compendium" as const : "custom" as const,
      itemId: matched?.id,
      type: matched?.type ?? null,
      rarity: matched?.rarity ?? null,
      magic: matched?.magic ?? false,
      attunement: matched?.attunement ?? false,
      weight: matched?.weight ?? null,
      value: matched?.value ?? null,
      ac: matched?.ac ?? null,
      stealthDisadvantage: matched?.stealthDisadvantage ?? false,
      dmg1: matched?.dmg1 ?? null,
      dmg2: matched?.dmg2 ?? null,
      dmgType: matched?.dmgType ?? null,
      properties: matched?.properties ?? [],
      mastery: matched?.mastery ?? null,
      modifiers: matched?.modifiers ?? [],
      ammo: matched?.ammo ?? null,
      weaponAmmo: matched?.weaponAmmo ?? null,
      usage: matched?.usage ?? null,
      effects: matched?.effects ?? null,
    };
    const isWeapon = Boolean(matched?.dmg1 || matched?.dmg2);
    if (isWeapon && quantity > 1) {
      for (let index = 0; index < quantity; index += 1) {
        seeds.push({
          id: `${prefix}-eq-${autoId++}`,
          ...seedBase,
          quantity: 1,
        });
      }
      return;
    }
    seeds.push({
      id: `${prefix}-eq-${autoId++}`,
      ...seedBase,
      quantity,
    });
  }

  function pushCurrency(code: "PP" | "GP" | "EP" | "SP" | "CP", quantity: number) {
    const amount = Math.max(0, Math.floor(Number(quantity) || 0));
    if (amount <= 0) return;
    const existing = seeds.find((seed) => seed.name === code);
    if (existing) {
      existing.quantity += amount;
      return;
    }
    seeds.push({
      id: `${prefix}-eq-${autoId++}`,
      name: code,
      quantity: amount,
      equipped: false,
      source: "custom",
    });
  }

  for (const entry of selected.structuredEntries ?? []) {
      if (entry.kind === "currency") {
        pushCurrency(entry.denomination, entry.amount);
      } else if (entry.kind === "item") {
        pushItem(entry.sourceLabel ?? entry.name ?? entry.itemId ?? "Item", entry.quantity, entry.itemId);
      } else if (entry.kind === "choiceRef") {
        const selectedTool = grantedTools.length === 1 ? grantedTools[0] : null;
        if (selectedTool) pushItem(selectedTool, entry.quantity);
      } else {
        const selectedId = (chosenEquipmentChoices[entry.choiceKey] ?? []).find((id) => entry.itemIds.includes(id));
        if (selectedId) pushItem(entry.sourceLabel, entry.quantity, selectedId);
      }
  }

  return seeds;
}
