import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

import path from "node:path";
import express from "express";

export function registerWebUiRoutes(app: Express, ctx: ServerContext) {
  const { paths } = ctx;
  const webPlayerSpaRoute = /^\/player(?:\/.*)?$/;
  const webDmSpaRoute = /^(?!\/api(?:\/|$)|\/player(?:\/|$)).*/;

  // web-player: served at /player (built with base: "/player/")
  if (paths.hasWebPlayerDist) {
    app.use("/player/assets", express.static(path.join(paths.webPlayerDistDir, "assets"), {
      maxAge: "1y",
      immutable: true,
    }));
    app.use("/player", express.static(paths.webPlayerDistDir));
    app.get(/^\/player\/assets\/.*$/, (_req, res) => {
      res.status(404).type("text/plain").send("Asset not found.");
    });
    app.get("/player", (_req, res) => {
      res.sendFile(path.join(paths.webPlayerDistDir, "index.html"));
    });
    app.get(webPlayerSpaRoute, (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      if (req.path.includes("/assets/")) return next();
      res.sendFile(path.join(paths.webPlayerDistDir, "index.html"));
    });
  }

  // web-dm: served at /
  if (!paths.hasWebDist) return;

  app.use("/assets", express.static(path.join(paths.webDistDir, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));
  app.use(express.static(paths.webDistDir));
  app.get(/^\/assets\/.*$/, (_req, res) => {
    res.status(404).type("text/plain").send("Asset not found.");
  });

  // SPA fallback (must come after API routes; this is safe because it skips /api).
  app.get(webDmSpaRoute, (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/player")) return next();
    if (req.path.includes("/assets/")) return next();
    res.sendFile(path.join(paths.webDistDir, "index.html"));
  });
}
