// server/src/shared/validate.ts
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, req: Request): T {
  return schema.parse(req.body);
}

export function multerErrorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ ok: false, message: "Upload too large. Max file size is 100MB." });
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
