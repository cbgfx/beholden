/**
 * security.ts
 *
 * Lightweight security helpers for public-hosting scenarios.
 * No external dependencies by design.
 *
 * Configure via env:
 *   BEHOLDEN_ALLOWED_ORIGINS="https://example.com,https://localhost:5173"
 *   BEHOLDEN_BASIC_AUTH_USER="dm"
 *   BEHOLDEN_BASIC_AUTH_PASS="..."
 *   BEHOLDEN_RATE_LIMIT_WINDOW_MS="900000"
 *   BEHOLDEN_RATE_LIMIT_MAX="2000"
 */

import type express from "express";
import type { IncomingMessage } from "node:http";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function parseOriginHost(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export function getAllowedOriginHosts(): Set<string> | null {
  // If the env var is not set we allow all origins (dev / LAN mode).
  // Set BEHOLDEN_ALLOWED_ORIGINS to a comma-separated list to restrict.
  const raw = (process.env.BEHOLDEN_ALLOWED_ORIGINS ?? "").trim();
  if (!raw) return null; // null = allow all
  const set = new Set<string>();
  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const host = parseOriginHost(part) ?? part.toLowerCase();
    if (host) set.add(host);
  }
  return set.size ? set : null;
}

export function corsMiddleware(allowedHosts: Set<string> | null): express.RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const host = parseOriginHost(origin);
      if (!allowedHosts || (host && allowedHosts.has(host))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
      }
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      res.setHeader("Access-Control-Max-Age", "86400");
      return res.status(204).end();
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Basic Auth
// ---------------------------------------------------------------------------

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function basicAuthCheck(
  authHeader: string | string[] | undefined,
  user: string,
  pass: string
): boolean {
  const raw = authHeader;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return false;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !value) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(value, "base64").toString("utf8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx === -1) return false;
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  return timingSafeEq(u, user) && timingSafeEq(p, pass);
}

export function getBasicAuthConfig() {
  const user = (process.env.BEHOLDEN_BASIC_AUTH_USER ?? "dm").trim();
  const pass = (process.env.BEHOLDEN_BASIC_AUTH_PASS ?? "FrozenAssets").trim();
  const enabled = user.length > 0 && pass.length > 0;
  return { user, pass, enabled };
}

// ---------------------------------------------------------------------------
// Rate limiter
//
// Only applies to HTTP API requests (/api/*).
// WebSocket upgrade requests (/ws) are excluded — they are long-lived
// connections, not request-response cycles, and should never count against
// the HTTP budget.
// ---------------------------------------------------------------------------

function getClientIp(req: express.Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim().length) return xf.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

export function createInMemoryRateLimiter(opts: { windowMs: number; max: number }) {
  type Bucket = { count: number; resetAt: number };
  const buckets = new Map<string, Bucket>();

  // Sweep expired buckets once per window to prevent unbounded Map growth.
  const sweepInterval = setInterval(() => {
    const nowMs = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= nowMs) buckets.delete(key);
    }
  }, opts.windowMs);

  // Don't keep the process alive just for cleanup.
  sweepInterval.unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // WebSocket upgrades arrive as HTTP GET /ws with an Upgrade header.
    // Skip them entirely — they are not API requests.
    if (req.path === "/ws" || req.headers.upgrade?.toLowerCase() === "websocket") {
      return next();
    }

    const key = getClientIp(req);
    const nowMs = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= nowMs) {
      buckets.set(key, { count: 1, resetAt: nowMs + opts.windowMs });
      return next();
    }
    b.count += 1;
    if (b.count > opts.max) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    next();
  };
}

export function getRateLimitConfig() {
  // Defaults: 5000 requests per 15 minutes.
  // A single active session (campaign load + combat polling) uses ~20-40 req/min
  // under normal use. 5000 / 15min gives ~333/min headroom — plenty for a DM app.
  // The old default of 2000 was too tight once WS reconnect storms were factored in.
  const windowMs = Number(process.env.BEHOLDEN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
  const max = Number(process.env.BEHOLDEN_RATE_LIMIT_MAX ?? 5000);
  const enabled = Number.isFinite(windowMs) && Number.isFinite(max) && windowMs > 0 && max > 0;
  return { windowMs, max, enabled };
}
