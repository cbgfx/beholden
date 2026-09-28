// server/src/lib/validate.ts
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { GENERIC_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MAX_BYTES } from "./upload.js";

export function parseBody<T>(schema: ZodSchema<T>, req: Request): T {
  return schema.parse(req.body);
}

export function multerErrorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      // Portraits have a much smaller ceiling than compendium or backup files, so quote the
      // limit that actually applied rather than a single hardcoded number.
      const maxBytes = err.field === "image" ? IMAGE_UPLOAD_MAX_BYTES : GENERIC_UPLOAD_MAX_BYTES;
      const maxMegabytes = Math.round(maxBytes / 1024 / 1024);
      return res.status(413).json({ ok: false, message: `Upload too large. Max file size is ${maxMegabytes}MB.` });
    }
    return res.status(400).json({ ok: false, message: "Upload failed.", code: err.code });
  }
  return next(err);
}

export function zodErrorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      message: "Invalid request body",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return next(err);
}
