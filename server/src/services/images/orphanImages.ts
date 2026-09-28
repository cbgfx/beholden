// server/src/services/images/orphanImages.ts
// Finds image files that no row points at any more.
//
// Deleting a record removes its own image, but records also disappear through cascades -- deleting a
// character takes its campaign player rows with it -- and those copies were left on disk. This is the
// sweep that catches whatever slipped through, run from `npm run db:maintenance`.

import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { existingImageDirectories } from "../databaseImageArchive.js";

/** Every table and column that can point at an image file. */
const IMAGE_SOURCES = [
  { table: "campaigns", column: "image_url" },
  { table: "players", column: "image_url" },
  { table: "user_characters", column: "image_url" },
  { table: "mortals", column: "image_url" },
  { table: "deities", column: "image_url" },
] as const;

/** Compares paths the way the filesystem does here: forward slashes, case-insensitive. */
function comparablePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/").toLowerCase();
}

/**
 * The file an `image_url` points at, relative to the data directory, or null when it isn't a local
 * image. Handles the absolute URLs the API hands out and the `?v=` cache-busting suffix.
 */
export function imageUrlToRelativePath(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const withoutQuery = value.trim().split("?")[0] ?? "";
  const withoutOrigin = withoutQuery.replace(/^[a-z][a-z\d+.-]*:\/\/[^/]+/i, "");
  const relative = withoutOrigin.replace(/^\/+/, "");
  if (!relative || relative.includes("..")) return null;
  return relative;
}

/** Every image file the database still refers to, as comparable relative paths. */
function referencedImageFiles(db: Database.Database): Set<string> {
  const referenced = new Set<string>();
  for (const source of IMAGE_SOURCES) {
    let rows: Array<{ url: unknown }>;
    try {
      rows = db.prepare(`SELECT ${source.column} AS url FROM ${source.table}`).all() as Array<{ url: unknown }>;
    } catch {
      // A table that doesn't exist yet (binder tables on an old database) simply refers to nothing.
      continue;
    }
    for (const row of rows) {
      const relative = imageUrlToRelativePath(row.url);
      if (relative) referenced.add(comparablePath(relative));
    }
  }
  return referenced;
}

export type OrphanImage = { relativePath: string; absolutePath: string; bytes: number };

/** Image files under `dataDir` that nothing in the database points at. */
export function findOrphanImages(db: Database.Database, dataDir: string): OrphanImage[] {
  const referenced = referencedImageFiles(db);
  const orphans: OrphanImage[] = [];
  for (const directory of existingImageDirectories(dataDir)) {
    for (const file of fs.readdirSync(directory.absolutePath)) {
      const absolutePath = path.join(directory.absolutePath, file);
      let stats: fs.Stats;
      try {
        stats = fs.statSync(absolutePath);
      } catch {
        continue;
      }
      if (!stats.isFile()) continue;
      const relativePath = `${directory.name}/${file}`;
      if (referenced.has(comparablePath(relativePath))) continue;
      orphans.push({ relativePath, absolutePath, bytes: stats.size });
    }
  }
  return orphans;
}

/** Deletes the given files and returns how many went. A file already gone counts as done. */
export function deleteOrphanImages(orphans: OrphanImage[]): number {
  let deleted = 0;
  for (const orphan of orphans) {
    try {
      fs.unlinkSync(orphan.absolutePath);
      deleted += 1;
    } catch {
      if (!fs.existsSync(orphan.absolutePath)) deleted += 1;
    }
  }
  return deleted;
}
