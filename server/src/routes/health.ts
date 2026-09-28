import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerHealthRoutes(app: Express, ctx: ServerContext) {
  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      ctx.db.prepare("SELECT 1").get();
      return res.json({ ok: true, database: "ready", time: ctx.helpers.now() });
    } catch {
      return res.status(503).json({ ok: false, database: "unavailable", time: ctx.helpers.now() });
    }
  });
}
