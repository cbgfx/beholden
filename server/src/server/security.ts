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
import type { Db } from "../lib/db.js";

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

// MARK: - Get Allowed Origin Hosts
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

// MARK: - Cors Middleware
export function corsMiddleware(allowedHosts: Set<string> | null): express.RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const host = parseOriginHost(origin);
      const allowed = !allowedHosts || Boolean(host && allowedHosts.has(host));
      if (!allowed) return res.status(403).json({ ok: false, message: "Origin is not allowed." });
      if (allowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
      }
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Beholden-CSRF");
      res.setHeader("Access-Control-Max-Age", "86400");
      return res.status(204).end();
    }
    next();
  };
}

export function securityHeadersMiddleware(): express.RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    next();
  };
}

// ---------------------------------------------------------------------------
// Basic Auth
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rate limiter
//
// Only applies to HTTP API requests (/api/*).
// WebSocket upgrade requests (/ws) are excluded — they are long-lived
// connections, not request-response cycles, and should never count against
// the HTTP budget.
// ---------------------------------------------------------------------------

export function trustProxyHeadersEnabled(): boolean {
  const value = String(process.env.BEHOLDEN_TRUST_PROXY ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function getClientIp(req: express.Request): string {
  if (!trustProxyHeadersEnabled()) return req.socket.remoteAddress ?? "unknown";
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim().length) return cf.trim();

  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim().length) return real.trim();

  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim().length) return xf.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

function getRateLimitKey(req: express.Request): string {
  if (req.user?.userId) return `user:${req.user.userId}`;

  if (req.path === "/api/auth/login" && req.method === "POST") {
    const body = req.body as { username?: unknown } | undefined;
    const username = String(body?.username ?? "unknown").trim().toLowerCase() || "unknown";
    return `login:${getClientIp(req)}:${username}`;
  }

  return `ip:${getClientIp(req)}`;
}

/** The paths a limiter guards by default: everything under /api except health checks and WS upgrades. */
function isRateLimitedApiRequest(req: express.Request): boolean {
  if (!req.path.startsWith("/api/")) return false;
  if (req.path === "/api/health") return false;
  // WebSocket upgrades arrive as HTTP GET /ws with an Upgrade header.
  // Skip them entirely — they are not API requests.
  if (req.path === "/ws" || req.headers.upgrade?.toLowerCase() === "websocket") return false;
  return true;
}

/** Image uploads: the handful of POST routes that end in /image. */
export function isImageUploadRequest(req: Pick<express.Request, "method" | "path">): boolean {
  return req.method === "POST" && req.path.startsWith("/api/") && req.path.endsWith("/image");
}

// MARK: - Create In Memory Rate Limiter
export function createInMemoryRateLimiter(opts: {
  windowMs: number;
  max: number;
  /** Keeps a second limiter's buckets from colliding with the global one's. */
  keyPrefix?: string;
  /** Which requests this limiter counts. Defaults to all API traffic. */
  appliesTo?: (req: express.Request) => boolean;
}) {
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

  const appliesTo = opts.appliesTo ?? isRateLimitedApiRequest;

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!appliesTo(req)) {
      return next();
    }

    const key = `${opts.keyPrefix ?? ""}${getRateLimitKey(req)}`;
    const nowMs = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= nowMs) {
      buckets.set(key, { count: 1, resetAt: nowMs + opts.windowMs });
      return next();
    }
    b.count += 1;
    if (b.count > opts.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((b.resetAt - nowMs) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: "rate_limited",
        message: `Too many requests. Please wait ${retryAfterSeconds} seconds and try again.`,
        retryAfterSeconds,
      });
      return;
    }
    next();
  };
}

// MARK: - Get Rate Limit Config
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

/** Login attempts survive restarts and are shared by every process using the database. */
export function createDurableLoginRateLimiter(db: Db, opts: { windowMs: number; max: number; onBlocked?: (req: express.Request) => void }) {
  let requests = 0;
  const consume = db.transaction((key: string, nowMs: number) => {
    const row = db.prepare("SELECT attempt_count,reset_at FROM auth_login_limits WHERE bucket_key=?")
      .get(key) as { attempt_count: number; reset_at: number } | undefined;
    if (!row || row.reset_at <= nowMs) {
      db.prepare(`INSERT INTO auth_login_limits (bucket_key,attempt_count,reset_at) VALUES (?,?,?)
        ON CONFLICT(bucket_key) DO UPDATE SET attempt_count=excluded.attempt_count,reset_at=excluded.reset_at`)
        .run(key, 1, nowMs + opts.windowMs);
      return { count: 1, resetAt: nowMs + opts.windowMs };
    }
    db.prepare("UPDATE auth_login_limits SET attempt_count=attempt_count+1 WHERE bucket_key=?").run(key);
    return { count: row.attempt_count + 1, resetAt: row.reset_at };
  });
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path !== "/api/auth/login" || req.method !== "POST") return next();
    requests += 1;
    if (requests % 100 === 0) db.prepare("DELETE FROM auth_login_limits WHERE reset_at<=?").run(Date.now());
    const username = String((req.body as { username?: unknown } | undefined)?.username ?? "unknown").trim().toLowerCase() || "unknown";
    const bucket = consume(`${getClientIp(req)}:${username}`, Date.now());
    if (bucket.count <= opts.max) return next();
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
    opts.onBlocked?.(req);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ error: "rate_limited", message: `Too many requests. Please wait ${retryAfterSeconds} seconds and try again.`, retryAfterSeconds });
  };
}

export function getLoginRateLimitConfig() {
  const windowMs = Number(process.env.BEHOLDEN_LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
  const max = Number(process.env.BEHOLDEN_LOGIN_RATE_LIMIT_MAX ?? 10);
  const enabled = Number.isFinite(windowMs) && Number.isFinite(max) && windowMs > 0 && max > 0;
  return { windowMs, max, enabled };
}

// MARK: - Get Upload Rate Limit Config
export function getUploadRateLimitConfig() {
  // Uploads are far more expensive than a JSON request (decode, resize, re-encode, write to disk),
  // and the server is reachable from the public internet, so they get their own tighter bucket.
  // 60 per 15 minutes is well above what setting portraits for a whole party costs.
  const windowMs = Number(process.env.BEHOLDEN_UPLOAD_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
  const max = Number(process.env.BEHOLDEN_UPLOAD_RATE_LIMIT_MAX ?? 60);
  const enabled = Number.isFinite(windowMs) && Number.isFinite(max) && windowMs > 0 && max > 0;
  return { windowMs, max, enabled };
}
