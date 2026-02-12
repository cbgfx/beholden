import path from "node:path";
import os from "node:os";

const APP_NAME = "Beholden";

export function getRuntimeConfig() {
  const port = Number(process.env.PORT ?? 5174);
  const host = process.env.HOST ?? "0.0.0.0";

  const dataDir = process.env.BEHOLDEN_DATA_DIR
    ? path.resolve(process.env.BEHOLDEN_DATA_DIR)
    : getDefaultDataDir();

  return {
    appName: APP_NAME,
    host,
    port,
    dataDir,
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

  // linux + others
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg && xdg.trim().length > 0 ? xdg : path.join(os.homedir(), ".local", "share");
  // convention: lowercase folder name on linux
  return path.join(base, "beholden");
}
