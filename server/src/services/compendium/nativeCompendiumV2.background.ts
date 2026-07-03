import { compactBackgroundEntry } from "./backgroundCompaction.js";
import { isCanonicalV2Entry } from "./nativeCompendiumV2Schemas.js";
import { type JsonRecord } from "./nativeCompendiumV2.helpers.js";

export function backgroundToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Entry("backgrounds", entry)) return entry;
  return compactBackgroundEntry(entry);
}
