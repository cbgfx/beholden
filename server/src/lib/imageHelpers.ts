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

/** Remove the current canonical image asset for an id. */
export function deleteImageFiles(
  ctx: Pick<ServerContext, "fs" | "path">,
  imagesDir: string,
  id: string
): void {
  const p = ctx.path.join(imagesDir, `${id}.webp`);
  try { if (ctx.fs.existsSync(p)) ctx.fs.unlinkSync(p); } catch { /* best-effort */ }
}
