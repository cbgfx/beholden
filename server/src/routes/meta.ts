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

    res.json({
      ok: true,
      host: ctx.runtime.host,
      port: ctx.runtime.port,
      ips,
      dataDir: ctx.paths.dataDir,
      hasCompendium: ctx.fs.existsSync(ctx.paths.compendiumPath),
    });
  });
}
