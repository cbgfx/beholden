// Canonical content-addressing for a compendium entry: SHA-256 over `JSON.stringify(entry)`,
// hex-encoded. This is the exact same string a server write persists as `data_json`, so hashing
// it is equivalent to hashing what's actually stored -- client and server always agree on what
// "the same content" means because they both call this one function.
//
// Uses the Web Crypto API (`crypto.subtle`), available natively in browsers and in Node (global,
// no import needed) -- no extra dependency. This is async because Web Crypto has no synchronous
// digest API. The one call site that cannot await (the native compendium importer's
// synchronous better-sqlite3 transaction) uses `computeContentHashSync` instead -- see
// computeContentHashSync.ts for why, and why it's still the same algorithm over the same bytes.
export async function computeContentHash(entry: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(entry));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
