import type { CSSProperties } from "react";
import { C } from "@/lib/theme";

export const LS_KEY = "beholden:lastOpened";
export const CHARACTER_EXPORT_FORMAT = "beholden.character";
export const CHARACTER_EXPORT_VERSION = 1;

export function readLastOpened(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
}

export function touchLastOpened(id: string) {
  const map = readLastOpened();
  map[id] = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}

export interface Campaign {
  id: string;
  name: string;
  updatedAt: number;
  playerCount: number;
  imageUrl: string | null;
}

export interface CharacterCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

export interface UserCharacter {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  color: string | null;
  imageUrl: string | null;
  campaigns: CharacterCampaign[];
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

export function intOrFallback(value: unknown, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveIntOrUndefined(value: unknown): number | undefined {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function parseAbilityScore(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return undefined;
  return clamp(parsed, 1, 30);
}

function parseCharacterData(value: unknown): Record<string, unknown> | null | undefined {
  if (value === null) return null;
  return asRecord(value) ?? undefined;
}

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

function normalizeCompendiumName(value: unknown): string | undefined {
  const text = optionalString(value);
  if (!text) return undefined;
  return text
    .replace(/^[a-z]+_+/i, "")
    .replace(/[_:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function lowerLookup(value: unknown): string {
  return optionalString(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

function primaryClassRecord(characterData: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const classes = characterData?.classes;
  if (!Array.isArray(classes)) return null;
  return classes.map(asRecord).find(Boolean) ?? null;
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

function calcBaseHp(hitDie: number, level: number, conMod: number): number {
  return Math.max(1, hitDie + conMod + Math.max(0, level - 1) * (Math.floor(hitDie / 2) + 1 + conMod));
}

function abilityMod(score: unknown): number {
  const parsed = Number(score);
  return Number.isFinite(parsed) ? Math.floor((parsed - 10) / 2) : 0;
}

function getEquipState(item: Record<string, unknown>): string {
  return optionalString(item.equipState) ?? (item.equipped ? "worn" : "backpack");
}

function isArmorItem(item: Record<string, unknown>): boolean {
  const type = optionalString(item.type);
  return Boolean(type && /\barmor\b/i.test(type) && !/\bshield\b/i.test(type));
}

function isShieldItem(item: Record<string, unknown>): boolean {
  const name = optionalString(item.name);
  const type = optionalString(item.type);
  return Boolean((type && /\bshield\b/i.test(type)) || (name && /\bshield\b/i.test(name)));
}

function inventoryRecords(characterData: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  return Array.isArray(characterData?.inventory)
    ? characterData.inventory.map(asRecord).filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : [];
}

function hasFeatureName(characterData: Record<string, unknown> | null | undefined, pattern: RegExp): boolean {
  const selected = Array.isArray(characterData?.selectedFeatureNames) ? characterData.selectedFeatureNames : [];
  return selected.some((value) => pattern.test(String(value ?? "")));
}

function deriveArmorClassSummary(raw: Record<string, unknown>, characterData: Record<string, unknown> | null | undefined): number | undefined {
  const dexMod = abilityMod(raw.dexScore);
  const conMod = abilityMod(raw.conScore);
  const primaryClass = primaryClassRecord(characterData);
  const level = clamp(intOrFallback(raw.level, intOrFallback(primaryClass?.level, 1)), 1, 20);
  const className = optionalString(raw.className) ?? optionalString(primaryClass?.className) ?? normalizeCompendiumName(primaryClass?.classId);
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
    || (lowerLookup(className).includes("barbarian") && level >= 1);
  const unarmoredAc = hasBarbarianUnarmoredDefense
    ? 10 + dexMod + conMod
    : undefined;
  const naturalAc = 10 + dexMod;
  return Math.max(naturalAc, armorAc ?? 0, unarmoredAc ?? 0) + shieldBonus;
}

function deriveSpeedSummary(raw: Record<string, unknown>, characterData: Record<string, unknown> | null | undefined): number | undefined {
  const primaryClass = primaryClassRecord(characterData);
  const level = clamp(intOrFallback(raw.level, intOrFallback(primaryClass?.level, 1)), 1, 20);
  const inferredRaceSpeed = inferRaceSpeed(raw.species, characterData?.raceName, characterData?.raceId, characterData?.speciesId);
  const baseSpeed = inferredRaceSpeed ?? intOrFallback(raw.speed, 30);
  const inventory = inventoryRecords(characterData);
  const wornArmor = inventory.find((item) => getEquipState(item) === "worn" && isArmorItem(item));
  const wearingHeavyArmor = Boolean(wornArmor && /\bheavy armor\b/i.test(String(wornArmor.type ?? "")));
  const className = optionalString(raw.className) ?? optionalString(primaryClass?.className) ?? normalizeCompendiumName(primaryClass?.classId);
  const hasFastMovement =
    hasFeatureName(characterData, /\bfast movement\b/i)
    || (lowerLookup(className).includes("barbarian") && level >= 5);
  const hasRoving =
    hasFeatureName(characterData, /\broving\b/i)
    || (lowerLookup(className).includes("ranger") && level >= 6);
  const speedBonus = !wearingHeavyArmor
    ? (hasFastMovement ? 10 : 0) + (hasRoving ? 10 : 0)
    : 0;
  return baseSpeed + (inferredRaceSpeed ? speedBonus : 0);
}

export function finalizeDerivedSheetSummaries(raw: Record<string, unknown>, characterData: Record<string, unknown> | null | undefined): { ac: number; speed: number } {
  return {
    ac: deriveArmorClassSummary(raw, characterData) ?? intOrFallback(raw.ac, 10),
    speed: deriveSpeedSummary(raw, characterData) ?? intOrFallback(raw.speed, 30),
  };
}

function isToughReference(value: unknown): boolean {
  return lowerLookup(value).includes("tough");
}

function cloneCharacterDataWithFixes(
  characterData: Record<string, unknown> | null | undefined,
  className: string | undefined,
  hitDie: number | undefined,
): Record<string, unknown> | null | undefined {
  if (characterData === null) return null;
  if (!characterData) return characterData;

  const next: Record<string, unknown> = { ...characterData };
  if (hitDie && !positiveIntOrUndefined(next.hd)) next.hd = hitDie;

  if (Array.isArray(next.classes) && next.classes.length > 0) {
    next.classes = next.classes.map((entry, index) => {
      const record = asRecord(entry);
      if (!record || index > 0) return entry;
      return {
        ...record,
        className: optionalString(record.className) ?? className ?? normalizeCompendiumName(record.classId),
      };
    });
  }

  return next;
}

export function normalizeCharacterTransfer(raw: Record<string, unknown>): Record<string, unknown> {
  const characterData = parseCharacterData(raw.characterData);
  const primaryClass = primaryClassRecord(characterData);
  const name = optionalString(raw.name);
  const rawClassName = optionalString(raw.className);
  const className =
    rawClassName && rawClassName !== name
      ? rawClassName
      : optionalString(primaryClass?.className) ?? normalizeCompendiumName(primaryClass?.classId) ?? rawClassName;
  const species =
    optionalString(raw.species)
      ?? inferRaceName(characterData?.raceName, characterData?.raceId, characterData?.speciesId);
  const hitDie =
    positiveIntOrUndefined(characterData?.hd) ?? inferHitDie(className, primaryClass?.className, primaryClass?.classId);
  const level = clamp(intOrFallback(raw.level, intOrFallback(primaryClass?.level, 1)), 1, 20);
  const conScore = parseAbilityScore(raw.conScore);
  const conMod = conScore == null ? 0 : Math.floor((conScore - 10) / 2);
  const importedHpMax = Math.max(0, intOrFallback(raw.hpMax, 0));
  const inferredBaseHp = hitDie ? calcBaseHp(hitDie, level, conMod) : 0;
  const hpMax = importedHpMax > 0 && importedHpMax < inferredBaseHp ? inferredBaseHp : importedHpMax;
  const hasTough =
    isToughReference(characterData?.chosenRaceFeatId)
    || (Array.isArray(characterData?.chosenLevelUpFeats) && characterData.chosenLevelUpFeats.some(isToughReference))
    || (Array.isArray(characterData?.feats) && characterData.feats.some(isToughReference));
  const effectiveHpMax = hpMax + (hasTough ? level * 2 : 0);
  const hpCurrent = clamp(Math.max(0, intOrFallback(raw.hpCurrent, effectiveHpMax || hpMax)), 0, Math.max(effectiveHpMax, hpMax));
  const finalized = finalizeDerivedSheetSummaries({ ...raw, className, species, level }, characterData);

  return {
    ...raw,
    className,
    species,
    level,
    hpMax,
    hpCurrent,
    ac: finalized.ac,
    speed: finalized.speed,
    characterData: cloneCharacterDataWithFixes(characterData, className, hitDie || undefined),
  };
}

export function buildCharacterCreatePayload(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw);
  if (!root) throw new Error("Import file must be a JSON object.");
  const candidate = normalizeCharacterTransfer(asRecord(root.character) ?? root);
  const name = optionalString(candidate.name);
  if (!name) throw new Error("Import file is missing `name`.");

  const hpMax = Math.max(0, intOrFallback(candidate.hpMax, 0));
  const level = clamp(intOrFallback(candidate.level, 1), 1, 20);
  const hpCurrent = Math.max(0, intOrFallback(candidate.hpCurrent, hpMax));

  return {
    name,
    playerName: optionalString(candidate.playerName),
    className: optionalString(candidate.className),
    species: optionalString(candidate.species),
    level,
    hpMax,
    hpCurrent,
    ac: intOrFallback(candidate.ac, 10),
    speed: intOrFallback(candidate.speed, 30),
    strScore: parseAbilityScore(candidate.strScore),
    dexScore: parseAbilityScore(candidate.dexScore),
    conScore: parseAbilityScore(candidate.conScore),
    intScore: parseAbilityScore(candidate.intScore),
    wisScore: parseAbilityScore(candidate.wisScore),
    chaScore: parseAbilityScore(candidate.chaScore),
    color: optionalString(candidate.color),
    characterData: parseCharacterData(candidate.characterData),
  };
}

export function sanitizeFilenamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "character";
}

export function buildExportFilename(name: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${sanitizeFilenamePart(name)}-${stamp}.beholden-character.json`;
}

export const exportIconButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.07)",
  color: C.text,
  display: "inline-grid",
  placeItems: "center",
  cursor: "pointer",
  transition: "background 0.12s, border-color 0.12s",
};
