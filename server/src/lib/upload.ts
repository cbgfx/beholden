import multer, { type Options } from "multer";
import fs from "node:fs";
import path from "node:path";

const uploadLimits: NonNullable<Options["limits"]> & { fieldNestingDepth: number } = {
  fileSize: 100 * 1024 * 1024, // 100MB
  files: 1,
  fields: 20,
  parts: 21,
  fieldNestingDepth: 3,
};

/**
 * Centralized upload middleware.
 * - LAN-only server, but still enforce a sane ceiling to prevent accidental huge uploads.
 * - Memory storage keeps imported compendium data available as req.file.buffer.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: uploadLimits,
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

export function databaseUploadDirectory(dataDir: string): string {
  return path.join(dataDir, "tmp", "database-uploads");
}
