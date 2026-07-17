import type { StoredCharacterSheetState } from "../server/userData.js";

function optionalText(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function positiveInt(value: unknown): number | undefined {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function primaryClass(characterData: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!Array.isArray(characterData?.classes)) return null;
  return characterData.classes.map(record).find(Boolean) ?? null;
}

/**
 * Persist only authored or client-derived facts. Rules are resolved by the player
 * from canonical compendium data; the server must never reconstruct them from names.
 */
export function normalizeCharacterSheetForStorage(
  sheet: StoredCharacterSheetState,
  characterData: Record<string, unknown> | null,
): { sheet: StoredCharacterSheetState; characterData: Record<string, unknown> | null } {
  const selectedClass = primaryClass(characterData);
  const className = sheet.className && sheet.className !== sheet.name
    ? sheet.className
    : optionalText(selectedClass?.className) ?? sheet.className;
  const species = sheet.species || optionalText(characterData?.raceName) || sheet.species;
  const derivedAc = positiveInt(characterData?.derivedAc);

  return {
    sheet: {
      ...sheet,
      className,
      species,
      ac: derivedAc ?? sheet.ac,
    },
    characterData,
  };
}

export function normalizeCharacterSheetForRead(
  sheet: StoredCharacterSheetState,
  characterData: Record<string, unknown> | null,
): { sheet: StoredCharacterSheetState; characterData: Record<string, unknown> | null } {
  return normalizeCharacterSheetForStorage(sheet, characterData);
}
