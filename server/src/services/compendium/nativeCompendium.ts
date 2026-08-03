/**
 * Stable public facade for native Grand-compendium transfer.
 *
 * Implementations are split by responsibility so parsing, manifest/preview, import,
 * and export can evolve independently without turning this module back into a god file.
 */
export {
  NATIVE_COMPENDIUM_CATEGORIES,
  isNativeCompendiumCategory,
  type NativeCompendiumCategory,
} from "@beholden/shared/domain/compendium/nativeCompendiumKey";

export {
  BEHOLDEN_COMPENDIUM_FORMAT,
  BEHOLDEN_COMPENDIUM_SCHEMA,
  type NativeCompendiumBatch,
  type NativeCompendiumBundle,
  type NativeCompendiumDocument,
  type NativeCompendiumImportResult,
  type NativeCompendiumDocumentImportResult,
  type NativeCompendiumPreview,
} from "./nativeCompendiumShared.js";

export {
  parseNativeCompendiumBatch,
  parseNativeCompendiumDocument,
} from "./nativeCompendiumParsing.js";

export {
  NATIVE_COMPENDIUM_MANIFEST_VERSION,
  previewNativeCompendiumDocument,
  previewValidatedNativeCompendiumBatches,
  resolveNativeContentHashes,
  resolveNativeCompendiumManifest,
  type NativeCompendiumManifestRequest,
  type NativeCompendiumManifestResult,
} from "./nativeCompendiumManifest.js";

export {
  exportNativeCompendiumBatch,
  exportNativeCompendiumBundle,
  iterateNativeCompendiumEntries,
} from "./nativeCompendiumExport.js";

export {
  importNativeCompendiumBatch,
  importNativeCompendiumDocument,
  importValidatedNativeCompendiumBatches,
} from "./nativeCompendiumImport.js";
