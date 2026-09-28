import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Request, Response } from "express";
import type { Db } from "./db.js";
import type { JwtPayload } from "./jwtAuth.js";
import { trustProxyHeadersEnabled } from "../server/security.js";

const SESSION_COOKIE = "beholden_session";
export const CSRF_HEADER = "x-beholden-csrf";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");

function cookieValue(header: string | undefined, name: string): string | null {
  for (const part of String(header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0 || part.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
  }
  return null;
}

function secureRequest(req: Pick<Request, "secure" | "headers">): boolean {
  return req.secure || (trustProxyHeadersEnabled()
    && String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim() === "https");
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: secureRequest(req), sameSite: "lax", path: "/", maxAge: SESSION_LIFETIME_MS,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: secureRequest(req), sameSite: "lax", path: "/" });
}

export function createSession(db: Db, userId: string, now = Date.now()): { id: string; token: string; csrfToken: string; expiresAt: number } {
  db.prepare("DELETE FROM auth_sessions WHERE expires_at<=? OR revoked_at IS NOT NULL").run(now);
  const stale = db.prepare(`SELECT id FROM auth_sessions WHERE user_id=? AND revoked_at IS NULL
    ORDER BY last_seen_at DESC LIMIT -1 OFFSET 19`).all(userId) as Array<{ id: string }>;
  if (stale.length) {
    const remove = db.prepare("DELETE FROM auth_sessions WHERE id=?");
    db.transaction(() => { for (const session of stale) remove.run(session.id); })();
  }
  const id = randomToken();
  const token = randomToken();
  const csrfToken = randomToken();
  const expiresAt = now + SESSION_LIFETIME_MS;
  db.prepare("INSERT INTO auth_sessions (id,user_id,token_hash,csrf_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?)")
    .run(id, userId, hash(token), hash(csrfToken), now, now, expiresAt);
  return { id, token, csrfToken, expiresAt };
}

export function currentSessionUser(db: Db, req: Pick<IncomingMessage, "headers">, now = Date.now()): (JwtPayload & { sessionId: string; csrfHash: string }) | null {
  const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
  if (!token) return null;
  const row = db.prepare(`SELECT s.id AS session_id,s.csrf_hash,s.last_seen_at,u.id,u.username,u.is_admin
    FROM auth_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`).get(hash(token), now) as
    { session_id: string; csrf_hash: string; last_seen_at: number; id: string; username: string; is_admin: number } | undefined;
  if (!row) return null;
  if (now - row.last_seen_at > 5 * 60 * 1000) db.prepare("UPDATE auth_sessions SET last_seen_at=? WHERE id=?").run(now, row.session_id);
  return { userId: row.id, username: row.username, isAdmin: Boolean(row.is_admin), sessionId: row.session_id, csrfHash: row.csrf_hash };
}

export function sessionCsrfMatches(expectedHash: string, supplied: unknown): boolean {
  if (typeof supplied !== "string" || !supplied) return false;
  const actual = Buffer.from(hash(supplied));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function revokeSession(db: Db, sessionId: string, now = Date.now()): void {
  db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL").run(now, sessionId);
}

export function revokeUserSessions(db: Db, userId: string, now = Date.now(), exceptId?: string): void {
  if (exceptId) db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND id!=? AND revoked_at IS NULL").run(now, userId, exceptId);
  else db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").run(now, userId);
}

export function rotateSessionCsrf(db: Db, sessionId: string): string {
  const csrfToken = randomToken();
  db.prepare("UPDATE auth_sessions SET csrf_hash=? WHERE id=?").run(hash(csrfToken), sessionId);
  return csrfToken;
}
