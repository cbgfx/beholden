import type { Response } from "express";

type SharedCachePolicy = {
  maxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
};

export function applySharedApiCacheHeaders(
  res: Response,
  policy: SharedCachePolicy = {},
): void {
  const maxAgeSeconds = policy.maxAgeSeconds ?? 30;
  const staleWhileRevalidateSeconds = policy.staleWhileRevalidateSeconds ?? 120;
  res.setHeader(
    "Cache-Control",
    `private, max-age=${Math.max(0, maxAgeSeconds)}, stale-while-revalidate=${Math.max(0, staleWhileRevalidateSeconds)}`,
  );
  res.vary("Accept-Encoding");
}

