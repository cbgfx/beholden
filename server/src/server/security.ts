/**
 * security.ts
 *
 * Lightweight security helpers for public-hosting scenarios.
 * No external dependencies by design.
 *
 * Configure via env:
 *   BEHOLDEN_ALLOWED_ORIGINS="https://example.com"   extra origins besides the app's own (see isOriginAllowed)
 *   BEHOLDEN_TRUST_PROXY="true" | N | "cloudflare"   what sits in front of the server (see proxyTrustConfig)
 *   BEHOLDEN_RATE_LIMIT_WINDOW_MS="900000"
 *   BEHOLDEN_RATE_LIMIT_MAX="5000"
 *   BEHOLDEN_LOGIN_RATE_LIMIT_MAX="10"               login attempts per address + username
 *   BEHOLDEN_LOGIN_ACCOUNT_RATE_LIMIT_MAX="50"       login attempts per username from anywhere
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
/**
 * Extra origins allowed to call the API with the user's session, from BEHOLDEN_ALLOWED_ORIGINS
 * (comma-separated). Only needed when a web app is served from a different host than the API,
 * e.g. a build pointed elsewhere with VITE_API_ORIGIN. Null means "none configured".
 */
export function getAllowedOriginHosts(): Set<string> | null {
  const raw = (process.env.BEHOLDEN_ALLOWED_ORIGINS ?? "").trim();
  if (!raw) return null;
  const set = new Set<string>();
  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const host = parseOriginHost(part) ?? part.toLowerCase();
    if (host) set.add(host);
  }
  return set.size ? set : null;
}

/**
 * Whether a browser page at `origin` may make credentialed requests (or open the WebSocket).
 *
 * The page's own origin is always allowed: its Origin host matches the Host header it sent the
 * request to. This also covers the Vite dev servers, whose proxies forward the original Host.
 *
 * Anything else must be listed in BEHOLDEN_ALLOWED_ORIGINS. This used to default to "allow all",
 * which was not as harmless as it looked: the session cookie is SameSite=Lax, and SameSite ignores
 * ports, so another app on the same machine or LAN IP (or a sibling subdomain) still got the cookie
 * attached - and with CORS open it could read /api/auth/me, take the CSRF token, and act as the user.
 */
export function isOriginAllowed(
  origin: string | undefined,
  requestHost: string | undefined,
  allowedHosts: Set<string> | null,
): boolean {
  // No Origin header: not a cross-origin browser request (curl, server-to-server, some same-origin GETs).
  if (!origin) return true;
  const host = parseOriginHost(origin);
  if (!host) return false;
  if (requestHost && host === requestHost.trim().toLowerCase()) return true;
  return Boolean(allowedHosts?.has(host));
}

