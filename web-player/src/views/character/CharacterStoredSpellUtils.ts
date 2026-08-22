import type { ItemSpellTemplate, ItemSpellTemplates, StoredItemSpell } from "@/views/character/CharacterInventoryTypes";

export type StoredSpellTemplate = Extract<ItemSpellTemplate, { kind: "stored" }>;

export function getStoredSpellTemplate(value: ItemSpellTemplates | null | undefined): StoredSpellTemplate | null {
  const templates = Array.isArray(value) ? value : value ? [value] : [];
  return templates.find((template): template is StoredSpellTemplate => template.kind === "stored") ?? null;
}

export function storedSpellLevelsUsed(spells: StoredItemSpell[] | null | undefined): number {
  return (spells ?? []).reduce((total, spell) => total + Math.max(0, spell.slotLevel), 0);
}

export function validStoredSlotLevels(template: StoredSpellTemplate, spellLevel: number, levelsUsed: number): number[] {
  const minimum = Math.max(spellLevel, template.minLevel ?? 1);
  const maximum = Math.min(template.maxLevel ?? 9, template.capacity - levelsUsed);
  return Array.from({ length: Math.max(0, maximum - minimum + 1) }, (_, index) => minimum + index);
}
