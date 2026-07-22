export type { JsonRecord } from "../../lib/jsonRecord.js";
export { record, list, text, number } from "../../lib/jsonRecord.js";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_NAMES = new Map([
  ["strength", "str"], ["dexterity", "dex"], ["constitution", "con"],
  ["intelligence", "int"], ["wisdom", "wis"], ["charisma", "cha"],
]);

export function abilityKey(value: unknown): typeof ABILITIES[number] | null {
  const raw = String(value ?? "").trim().toLowerCase() || null;
  if (!raw) return null;
  if ((ABILITIES as readonly string[]).includes(raw)) {
    return raw as typeof ABILITIES[number];
  }
  return (ABILITY_NAMES.get(raw) as typeof ABILITIES[number] | undefined) ?? null;
}

export function split(value: unknown): string[] {
  return String(value ?? "").split(/[,;]/u).map((part) => part.trim()).filter(Boolean);
}
