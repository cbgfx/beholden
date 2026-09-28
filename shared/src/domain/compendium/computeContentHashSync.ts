/// <reference types="node" />
import { createHash } from "node:crypto";

// Synchronous twin of computeContentHash.ts -- same algorithm (SHA-256), same input bytes
// (`JSON.stringify(entry)`), same hex output, so the two always agree on a given entry's hash.
// This exists only because native compendium imports write rows inside a synchronous
// better-sqlite3 transaction, which cannot await Web Crypto's async digest API.
//
// Server-only: this imports `node:crypto`, so nothing in a browser bundle may import this file.
// Client code (and any server code outside that one hot transactional path) should use the async
// `computeContentHash` from ./computeContentHash.ts instead.
export function computeContentHashSync(entry: unknown): string {
  return createHash("sha256").update(JSON.stringify(entry)).digest("hex");
}
