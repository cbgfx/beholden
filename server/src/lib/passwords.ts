// server/src/lib/passwords.ts
// Password hashing. Sign-in state lives in cookie sessions (lib/sessionAuth.ts).
//
// This file used to be jwtAuth.ts, which also signed and verified bearer JWTs. Nothing has issued a
// JWT since sessions arrived, so every real token had long expired, but the server kept accepting
// them - and a JWT could not be revoked by logging out or ending a session. The bearer path, its
// signing secret and the jsonwebtoken dependency are gone; only the hashing below remains.

import bcrypt from "bcryptjs";
import { runPasswordTask } from "./passwordWorker.js";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

/** Request-path variants keep bcrypt work off the Node event loop. */
export function hashPasswordAsync(password: string): Promise<string> {
  return runPasswordTask("hash", password);
}

export function verifyPasswordAsync(password: string, hash: string): Promise<boolean> {
  return runPasswordTask("verify", password, hash);
}
