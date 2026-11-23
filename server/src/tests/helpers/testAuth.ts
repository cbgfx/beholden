// server/src/tests/helpers/testAuth.ts
//
// Route tests need to say "this request is from user X" without signing in through a real session.
// They used to mint real JWTs for that, which kept a bearer-token path alive in production code
// purely for the tests. Production now only knows cookie sessions, and tests use this instead:
// an unsigned, test-only token and the middleware that reads it. Nothing outside tests imports it.

import type { NextFunction, Request, Response } from "express";
import type { AuthUser } from "../../middleware/auth.js";

const PREFIX = "test.";

/** A test identity, sent as `Authorization: Bearer <token>`. Extra fields are ignored. */
export function signToken(user: AuthUser & Record<string, unknown>): string {
  const identity: AuthUser = { userId: user.userId, username: user.username, isAdmin: user.isAdmin };
  return PREFIX + Buffer.from(JSON.stringify(identity)).toString("base64url");
}

/** Stand-in for the session gatekeeper in tests: sets req.user from a signToken() token, else 401. */
export function testAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token.startsWith(PREFIX)) return res.status(401).json({ ok: false, message: "Unauthorized" });
  try {
    req.user = JSON.parse(Buffer.from(token.slice(PREFIX.length), "base64url").toString("utf8")) as AuthUser;
  } catch {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
}
