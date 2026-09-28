import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

import path from "node:path";
import express from "express";

/**
 * Paths that are asking for a file, not for a page.
 *
 * The SPA fallback answers unknown routes with index.html so client-side routing works, but a
 * request for a missing image or script is not a route — handing it an HTML page makes a broken
 * <img> look like a successful download and hides the real problem.
 */
const FILE_REQUEST = /\.(?:webp|png|jpe?g|gif|svg|ico|css|js|mjs|map|json|txt|xml|woff2?|ttf|otf|eot|zip|pdf|csv|wasm)$/i;

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
      if (FILE_REQUEST.test(req.path)) return res.status(404).type("text/plain").send("Not found.");
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
    if (FILE_REQUEST.test(req.path)) return res.status(404).type("text/plain").send("Not found.");
    res.sendFile(path.join(paths.webDistDir, "index.html"));
  });
}
