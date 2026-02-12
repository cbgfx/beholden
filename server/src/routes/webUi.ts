import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

import express from "express";

export function registerWebUiRoutes(app: Express, ctx: ServerContext) {
  if (!ctx.paths.hasWebDist) return;

  app.use(express.static(ctx.paths.webDistDir));

  // SPA fallback (must come after API routes; this is safe because it skips /api).
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(ctx.path.join(ctx.paths.webDistDir, "index.html"));
  });
}
