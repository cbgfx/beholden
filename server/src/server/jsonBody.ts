import express from "express";

/** JSON requests never need transport compression. Reject encoded bodies before decompression. */
export function createJsonBodyParser() {
  return express.json({ limit: process.env.BEHOLDEN_JSON_LIMIT ?? "2mb", inflate: false });
}
