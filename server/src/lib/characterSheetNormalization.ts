import type { StoredCharacterSheetState } from "../server/userData.js";

const CLASS_HIT_DICE: Record<string, number> = {
  barbarian: 12,
  fighter: 10,
  paladin: 10,
  ranger: 10,
  artificer: 8,
  bard: 8,
  cleric: 8,
  druid: 8,
  monk: 8,
  rogue: 8,
  warlock: 8,
  sorcerer: 6,
  wizard: 6,
};

const RACE_SPEEDS: Record<string, number> = {
  human: 30,
  elf: 30,
  dwarf: 30,
  halfling: 30,
  gnome: 30,
  dragonborn: 30,
  tiefling: 30,
  orc: 30,
  "half elf": 30,
  "half orc": 30,
};

function optionalText(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function lowerLookup(value: unknown): string {
  return optionalText(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

function positiveIntOrUndefined(value: unknown): number | undefined {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function primaryClassRecord(characterData: Record<string, unknown> | null): Record<string, unknown> | null {
  const classes = characterData?.classes;
  if (!Array.isArray(classes)) return null;
  return classes.map(asPlainRecord).find(Boolean) ?? null;
}

function inferHitDie(...values: unknown[]): number | undefined {
  for (const value of values) {
    const key = lowerLookup(value);
    if (!key) continue;
    const match = Object.entries(CLASS_HIT_DICE).find(([name]) => key.includes(name));
    if (match) return match[1];
  }
  return undefined;
}

function inferRaceName(...values: unknown[]): string | undefined {
  for (const value of values) {
    const key = lowerLookup(value);
    if (!key) continue;
    const match = Object.keys(RACE_SPEEDS).find((name) => key.includes(name));
    if (match) return match.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return undefined;
}

function inferRaceSpeed(...values: unknown[]): number | undefined {
  for (const value of values) {
    const key = lowerLookup(value);
    if (/\bwood elf\b/.test(key) || /\belf wood\b/.test(key)) return 35;
  }
  const race = inferRaceName(...values);
  return race ? RACE_SPEEDS[race.toLowerCase()] : undefined;
}

function calcBaseHp(hitDie: number, level: number, conScore: number | null): number {
  const conMod = conScore == null ? 0 : Math.floor((conScore - 10) / 2);
  return Math.max(1, hitDie + conMod + Math.max(0, level - 1) * (Math.floor(hitDie / 2) + 1 + conMod));
}

function abilityMod(score: number | null): number {
  return score == null ? 0 : Math.floor((score - 10) / 2);
}

function getEquipState(item: Record<string, unknown>): string {
  return optionalText(item.equipState) ?? (item.equipped ? "worn" : "backpack");
}

function isArmorItem(item: Record<string, unknown>): boolean {
  const type = optionalText(item.type);
  return Boolean(type && /\barmor\b/i.test(type) && !/\bshield\b/i.test(type));
}

function isShieldItem(item: Record<string, unknown>): boolean {
  const name = optionalText(item.name);
  const type = optionalText(item.type);
  return Boolean((type && /\bshield\b/i.test(type)) || (name && /\bshield\b/i.test(name)));
}

function inventoryRecords(characterData: Record<string, unknown> | null): Record<string, unknown>[] {
  return Array.isArray(characterData?.inventory)
    ? characterData.inventory.map(asPlainRecord).filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : [];
}

function hasFeatureName(characterData: Record<string, unknown> | null, pattern: RegExp): boolean {
  const selected = Array.isArray(characterData?.selectedFeatureNames) ? characterData.selectedFeatureNames : [];
  return selected.some((value) => pattern.test(String(value ?? "")));
}

function deriveArmorClassSummary(
  sheet: StoredCharacterSheetState,
  characterData: Record<string, unknown> | null,
  className: string,
): number {
  const dexMod = abilityMod(sheet.dexScore);
  const conMod = abilityMod(sheet.conScore);
  const inventory = inventoryRecords(characterData);
  const wornArmor = inventory.find((item) => getEquipState(item) === "worn" && isArmorItem(item) && positiveIntOrUndefined(item.ac));
  const wornShield = inventory.find((item) => getEquipState(item) === "offhand" && isShieldItem(item));
  const shieldBonus = wornShield ? 2 : 0;
  const armorAc = (() => {
    const armorBase = positiveIntOrUndefined(wornArmor?.ac);
    if (!wornArmor || !armorBase) return undefined;
    const type = String(wornArmor.type ?? "").toLowerCase();
    if (type.includes("heavy")) return armorBase;
    if (type.includes("medium")) return armorBase + Math.min(2, dexMod);
    return armorBase + dexMod;
  })();
  const hasBarbarianUnarmoredDefense =
    hasFeatureName(characterData, /\bunarmored defense\b/i)
    || (lowerLookup(className).includes("barbarian") && sheet.level >= 1);
  const unarmoredAc = hasBarbarianUnarmoredDefense
    ? 10 + dexMod + conMod
    : undefined;
  return Math.max(10 + dexMod, armorAc ?? 0, unarmoredAc ?? 0) + shieldBonus;
}

function deriveSpeedSummary(
  sheet: StoredCharacterSheetState,
  characterData: Record<string, unknown> | null,
  species: string,
  className: string,
): number {
  const primaryClass = primaryClassRecord(characterData);
  const inferredRaceSpeed = inferRaceSpeed(species, characterData?.raceName, characterData?.raceId, characterData?.speciesId);
  const baseSpeed = inferredRaceSpeed ?? sheet.speed;
  const inventory = inventoryRecords(characterData);
  const wornArmor = inventory.find((item) => getEquipState(item) === "worn" && isArmorItem(item));
  const wearingHeavyArmor = Boolean(wornArmor && /\bheavy armor\b/i.test(String(wornArmor.type ?? "")));
  const hasFastMovement =
    hasFeatureName(characterData, /\bfast movement\b/i)
    || (lowerLookup(className).includes("barbarian") && sheet.level >= 5)
    || (lowerLookup(primaryClass?.className).includes("barbarian") && sheet.level >= 5);
  const hasRoving =
    hasFeatureName(characterData, /\broving\b/i)
    || (lowerLookup(className).includes("ranger") && sheet.level >= 6)
    || (lowerLookup(primaryClass?.className).includes("ranger") && sheet.level >= 6);
  const speedBonus = !wearingHeavyArmor
    ? (hasFastMovement ? 10 : 0) + (hasRoving ? 10 : 0)
    : 0;
  return baseSpeed + (inferredRaceSpeed ? speedBonus : 0);
}

export function normalizeCharacterSheetForStorage(
  sheet: StoredCharacterSheetState,
  characterData: Record<string, unknown> | null,
): { sheet: StoredCharacterSheetState; characterData: Record<string, unknown> | null } {
  const primaryClass = primaryClassRecord(characterData);
  const className =
    sheet.className && sheet.className !== sheet.name
      ? sheet.className
      : optionalText(primaryClass?.className) ?? sheet.className;
  const species =
    sheet.species
      || inferRaceName(characterData?.raceName, characterData?.raceId, characterData?.speciesId)
      || sheet.species;
  const hitDie = positiveIntOrUndefined(characterData?.hd)
    ?? inferHitDie(className, primaryClass?.className, primaryClass?.classId);
  const normalizedCharacterData =
    characterData && hitDie && !positiveIntOrUndefined(characterData.hd)
      ? { ...characterData, hd: hitDie }
      : characterData;
  const normalizedSheet: StoredCharacterSheetState = {
    ...sheet,
    className,
    species,
  };
  return {
    sheet: {
      ...normalizedSheet,
      ac: deriveArmorClassSummary(normalizedSheet, normalizedCharacterData, className),
      speed: deriveSpeedSummary(normalizedSheet, normalizedCharacterData, species, className),
    },
    characterData: normalizedCharacterData,
  };
}

export function normalizeCharacterSheetForRead(
  sheet: StoredCharacterSheetState,
  characterData: Record<string, unknown> | null,
): { sheet: StoredCharacterSheetState; characterData: Record<string, unknown> | null } {
  const normalized = normalizeCharacterSheetForStorage(sheet, characterData);
  const hitDie = positiveIntOrUndefined(normalized.characterData?.hd);
  const inferredBaseHp = hitDie
    ? calcBaseHp(hitDie, normalized.sheet.level, normalized.sheet.conScore)
    : 0;
  return {
    ...normalized,
    sheet: {
      ...normalized.sheet,
      hpMax:
        normalized.sheet.hpMax > 0 && normalized.sheet.hpMax < inferredBaseHp
          ? inferredBaseHp
          : normalized.sheet.hpMax,
    },
  };
}
