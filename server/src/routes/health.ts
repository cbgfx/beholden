import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerHealthRoutes(app: Express, ctx: ServerContext) {
  app.get("/api/health", (_req, res) => res.json({ ok: true, time: ctx.helpers.now() }));
}
