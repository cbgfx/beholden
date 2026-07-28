import {
  NATIVE_COMPENDIUM_CATEGORIES,
  isNativeCompendiumCategory,
  nativeEntryKey,
  type NativeCompendiumCategory,
} from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import { computeContentHash } from "@beholden/shared/domain/compendium/computeContentHash";
import { api, jsonInit } from "@/services/api";

type JsonRecord = Record<string, unknown>;
type CategoryBatch = { category: NativeCompendiumCategory; entries: JsonRecord[] };

const MANIFEST_VERSION = 1;

/** Mirrors just enough of the server's parseNativeCompendiumDocument category detection to know
 * which shape we're looking at: a flat bundle (multiple categories as top-level arrays) or a
 * single-category batch (`{category, entries}`). Returns null for anything unrecognized so the
 * caller can fall back to uploading the file unfiltered rather than guessing. */
function extractCategoryBatches(document: unknown): CategoryBatch[] | null {
  if (!document || typeof document !== "object" || Array.isArray(document)) return null;
  const root = document as JsonRecord;

  const flatCategories = NATIVE_COMPENDIUM_CATEGORIES.filter((category) => root[category] !== undefined);
  if (flatCategories.length > 0) {
    return flatCategories
      .filter((category) => Array.isArray(root[category]))
      .map((category) => ({ category, entries: root[category] as JsonRecord[] }));
  }

  const category = String(root.category ?? "");
  if (!isNativeCompendiumCategory(category) || !Array.isArray(root.entries)) return null;
  return [{ category, entries: root.entries as JsonRecord[] }];
}

export type NativeCompendiumManifestFilterResult = {
  /** The document to actually upload -- same top-level shape as the input, with each category's
   * entries pared down to only what the server doesn't already have byte-identically. Falls back
   * to the original, unfiltered document (never a subset) for any category where the manifest
   * lookup couldn't run, so this optimization can never silently drop content. */
  document: unknown;
  /** Entries excluded across all categories because the server already has them, unchanged. */
  skipped: number;
  total: number;
};

/** Before uploading a native compendium file, ask the server which entries it doesn't already
 * have byte-identically (see resolveNativeCompendiumManifest in nativeCompendium.ts) and drop the
 * rest -- the actual upload egress reduction the compendium diff feature was built for. Hashing
 * happens locally via the same computeContentHash the server uses, so both sides agree on what
 * "already have it" means. Categories with no manifest support (decks, bastions) or any failure
 * along the way (network hiccup, unrecognized file shape) fall back to their original, complete
 * entry list -- this is a pure bandwidth optimization and must never cause data loss. */
export async function filterNativeCompendiumDocumentForUpload(
  document: unknown,
): Promise<NativeCompendiumManifestFilterResult> {
  const batches = extractCategoryBatches(document);
  if (!batches) return { document, skipped: 0, total: 0 };

  const root = document as JsonRecord;
  const isBundle = NATIVE_COMPENDIUM_CATEGORIES.some((category) => root[category] !== undefined);
  const filtered: JsonRecord = { ...root };
  let skipped = 0;
  let total = 0;

  for (const { category, entries } of batches) {
    total += entries.length;
    const keyed = entries.map((entry) => {
      const id = typeof entry.id === "string" ? entry.id : null;
      const ruleset = typeof entry.ruleset === "string" ? entry.ruleset : undefined;
      return { key: id ? nativeEntryKey(category, { id, ruleset }) : null, entry };
    });

    try {
      const hashPairs = await Promise.all(
        keyed
          .filter((row): row is { key: string; entry: JsonRecord } => row.key !== null)
          .map(async (row) => [row.key, await computeContentHash(row.entry)] as const),
      );
      const response = await api<{ ok: true; upload: string[] }>(
        "/api/compendium/native/manifest",
        jsonInit("POST", { version: MANIFEST_VERSION, category, hashes: Object.fromEntries(hashPairs) }),
      );
      const uploadKeys = new Set(response.upload);
      const kept = keyed
        .filter((row) => row.key === null || uploadKeys.has(row.key))
        .map((row) => row.entry);
      skipped += entries.length - kept.length;
      if (isBundle) filtered[category] = kept;
      else filtered.entries = kept;
    } catch {
      // Manifest lookup unavailable for this category (unsupported category, network error,
      // etc.) -- upload its entries unfiltered rather than losing any content.
      if (isBundle) filtered[category] = entries;
      else filtered.entries = entries;
    }
  }

  return { document: filtered, skipped, total };
}
