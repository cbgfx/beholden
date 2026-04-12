import type { ParsedFeatChoiceLike } from "@/lib/characterRules";
import { parseStartingEquipmentOptions } from "./CharacterCreatorUtils";
import { MUSICAL_INSTRUMENTS } from "../constants/CharacterCreatorConstants";
import { normalizeInventoryItemLookupName } from "@/views/character/CharacterInventory";

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

export function singularizeEquipmentName(name: string): string {
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

export function resolveStartingInventoryItem(name: string, items: ItemSummaryLike[]): ItemSummaryLike | null {
  const normalized = normalizeInventoryItemLookupName(name);
  const singularNormalized = normalizeInventoryItemLookupName(singularizeEquipmentName(name));
  return items.find((item) => normalizeInventoryItemLookupName(item.name) === normalized)
    ?? items.find((item) => normalizeInventoryItemLookupName(item.name) === singularNormalized)
    ?? null;
}

export function currencyCodeFromEntry(entry: string): "PP" | "GP" | "EP" | "SP" | "CP" | null {
  const normalized = String(entry ?? "")
    .replace(/\bplatinum pieces?\b/gi, "PP")
    .replace(/\bgold pieces?\b/gi, "GP")
    .replace(/\belectrum pieces?\b/gi, "EP")
    .replace(/\bsilver pieces?\b/gi, "SP")
    .replace(/\bcopper pieces?\b/gi, "CP")
    .replace(/\bplatinum\b/gi, "PP")
    .replace(/\bgold\b/gi, "GP")
    .replace(/\belectrum\b/gi, "EP")
    .replace(/\bsilver\b/gi, "SP")
    .replace(/\bcopper\b/gi, "CP")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const currencyMatch = normalized.match(/^(\d+)\s*(GP|CP|SP|EP|PP)$/i);
  return currencyMatch ? (currencyMatch[2].toUpperCase() as "PP" | "GP" | "EP" | "SP" | "CP") : null;
}

function resolveToolPlaceholder(name: string, grantedTools: string[]): string | null {
  const normalized = String(name ?? "").trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  const chosenToolReference = /\b(?:same as above|chosen for the tool proficiency above)\b/i.test(normalized);
  const wantsInstrument = /\bmusical instrument\b/i.test(normalized);
  const wantsArtisanTool = /\bartisan'?s tools?\b/i.test(normalized);
  if (!chosenToolReference && !/\bof your choice\b/i.test(normalized)) return null;

  const instrumentChoices = grantedTools.filter((tool) => MUSICAL_INSTRUMENTS.includes(tool));
  const artisanChoices = grantedTools.filter((tool) => !MUSICAL_INSTRUMENTS.includes(tool));

  if (wantsInstrument && instrumentChoices.length === 1) return instrumentChoices[0];
  if (wantsArtisanTool && artisanChoices.length === 1) return artisanChoices[0];
  if (grantedTools.length === 1) return grantedTools[0];
  return null;
}


function parseEquipmentEntry(entry: string): { quantity: number; name: string } {
  const qtyMatch = entry.match(/^(\d+)\s*[x×]\s+(.+)$/i) || entry.match(/^(\d+)\s+(.+)$/);
  if (qtyMatch) return { quantity: Number(qtyMatch[1]) || 1, name: qtyMatch[2].trim() };
  return { quantity: 1, name: entry.trim() };
}

export function collectEquipmentLookupNames(
  optionId: string | null,
  equipmentText: string | undefined,
  grantedTools: string[],
): string[] {
  const options = parseStartingEquipmentOptions(equipmentText);
  const selected = options.find((option) => option.id === optionId);
  if (!selected) return [];

  const names: string[] = [];
  for (const entry of selected.entries) {
    const normalized = entry.trim();
    if (!normalized) continue;
    if (currencyCodeFromEntry(normalized)) continue;

    const parsed = parseEquipmentEntry(normalized);
    const resolvedPlaceholder = resolveToolPlaceholder(parsed.name, grantedTools);
    if (resolvedPlaceholder) {
      names.push(resolvedPlaceholder);
      continue;
    }
    if (/\b(?:same as above|chosen for the tool proficiency above)\b/i.test(parsed.name)) {
      continue;
    }
    if (/^tool:/i.test(parsed.name)) {
      const toolName = parsed.name.replace(/^tool:\s*/i, "").trim();
      if (grantedTools.some((tool) => tool.toLowerCase() === toolName.toLowerCase())) continue;
      names.push(toolName);
      continue;
    }

    names.push(parsed.name);
  }

  return names;
}
function isUnresolvedEquipmentPlaceholder(name: string): boolean {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (!normalized) return true;
  return /\b(?:choose|choice|of your choice|any one|one of your choice|same as above|tool proficiency above)\b/.test(normalized)
    || /\b(?:artisan'?s tools?|musical instrument|gaming set)\b/.test(normalized)
    || /\b(?:focus|holy symbol|druidic focus)\b/.test(normalized) && /\bof your choice\b/.test(normalized)
    || /\bor\b/.test(normalized) && !/\b(?:armor|shield|pack|dagger|club|spear|quarterstaff|crossbow|bow|rapier|scimitar|sickle|mace|javelin|book|robe|clothes|rope|torch|rations|waterskin|bedroll|pot|shovel)\b/.test(normalized);
}

export function buildEquipmentItems(
  optionId: string | null,
  equipmentText: string | undefined,
  prefix: string,
  grantedTools: string[],
  itemIndex: ItemSummaryLike[],
): InventoryItemSeedLike[] {
  const options = parseStartingEquipmentOptions(equipmentText);
  const selected = options.find((option) => option.id === optionId);
  if (!selected) return [];

  const seeds: InventoryItemSeedLike[] = [];
  let autoId = 1;

  function pushItem(name: string, quantity: number) {
    const trimmed = name.trim();
    if (!trimmed || quantity <= 0) return;
    const matched = resolveStartingInventoryItem(trimmed, itemIndex);
    if (!matched && isUnresolvedEquipmentPlaceholder(trimmed)) return;
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
    };
    const isWeapon = Boolean(matched?.type && /weapon/i.test(matched.type));
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

  for (const entry of selected.entries) {
    const normalized = entry.trim();
    if (!normalized) continue;
    const currencyCode = currencyCodeFromEntry(normalized);
    if (currencyCode) {
      const amount = Number(normalized.match(/^(\d+)/)?.[1] ?? "0");
      pushCurrency(currencyCode, amount);
      continue;
    }

    const parsed = parseEquipmentEntry(normalized);
    const resolvedPlaceholder = resolveToolPlaceholder(parsed.name, grantedTools);
    if (resolvedPlaceholder) {
      pushItem(resolvedPlaceholder, parsed.quantity);
      continue;
    }
    if (/\b(?:same as above|chosen for the tool proficiency above)\b/i.test(parsed.name)) {
      continue;
    }
    if (/^tool:/i.test(parsed.name)) {
      const toolName = parsed.name.replace(/^tool:\s*/i, "").trim();
      if (grantedTools.some((tool) => tool.toLowerCase() === toolName.toLowerCase())) continue;
      pushItem(toolName, parsed.quantity);
      continue;
    }

    pushItem(parsed.name, parsed.quantity);
  }

  return seeds;
}
