// server/src/services/databaseImageArchive.ts
// Shared logic for bundling the on-disk image directories into (and out of) a whole-database
// export/import zip. Kept separate from the route so the pure parts (which entries count as
// images, where they land on disk) are unit-testable without a real HTTP request/response.

import fs from "node:fs";
import path from "node:path";

export const DATABASE_IMAGE_DIRECTORIES = [
  "campaign-images",
  "player-images",
  "binder-mortal-images",
  "binder-deity-images",
  "character-images",
] as const;

/** Which of the known image directories actually exist under `dataDir` right now, with their
 * absolute paths — used by the export route to decide what to add to the archive. */
export function existingImageDirectories(dataDir: string): Array<{ name: string; absolutePath: string }> {
  return DATABASE_IMAGE_DIRECTORIES
    .map((name) => ({ name, absolutePath: path.join(dataDir, name) }))
    .filter((entry) => fs.existsSync(entry.absolutePath));
}

export function isDatabaseZipUpload(file: { mimetype?: string; originalname: string }): boolean {
  return file.mimetype === "application/zip" || file.originalname.toLowerCase().endsWith(".zip");
}

/** Picks out the image-directory entries from an extracted zip's flat entry map (fflate's
 * unzipSync output), keyed by their in-archive path (e.g. "campaign-images/foo.webp"). */
export function selectImageEntries(entries: Record<string, Uint8Array>): Array<{ relativePath: string; bytes: Uint8Array }> {
  const prefixes = DATABASE_IMAGE_DIRECTORIES.map((name) => `${name}/`);
  return Object.entries(entries)
    .filter(([entryPath]) => !entryPath.endsWith("/") && prefixes.some((prefix) => entryPath.startsWith(prefix)))
    .map(([relativePath, bytes]) => ({ relativePath, bytes }));
}

/** Writes extracted image entries back to their matching directories under `dataDir`, preserving
 * the exact relative path from the archive. Existing files are overwritten; nothing already on
 * disk is deleted — a whole-database restore adds/overwrites images, it never prunes ones the new
 * snapshot omits (safer than diffing directories, at the cost of possible orphaned files). Entries
 * that would resolve outside `dataDir` (a malformed or crafted zip path) are skipped. */
export function writeImageEntries(dataDir: string, images: Array<{ relativePath: string; bytes: Uint8Array }>): void {
  const resolvedDataDir = path.resolve(dataDir);
  for (const { relativePath, bytes } of images) {
    const absolute = path.resolve(dataDir, relativePath);
    if (absolute !== resolvedDataDir && !absolute.startsWith(resolvedDataDir + path.sep)) continue;
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, bytes);
  }
}
