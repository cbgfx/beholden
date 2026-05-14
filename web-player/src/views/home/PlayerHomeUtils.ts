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

export function buildCharacterCreatePayload(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw);
  if (!root) throw new Error("Import file must be a JSON object.");
  const candidate = asRecord(root.character) ?? root;
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
