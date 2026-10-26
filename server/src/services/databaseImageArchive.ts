// server/src/services/databaseImageArchive.ts
// Shared logic for bundling the on-disk image directories into (and out of) a whole-database
// export/import zip. Kept separate from the route so the pure parts (which entries count as
// images, where they land on disk) are unit-testable without a real HTTP request/response.

import fs from "node:fs";
import path from "node:path";

const DATABASE_IMAGE_DIRECTORIES = [
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
 * snapshot omits (safer than diffing directories, at the cost of possible orphaned files). An entry
 * must land inside the image directory it is named under: "campaign-images/../beholden.db" would
 * otherwise resolve inside `dataDir` and overwrite the live database, so it is skipped, as is
 * anything outside the known image directories. */
export function writeImageEntries(dataDir: string, images: Array<{ relativePath: string; bytes: Uint8Array }>): void {
  for (const { relativePath, bytes } of images) {
    const directory = DATABASE_IMAGE_DIRECTORIES.find((name) => relativePath.startsWith(`${name}/`));
    if (!directory) continue;
    const imageDir = path.resolve(dataDir, directory);
    const absolute = path.resolve(dataDir, relativePath);
    if (!absolute.startsWith(imageDir + path.sep)) continue;
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, bytes);
  }
}


export type RestoreImage = { relativePath: string } & ({ bytes: Uint8Array } | { stagedPath: string });

export function isDatabaseImagePath(relativePath: string): boolean {
  if (!DATABASE_IMAGE_DIRECTORIES.some(name => relativePath.startsWith(`${name}/`))) return false;
  return !relativePath.endsWith("/") && !/[\\:\x00]/u.test(relativePath)
    && relativePath.split("/").every(part => part !== "" && part !== "." && part !== "..");
}

/** Stage replacements and originals on the destination volume before touching live files.
 * apply runs inside the database transaction; rollback restores every moved original on failure. */
export function prepareImageRestore(dataDir: string, images: RestoreImage[], io: typeof fs = fs) {
  const parent = path.join(dataDir, "tmp"); io.mkdirSync(parent, { recursive: true });
  const staging = io.mkdtempSync(path.join(parent, "image-restore-"));
  const plans: Array<{ target: string; next: string; previous: string; moved: boolean; installed: boolean }> = [];
  let recoveryFailed = false;
  const dispose = () => {
    if (recoveryFailed) return; // Keep recovery originals if the filesystem itself refuses rollback.
    try { io.rmSync(staging, { recursive: true, force: true }); } catch { /* cleanup must not turn a committed restore into a failed response */ }
  };
  try {
    for (const [index, image] of images.entries()) {
      if (!isDatabaseImagePath(image.relativePath)) continue;
      const target = path.resolve(dataDir, image.relativePath);
      if (!target.startsWith(path.resolve(dataDir) + path.sep)) throw new Error("Invalid image restore path.");
      // Never follow a pre-existing symlink outside the installation while staging or swapping.
      const pieces = image.relativePath.split("/");
      let cursor = path.resolve(dataDir);
      for (const piece of pieces) {
        cursor = path.join(cursor, piece);
        if (io.existsSync(cursor)) {
          const stat = io.lstatSync(cursor);
          if (stat.isSymbolicLink()) throw new Error("Image restore paths must not contain symbolic links.");
          if (cursor === target && !stat.isFile()) throw new Error("Image restore target must be a regular file.");
        }
      }
      const next = path.join(staging, `${index}.new`);
      const previous = path.join(staging, `${index}.previous`);
      if ("bytes" in image) io.writeFileSync(next, image.bytes);
      else io.copyFileSync(image.stagedPath, next);
      plans.push({ target, next, previous, moved: false, installed: false });
    }
  } catch (cause) { dispose(); throw cause; }
  try { io.writeFileSync(path.join(staging, "recovery.json"), JSON.stringify(plans.map(plan => ({ target: plan.target, previous: plan.previous, next: plan.next })))); }
  catch (cause) { dispose(); throw cause; }
  return {
    apply() {
      for (const plan of plans) {
        io.mkdirSync(path.dirname(plan.target), { recursive: true });
        if (io.existsSync(plan.target)) { io.renameSync(plan.target, plan.previous); plan.moved = true; }
        io.renameSync(plan.next, plan.target); plan.installed = true;
      }
    },
    rollback() {
      const failures: unknown[] = [];
      for (const plan of [...plans].reverse()) {
        try {
          if (plan.installed) { io.unlinkSync(plan.target); plan.installed = false; }
          if (plan.moved) { io.renameSync(plan.previous, plan.target); plan.moved = false; }
        } catch (cause) { failures.push(cause); }
      }
      if (failures.length) {
        recoveryFailed = true;
        throw new Error(`Image rollback was incomplete. Recovery files are retained in ${staging}.`);
      }
    },
    dispose,
  };
}
