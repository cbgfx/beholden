import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, req: Request): T {
  return schema.parse(req.body);
}


export function multerErrorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction) {
  // Multer v2 throws MulterError with a code such as "LIMIT_FILE_SIZE".
  if (err && typeof err === "object" && (err as any).name === "MulterError") {
    const code = (err as any).code as string | undefined;
    if (code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ ok: false, message: "Upload too large. Max file size is 100MB." });
    }
    return res.status(400).json({ ok: false, message: "Upload failed.", code: code ?? "MULTER_ERROR" });
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
