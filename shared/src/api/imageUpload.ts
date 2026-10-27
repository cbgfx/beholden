/**
 * Longest edge, in pixels, of a portrait sent to the server.
 *
 * The server downsizes every portrait again to its own cap (360px by default, configurable up to
 * 1024px through BEHOLDEN_IMAGE_MAX_PX), so anything larger than 1024px is detail that gets thrown
 * away after it has already crossed the network. A 12-megapixel phone photo is ~4000px on its long
 * edge and several MB; at 1024px it is a couple of hundred KB.
 */
const UPLOAD_MAX_EDGE_PX = 1024;

/**
 * Shrinks a picked image in the browser before it is uploaded.
 *
 * Phone photos are the main reason for this: they are large, often sent over mobile data, and the
 * server would throw most of their pixels away anyway. The photo's EXIF rotation is applied while
 * decoding, so the result is upright.
 *
 * Whenever anything goes wrong (a browser without createImageBitmap, a format it can't decode, a
 * failed encode), the original file is returned untouched and the server does the work instead. The
 * original is also kept if re-encoding didn't actually make it smaller.
 */
export async function shrinkImageForUpload(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, UPLOAD_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // JPEGs have no transparency, so they stay JPEG. Everything else (PNG tokens with transparent
    // backgrounds, WebP, GIF) goes to WebP, which keeps transparency. Browsers that can't encode
    // WebP (older Safari) quietly hand back a PNG instead, which is still a valid upload.
    const targetType = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, targetType, 0.9));
    if (!blob || blob.size >= file.size) return file;

    const extension = blob.type.split("/")[1] ?? "img";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "portrait";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

/** Builds the multipart body every portrait upload route expects, shrinking the image first. */
export async function imageUploadForm(file: File): Promise<FormData> {
  const form = new FormData();
  form.append("image", await shrinkImageForUpload(file));
  return form;
}
