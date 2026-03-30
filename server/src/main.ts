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
  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);

  const candidates = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) return;

  // In local dev, let the repo .env drive behavior for convenience.
  // In Railway/production, keep dashboard-provided env vars authoritative.
  dotenv.config({ path: found, override: !isRailway });
})();

createServer();
