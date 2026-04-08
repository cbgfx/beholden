import path from "node:path";
import os from "node:os";

const APP_NAME = "Beholden";

export function getRuntimeConfig() {
  // Railway and most cloud providers inject a PORT variable.
  // We must prioritize this for the health check to pass.
  const port = process.env.PORT ? Number(process.env.PORT) : 5174;

  // The server needs to be reachable from LAN clients during local development
  // as well as in production deployments, so default to 0.0.0.0 unless a host
  // is explicitly provided.
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_PROJECT_ID;
  const host = process.env.HOST || "0.0.0.0";

  const dataDir = process.env.BEHOLDEN_DATA_DIR
    ? path.resolve(process.env.BEHOLDEN_DATA_DIR)
    : getDefaultDataDir();

  const dbPath = process.env.BEHOLDEN_DB_PATH
    ? path.resolve(process.env.BEHOLDEN_DB_PATH)
    : undefined;

  return {
    appName: APP_NAME,
    host,
    port,
    dataDir,
    ...(dbPath != null ? { dbPath } : {}),
  };
}

function getDefaultDataDir() {
  const platform = process.platform;

  if (platform === "win32") {
    const base =
      process.env.APPDATA ||
      process.env.LOCALAPPDATA ||
      path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, APP_NAME);
  }

  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }

  return path.join(os.homedir(), ".local", "share", "beholden");
}
