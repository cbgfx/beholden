import type { CSSProperties } from "react";
import { C } from "@/lib/theme";

const LS_KEY = "beholden:lastOpened";
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
  color?: string | null;
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
  ruleset?: "5e" | "5.5e";
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function intOrFallback(value: unknown, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveIntOrUndefined(value: unknown): number | undefined {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseAbilityScore(value: unknown): number | null | undefined {
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

function primaryClassRecord(characterData: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const classes = characterData?.classes;
  if (!Array.isArray(classes)) return null;
  return classes.map(asRecord).find(Boolean) ?? null;
}

function calcBaseHp(hitDie: number, level: number, conMod: number): number {
  return Math.max(1, hitDie + conMod + Math.max(0, level - 1) * (Math.floor(hitDie / 2) + 1 + conMod));
}

function finalizeDerivedSheetSummaries(raw: Record<string, unknown>, characterData: Record<string, unknown> | null | undefined): { ac: number; speed: number } {
  void characterData;
  return {
    ac: intOrFallback(raw.ac, 10),
    speed: intOrFallback(raw.speed, 30),
  };
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
      ?? normalizeCompendiumName(characterData?.raceName ?? characterData?.raceId ?? characterData?.speciesId);
  const hitDie = positiveIntOrUndefined(characterData?.hd);
  const level = clamp(intOrFallback(raw.level, intOrFallback(primaryClass?.level, 1)), 1, 20);
  const conScore = parseAbilityScore(raw.conScore);
  const conMod = conScore == null ? 0 : Math.floor((conScore - 10) / 2);
  const importedHpMax = Math.max(0, intOrFallback(raw.hpMax, 0));
  const inferredBaseHp = hitDie ? calcBaseHp(hitDie, level, conMod) : 0;
  const hpMax = importedHpMax > 0 && importedHpMax < inferredBaseHp ? inferredBaseHp : importedHpMax;
  const storedDerivedHpMax = Number(characterData?.derivedHpMax);
  const effectiveHpMax = Number.isFinite(storedDerivedHpMax) && storedDerivedHpMax >= 1
    ? Math.floor(storedDerivedHpMax)
    : hpMax;
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

function sanitizeFilenamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "character";
}

export function buildExportFilename(name: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${sanitizeFilenamePart(name)}-${stamp}.json`;
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
