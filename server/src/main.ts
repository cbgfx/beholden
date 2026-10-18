import { loadEnvironment } from "./config/environment.js";
import { createServer } from "./server/createServer.js";

// Load environment variables from .env.
// Supports both:
//  - repo root: <repo>/.env
//  - server folder: <repo>/server/.env
// because npm workspaces may set process.cwd() differently depending on the script.
(function loadEnv() {
  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);

  // In local dev, let the repo .env drive behavior for convenience.
  // In Railway/production, keep dashboard-provided env vars authoritative.
  loadEnvironment({ override: !isRailway });
})();

const server = createServer();

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[beholden] Received ${signal}, shutting down gracefully...`);
  try {
    await server.close();
    console.log("[beholden] Shutdown complete.");
    process.exit(0);
  } catch (error) {
    console.error("[beholden] Graceful shutdown failed:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
