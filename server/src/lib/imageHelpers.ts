// server/src/lib/imageHelpers.ts
// Shared image upload utilities used by campaigns and players routes.
import sharp from "sharp";
import type { ServerContext } from "../server/context.js";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number.parseInt(String(process.env[name] ?? ""), 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

const IMAGE_MAX_PX = readIntEnv("BEHOLDEN_IMAGE_MAX_PX", 360, 128, 1024);
const IMAGE_WEBP_QUALITY = readIntEnv("BEHOLDEN_IMAGE_WEBP_QUALITY", 76, 40, 95);

/** Resize an image buffer to max configured bounds, encode as WebP with configurable quality. */
export async function resizeToWebP(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: IMAGE_MAX_PX, height: IMAGE_MAX_PX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMAGE_WEBP_QUALITY })
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
