// server/src/lib/jwtAuth.ts
// JWT signing/verification and password hashing utilities.

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomBytes, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Db } from "./db.js";

// Isolated module consumers (tests) get an ephemeral private key. The server
// configures a durable installation key before accepting any requests.
export function loadSigningSecret(dataDir: string, configured = process.env.BEHOLDEN_JWT_SECRET): string {
  if (configured !== undefined) {
    if (!configured.trim() || configured === "beholden-dev-secret-change-in-prod") {
      throw new Error("BEHOLDEN_JWT_SECRET must be a private, nonempty secret.");
    }
    return configured;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "jwt-secret");
  try { fs.writeFileSync(file, randomBytes(48).toString("hex"), { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const secret = fs.readFileSync(file, "utf8").trim();
  if (secret.length < 32) throw new Error("Stored JWT signing secret is invalid.");
  return secret;
}
export function configureSigningSecret(dataDir: string) { JWT_SECRET = loadSigningSecret(dataDir); }
export function credentialVersion(passhash: string): string {
  return createHmac("sha256", JWT_SECRET).update(passhash).digest("hex");
}
export function currentTokenUser(db: Db, token: JwtPayload | null): JwtPayload | null {
  if (!token) return null;
  const row = db.prepare("SELECT username, is_admin, passhash FROM users WHERE id = ?").get(token.userId) as
    { username: string; is_admin: number; passhash: string } | undefined;
  if (!row || token.credentialVersion !== credentialVersion(row.passhash) || token.isAdmin !== Boolean(row.is_admin)) return null;
  return { ...token, username: row.username, isAdmin: Boolean(row.is_admin) };
}

let JWT_SECRET = randomBytes(48).toString("hex");
const JWT_EXPIRES_IN = "7d";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export interface JwtPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
  credentialVersion?: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload !== "object" || typeof payload.userId !== "string" || !payload.userId
      || typeof payload.username !== "string" || typeof payload.isAdmin !== "boolean") return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}
