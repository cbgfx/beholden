// server/src/lib/imageHelpers.ts
// Shared image upload utilities used by campaigns and players routes.
import sharp from "sharp";
import type { ServerContext } from "../server/context.js";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number.parseInt(String(process.env[name] ?? ""), 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

const IMAGE_MAX_PX = readIntEnv("BEHOLDEN_IMAGE_MAX_PX", 360, 128, 1024);
const IMAGE_WEBP_QUALITY = readIntEnv("BEHOLDEN_IMAGE_WEBP_QUALITY", 76, 40, 95);

/**
 * Resize an image buffer to max configured bounds, encode as WebP with configurable quality.
 *
 * Animation is deliberately dropped: an animated GIF or WebP keeps its first frame only. Portraits
 * are shown at thumbnail size all over both apps, and carrying every frame through the resize would
 * cost far more memory and disk than a moving portrait is worth.
 */
async function resizeToWebP(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { animated: false })
    .resize({ width: IMAGE_MAX_PX, height: IMAGE_MAX_PX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMAGE_WEBP_QUALITY })
    .toBuffer();
}

export type PreparedImage =
  | { ok: true; image: Buffer }
  | { ok: false; message: "No file" | "Unsupported image type" | "Could not process image" };

/** Validate and normalize an uploaded image without coupling routes to Sharp error handling. */
export async function prepareUploadedImage(file?: { mimetype: string; buffer: Buffer }): Promise<PreparedImage> {
  if (!file) return { ok: false, message: "No file" };
  if (!ACCEPTED_IMAGE_TYPES.includes(file.mimetype)) return { ok: false, message: "Unsupported image type" };
  try {
    return { ok: true, image: await resizeToWebP(file.buffer) };
  } catch {
    return { ok: false, message: "Could not process image" };
  }
}

/**
 * Removes the portrait a character owns, plus the copies its campaign player rows kept.
 *
 * Deleting a character deletes those player rows too, so nothing points at the files afterwards and
 * they would otherwise sit on disk for ever.
 */
export function removeCharacterImageFiles(
  ctx: Pick<ServerContext, "fs" | "path" | "paths">,
  characterId: string,
  playerIds: string[],
): void {
  deleteImageFiles(ctx, ctx.path.join(ctx.paths.dataDir, "character-images"), characterId);
  const playerImagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
  for (const playerId of playerIds) deleteImageFiles(ctx, playerImagesDir, playerId);
}

/** Remove the current canonical image asset for an id. */
export function deleteImageFiles(
  ctx: Pick<ServerContext, "fs" | "path">,
  imagesDir: string,
  id: string
): void {
  const p = ctx.path.join(imagesDir, `${id}.webp`);
  try { if (ctx.fs.existsSync(p)) ctx.fs.unlinkSync(p); } catch { /* best-effort */ }
}
