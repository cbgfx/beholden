import { z } from "zod";
import { CAMPAIGN_EXPORT_FORMAT, CAMPAIGN_EXPORT_VERSION, CampaignDocumentV3Schema, type CampaignDocumentV3 } from "./schemas.js";

type JsonRecord = Record<string, unknown>;

// MARK: - Migrate Campaign Document
/**
 * Brings any supported campaign export up to the current (v3) shape and validates it.
 *
 * Old versions are migrated here, once, instead of the importer carrying a reader per version.
 * When a future version changes the document, add one `migrateVnToVn+1` step below and keep the
 * importer reading only the newest shape.
 */
export function migrateCampaignDocument(raw: unknown): CampaignDocumentV3 {
  const doc = asRecord(raw);
  if (!doc) throw new Error("Campaign export must be a JSON object.");

  const version = doc["version"];
  if (version === CAMPAIGN_EXPORT_VERSION) {
    if (doc["format"] !== CAMPAIGN_EXPORT_FORMAT) throw new Error(`Campaign v3 requires format "${CAMPAIGN_EXPORT_FORMAT}".`);
    return validate(doc);
  }
  // Unversioned files predate the version field and have the same shape as v1/v2.
  if (version === undefined || version === 1 || version === 2) {
    return validate(migrateLegacyToV3(doc));
  }
  throw new Error(`Unsupported campaign export version: ${String(version)}.`);
}

// MARK: - v1/v2 -> v3
/**
 * v1 and v2 files were read by the same lenient importer, so they share one migration. It
 * applies the leniency that importer had, as explicit steps, so v3 can be strict:
 * - collections could be arrays or id-keyed objects; v3 uses id-keyed objects
 * - treasure used `typeKey` in some files; v3 uses `type_key`
 * - treasure quantities were rounded and clamped to at least 1
 * - notes and treasure pointing at an adventure/encounter missing from the file were detached
 */
function migrateLegacyToV3(doc: JsonRecord): JsonRecord {
  const adventures = keyById(doc["adventures"], "id");
  const encounters = keyById(doc["encounters"], "id");

  const notes = mapValues(keyById(doc["notes"], "id"), (note) => ({
    ...note,
    adventureId: knownId(note["adventureId"], adventures),
  }));

  const treasure = mapValues(keyById(doc["treasure"], "id"), (entry) => {
    const { typeKey, ...rest } = entry;
    const qty = typeof entry["qty"] === "number" && Number.isFinite(entry["qty"]) ? Math.max(1, Math.round(entry["qty"])) : entry["qty"];
    return {
      ...rest,
      type_key: entry["type_key"] ?? typeKey ?? null,
      qty,
      adventureId: knownId(entry["adventureId"], adventures),
      encounterId: knownId(entry["encounterId"], encounters),
    };
  });

  return {
    ...doc,
    format: CAMPAIGN_EXPORT_FORMAT,
    version: CAMPAIGN_EXPORT_VERSION,
    adventures,
    encounters,
    players: keyById(doc["players"], "id"),
    inpcs: keyById(doc["inpcs"], "id"),
    notes,
    partyInventory: keyById(doc["partyInventory"], "id"),
    treasure,
    conditions: keyById(doc["conditions"], "id"),
    bastions: keyById(doc["bastions"], "id"),
    combats: keyById(doc["combats"], "encounterId"),
  };
}

// MARK: - Helpers
/** Parses against the v3 contract, reporting problems as readable "path: message" lines for the upload response. */
function validate(doc: JsonRecord): CampaignDocumentV3 {
  const result = CampaignDocumentV3Schema.safeParse(doc);
  if (result.success) return result.data;
  throw new Error(`Invalid campaign export:\n${z.prettifyError(result.error)}`);
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

/** Turns an array or keyed object into an object keyed by `idField`. Non-objects are left for the schema to reject. */
function keyById(value: unknown, idField: string): Record<string, JsonRecord> {
  if (value === undefined || value === null) return {};
  const entries = Array.isArray(value) ? value : asRecord(value) ? Object.values(value as JsonRecord) : null;
  if (!entries) return value as Record<string, JsonRecord>;
  const out: Record<string, JsonRecord> = {};
  for (const [index, entry] of entries.entries()) {
    const record = asRecord(entry);
    const id = record?.[idField];
    // An entry without a usable id keeps a placeholder key so the schema reports it instead of it vanishing.
    out[typeof id === "string" && id ? id : `#${index}`] = (record ?? entry) as JsonRecord;
  }
  return out;
}

function mapValues(records: Record<string, JsonRecord>, fn: (entry: JsonRecord) => JsonRecord): Record<string, JsonRecord> {
  return Object.fromEntries(Object.entries(records).map(([key, entry]) => [key, asRecord(entry) ? fn(entry) : entry]));
}

/** Keeps a parent id only when that parent is part of the same file. */
function knownId(value: unknown, parents: Record<string, unknown>): unknown {
  if (value === undefined || value === null) return null;
  return typeof value === "string" && parents[value] ? value : null;
}