// MARK: - Cors Middleware
export function corsMiddleware(allowedHosts: Set<string> | null): express.RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (!isOriginAllowed(origin, req.headers.host, allowedHosts)) {
        return res.status(403).json({ ok: false, message: "Origin is not allowed." });
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
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
// Client address behind a reverse proxy
//
// BEHOLDEN_TRUST_PROXY says what sits in front of the server:
//   unset / "false"   nothing - use the socket address and ignore forwarding headers
//   "true" / "yes"    one proxy that appends to X-Forwarded-For (Railway, nginx, Caddy, ...)
//   a number N        N such proxies in a chain
//   "cloudflare"      Cloudflare, read CF-Connecting-IP (only safe when the server is
//                     reachable through Cloudflare alone, or anyone can send that header)
//
// Proxies append the address they saw to the END of X-Forwarded-For, and anything before that
// came from the client, which can write whatever it likes there. So the client address is counted
// from the right, one entry per trusted proxy. Reading the leftmost entry (as this used to) let a
// client pick a new "IP" per request and walk straight past the login limiter.
// ---------------------------------------------------------------------------

type ProxyTrust = { kind: "none" } | { kind: "hops"; hops: number } | { kind: "cloudflare" };

export function proxyTrustConfig(): ProxyTrust {
  const value = String(process.env.BEHOLDEN_TRUST_PROXY ?? "").trim().toLowerCase();
  if (value === "cloudflare") return { kind: "cloudflare" };
  if (value === "true" || value === "yes") return { kind: "hops", hops: 1 };
  const hops = Number(value);
  if (Number.isInteger(hops) && hops > 0) return { kind: "hops", hops };
  return { kind: "none" };
}

export function trustProxyHeadersEnabled(): boolean {
  return proxyTrustConfig().kind !== "none";
}

/** The value for Express's "trust proxy" setting, so req.secure / req.protocol agree with getClientIp. */
export function expressTrustProxySetting(): number | false {
  const trust = proxyTrustConfig();
  if (trust.kind === "hops") return trust.hops;
  // Cloudflare connects to the origin directly, so it is the one hop to trust.
  if (trust.kind === "cloudflare") return 1;
  return false;
}

export function getClientIp(req: Pick<express.Request, "headers" | "socket">): string {
  const socketAddress = req.socket.remoteAddress ?? "unknown";
  const trust = proxyTrustConfig();
  if (trust.kind === "none") return socketAddress;

  if (trust.kind === "cloudflare") {
    const cf = req.headers["cf-connecting-ip"];
    return typeof cf === "string" && cf.trim() ? cf.trim() : socketAddress;
  }

  // The chain as the server sees it: whatever the client claimed, then each proxy's addition,
  // then the proxy that actually connected to us. Step back one entry per trusted proxy.
  const forwarded = String(req.headers["x-forwarded-for"] ?? "")
    .split(",").map((entry) => entry.trim()).filter(Boolean);
  const chain = [...forwarded, socketAddress];
  return chain[Math.max(0, chain.length - 1 - trust.hops)] ?? socketAddress;
}

// ---------------------------------------------------------------------------
// Rate limiter
//
// Only applies to HTTP API requests (/api/*).
// WebSocket upgrade requests (/ws) are excluded — they are long-lived
// connections, not request-response cycles, and should never count against
// the HTTP budget.
// ---------------------------------------------------------------------------

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

/** Portrait and map uploads share the tighter image-processing rate limit. */
export function isImageUploadRequest(req: Pick<express.Request, "method" | "path">): boolean {
  return req.method === "POST" && req.path.startsWith("/api/") && (
    req.path.endsWith("/image") || /^\/api\/binders\/[^/]+\/locations\/[^/]+\/map$/.test(req.path)
  );
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

/**
 * Login attempts survive restarts and are shared by every process using the database.
 *
 * Two buckets are counted per attempt:
 *   - IP + username (`max`): the normal limit, so one person mistyping does not affect anyone else.
 *   - username alone (`accountMax`): caps guesses against one account however many addresses the
 *     guesses come from. It is deliberately much looser, because anyone can spend it on someone
 *     else's username and briefly lock them out.
 */
export function createDurableLoginRateLimiter(db: Db, opts: { windowMs: number; max: number; accountMax: number; onBlocked?: (req: express.Request) => void }) {
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
    const nowMs = Date.now();
    const perAddress = consume(`${getClientIp(req)}:${username}`, nowMs);
    const perAccount = consume(`account:${username}`, nowMs);
    // Whichever bucket is over its limit decides how long to wait (the later reset if both are).
    const blocking = [
      ...(perAddress.count > opts.max ? [perAddress] : []),
      ...(perAccount.count > opts.accountMax ? [perAccount] : []),
    ];
    if (blocking.length === 0) return next();
    const resetAt = Math.max(...blocking.map((bucket) => bucket.resetAt));
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    opts.onBlocked?.(req);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ error: "rate_limited", message: `Too many requests. Please wait ${retryAfterSeconds} seconds and try again.`, retryAfterSeconds });
  };
}

export function getLoginRateLimitConfig() {
  const windowMs = Number(process.env.BEHOLDEN_LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
  const max = Number(process.env.BEHOLDEN_LOGIN_RATE_LIMIT_MAX ?? 10);
  // Per-account ceiling across all addresses: 50 per 15 minutes stops a distributed guessing run
  // while leaving a real user plenty of room if someone else is hammering their username.
  const configuredAccountMax = Number(process.env.BEHOLDEN_LOGIN_ACCOUNT_RATE_LIMIT_MAX ?? 50);
  const accountMax = Number.isFinite(configuredAccountMax) && configuredAccountMax > 0 ? configuredAccountMax : 50;
  const enabled = Number.isFinite(windowMs) && Number.isFinite(max) && windowMs > 0 && max > 0;
  return { windowMs, max, accountMax, enabled };
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
