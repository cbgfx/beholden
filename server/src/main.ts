import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { createServer } from "./server/createServer.js";

// Load environment variables from .env.
// Supports both:
//  - repo root: <repo>/.env
//  - server folder: <repo>/server/.env
// because npm workspaces may set process.cwd() differently depending on the script.
(function loadEnv() {
  const cwd = process.cwd();

  const candidates = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  // Allow repo-local .env to override machine/user environment variables.
  // This keeps dev toggles (like BEHOLDEN_SUPPORT=false) predictable.
  if (found) dotenv.config({ path: found, override: true });
})();

createServer();
