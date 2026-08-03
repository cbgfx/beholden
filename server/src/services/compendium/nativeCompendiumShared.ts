import { normalizeKey } from "../../lib/text.js";
import type { JsonRecord } from "../../lib/jsonRecord.js";
import type { NativeCompendiumCategory } from "@beholden/shared/domain/compendium/nativeCompendiumKey";

export const BEHOLDEN_COMPENDIUM_FORMAT = "beholden.compendium";
export const BEHOLDEN_COMPENDIUM_SCHEMA = "grand";

export type NativeCompendiumBatch = {
  format: typeof BEHOLDEN_COMPENDIUM_FORMAT;
  schema: typeof BEHOLDEN_COMPENDIUM_SCHEMA;
  category: NativeCompendiumCategory;
  exportedAt: string;
  entries: JsonRecord[];
};

export type NativeCompendiumBundle = {
  format: typeof BEHOLDEN_COMPENDIUM_FORMAT;
  schema: typeof BEHOLDEN_COMPENDIUM_SCHEMA;
  exportedAt: string;
} & Partial<Record<NativeCompendiumCategory, JsonRecord[]>>;

export type NativeCompendiumDocument = NativeCompendiumBatch | NativeCompendiumBundle;
export type NativeCompendiumImportResult = { category: NativeCompendiumCategory; imported: number; total: number };
export type NativeCompendiumDocumentImportResult = { imported: number; total: number; batches: NativeCompendiumImportResult[] };
export type NativeCompendiumPreview = {
  entries: number;
  additions: number;
  replacements: number;
  changed: number;
  unchanged: number;
  batches: Array<{
    category: NativeCompendiumCategory;
    entries: number;
    additions: number;
    replacements: number;
    changed: number;
    unchanged: number;
  }>;
};

export function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as JsonRecord;
}

export function requiredText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

export function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function integer(value: unknown, fallback = 0): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export function parseJsonRecord(value: unknown): JsonRecord {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {};
  } catch { return {}; }
}

export function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

export function makeId(prefix: string, name: string): string {
  const key = normalizeKey(name).replace(/[^a-z0-9[\].'()-]+/giu, "_").replace(/^_+|_+$/gu, "");
  return `${prefix}${key || "entry"}`;
}

export function idOrGenerated(entry: JsonRecord, prefix: string, name: string): string {
  return optionalText(entry.id) ?? makeId(prefix, name);
}

export function canonicalNameKey(entry: JsonRecord, name: string): string {
  return optionalText(entry.nameKey ?? entry.name_key) ?? normalizeKey(name);
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}
