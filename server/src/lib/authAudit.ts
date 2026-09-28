import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { Db } from "./db.js";
import { getClientIp } from "../server/security.js";

export type AuthAuditEvent = "login_succeeded" | "login_failed" | "login_throttled" | "logout" | "username_changed"
  | "password_changed" | "account_created" | "password_reset" | "privilege_changed"
  | "session_revoked" | "other_sessions_revoked" | "account_deleted";

export function recordAuthAudit(db: Db, req: Request, event: AuthAuditEvent, data: {
  userId?: string | null; username?: string | null; detail?: Record<string, unknown>;
} = {}): void {
  db.prepare(`INSERT INTO auth_audit_log (id,user_id,username,event,client_ip,detail_json,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(
    randomUUID(), data.userId ?? null, data.username ?? null, event, getClientIp(req),
    data.detail ? JSON.stringify(data.detail) : null, Date.now(),
  );
}
