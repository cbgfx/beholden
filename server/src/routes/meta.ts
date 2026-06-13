import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerMetaRoutes(app: Express, ctx: ServerContext) {
  app.get("/api/meta", (_req, res) => {
    const ips: string[] = [];
    const nics = ctx.os.networkInterfaces();
    for (const name of Object.keys(nics)) {
      for (const ni of nics[name] ?? []) {
        if (ni.family === "IPv4" && !ni.internal) ips.push(ni.address);
      }
    }

    // Parse BEHOLDEN_SUPPORT with a forgiving boolean parser.
    // Accepts: true/false, 1/0, yes/no, on/off (case-insensitive).
    const supportEnv = String(process.env.BEHOLDEN_SUPPORT ?? "").trim().toLowerCase();
    const support = ["true", "1", "yes", "y", "on"].includes(supportEnv);

    res.json({
      ok: true,
      host: ctx.runtime.host,
      port: ctx.runtime.port,
      ips,
      dataDir: ctx.paths.dataDir,
      hasCompendium: (ctx.db.prepare("SELECT 1 FROM compendium_monsters LIMIT 1").get() != null),
      support,
    });
  });
}
