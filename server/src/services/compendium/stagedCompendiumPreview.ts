import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NativeCompendiumBatch } from "./nativeCompendium.js";

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export const STAGED_PREVIEW_TTL_MS = 15 * 60 * 1000;

function stagedPath(directory: string, token: string): string {
  if (!TOKEN.test(token)) throw new Error("Invalid or expired compendium preview token.");
  return path.join(directory, `${token}.preview.json`);
}

export function cleanupExpiredCompendiumPreviews(directory: string, now = Date.now()): void {
  fs.mkdirSync(directory, { recursive: true });
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith(".preview.json")) continue;
    const filePath = path.join(directory, name);
    try {
      if (now - fs.statSync(filePath).mtimeMs > STAGED_PREVIEW_TTL_MS) fs.unlinkSync(filePath);
    } catch { /* another request may have consumed it */ }
  }
}

export function stageCompendiumPreview(directory: string, uploadPath: string, batches: NativeCompendiumBatch[]): string {
  cleanupExpiredCompendiumPreviews(directory);
  const token = crypto.randomUUID();
  const target = stagedPath(directory, token);
  fs.writeFileSync(uploadPath, JSON.stringify({ batches }), "utf8");
  fs.renameSync(uploadPath, target);
  return token;
}

export function consumeCompendiumPreview<T>(directory: string, token: string, consume: (batches: NativeCompendiumBatch[]) => T): T {
  cleanupExpiredCompendiumPreviews(directory);
  const filePath = stagedPath(directory, token);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { batches?: NativeCompendiumBatch[] };
    if (!Array.isArray(parsed.batches)) throw new Error("Invalid or expired compendium preview token.");
    return consume(parsed.batches);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") throw new Error("Invalid or expired compendium preview token.");
    throw error;
  } finally {
    try { fs.unlinkSync(filePath); } catch { /* missing/expired previews are already gone */ }
  }
}
