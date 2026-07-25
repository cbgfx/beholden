import type { RequestHandler } from "express";

export interface EgressLogEntry {
  method: string;
  path: string;
  statusCode: number;
  bytes: number;
  durationMs: number;
  encoding: string;
}

export function createEgressLoggingMiddleware(options: {
  minBytes: number;
  log?: (entry: EgressLogEntry) => void;
}): RequestHandler {
  const minBytes = Math.max(0, Math.floor(options.minBytes));
  const log = options.log ?? ((entry: EgressLogEntry) => {
    const mb = (entry.bytes / (1024 * 1024)).toFixed(3);
    console.log(`[egress] ${entry.method} ${entry.path} -> ${entry.statusCode} ${entry.bytes}B (${mb}MB) ${entry.durationMs}ms enc=${entry.encoding}`);
  });

  return (req, res, next) => {
    const startedAt = Date.now();
    let bytes = 0;
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = ((chunk: unknown, ...args: unknown[]) => {
      if (chunk != null) bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
      return (originalWrite as (...writeArgs: unknown[]) => unknown)(chunk, ...args);
    }) as typeof res.write;

    res.end = ((chunk?: unknown, ...args: unknown[]) => {
      if (chunk != null) bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
      return (originalEnd as (...endArgs: unknown[]) => unknown)(chunk, ...args);
    }) as typeof res.end;

    res.on("finish", () => {
      if (bytes < minBytes) return;
      log({
        method: req.method,
        path: req.originalUrl.split("?", 1)[0] ?? req.path,
        statusCode: res.statusCode,
        bytes,
        durationMs: Date.now() - startedAt,
        encoding: String(res.getHeader("content-encoding") ?? "identity"),
      });
    });

    next();
  };
}

export function egressLogMinBytes(value: string | undefined): number {
  if (value == null || value.trim() === "") return 1024 * 1024;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 1024 * 1024;
}
