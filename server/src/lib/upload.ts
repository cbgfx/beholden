import multer, { type Options } from "multer";
import fs from "node:fs";
import path from "node:path";

export const GENERIC_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

const uploadLimits: NonNullable<Options["limits"]> & { fieldNestingDepth: number } = {
  fileSize: GENERIC_UPLOAD_MAX_BYTES,
  files: 1,
  fields: 20,
  parts: 21,
  fieldNestingDepth: 3,
};

/**
 * Centralized upload middleware for structured files (compendium JSON, binder and campaign
 * exports). Memory storage keeps the parsed payload available as req.file.buffer.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: uploadLimits,
});

/**
 * Portraits get a much tighter ceiling than the generic 100MB one.
 *
 * Every uploaded image is downscaled to a 360px WebP, so nothing above a few megabytes carries
 * any extra detail into the stored file — but the original is held in memory while Sharp works
 * on it, and the server is reachable from the public internet. 12MB covers a phone photo with
 * room to spare and keeps a burst of concurrent uploads from exhausting memory.
 */
export const IMAGE_UPLOAD_MAX_BYTES = (() => {
  const raw = Number.parseInt(String(process.env.BEHOLDEN_IMAGE_MAX_UPLOAD_MB ?? ""), 10);
  const megabytes = Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 12;
  return megabytes * 1024 * 1024;
})();

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { ...uploadLimits, fileSize: IMAGE_UPLOAD_MAX_BYTES },
});

/** Large compendium bundles are spooled to disk so the request body is not retained in RAM. */
export function createCompendiumUpload(dataDir: string) {
  const destination = compendiumUploadDirectory(dataDir);
  fs.mkdirSync(destination, { recursive: true });
  return multer({
    storage: multer.diskStorage({ destination }),
    limits: uploadLimits,
  });
}

export function compendiumUploadDirectory(dataDir: string): string {
  return path.join(dataDir, "tmp", "compendium-uploads");
}

/** Full database backups can be much larger than a compendium batch; spool to disk with a higher ceiling. */
export function createDatabaseUpload(dataDir: string) {
  const destination = databaseUploadDirectory(dataDir);
  fs.mkdirSync(destination, { recursive: true });
  return multer({
    storage: multer.diskStorage({ destination }),
    limits: { ...uploadLimits, fileSize: 1024 * 1024 * 1024 }, // 1GB
  });
}

function databaseUploadDirectory(dataDir: string): string {
  return path.join(dataDir, "tmp", "database-uploads");
}
