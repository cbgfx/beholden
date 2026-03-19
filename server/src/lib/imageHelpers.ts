// server/src/lib/imageHelpers.ts
// Shared image upload utilities used by campaigns and players routes.
import sharp from "sharp";
import type { ServerContext } from "../server/context.js";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Resize an image buffer to max 400×400, encode as WebP quality 80. */
export async function resizeToWebP(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Best-effort deletion of all legacy-format image files for a given id.
 * Covers old uploads that may have used png/jpg/gif before we standardised on webp.
 */
export function deleteImageFiles(
  ctx: Pick<ServerContext, "fs" | "path">,
  imagesDir: string,
  id: string
): void {
  for (const ext of ["png", "jpg", "gif", "webp"]) {
    const p = ctx.path.join(imagesDir, `${id}.${ext}`);
    try { if (ctx.fs.existsSync(p)) ctx.fs.unlinkSync(p); } catch { /* best-effort */ }
  }
}
