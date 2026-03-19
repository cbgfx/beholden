/**
 * createServer.ts
 *
 * Orchestration only — wires dependencies together and starts the server.
 * Business logic lives in dedicated modules:
 *   - security.ts  → CORS, basic auth, rate limiting
 *   - routes/*     → API handlers
 */

import express from "express";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

import { getRuntimeConfig } from "../config/runtime.js";
import { upload } from "../lib/upload.js";
import { getPaths } from "../config/paths.js";
import { openDb } from "../lib/db.js";
import { importCompendiumXml } from "../services/compendium/importXml.js";
import { ensureCombat, nextLabelNumber, createPlayerCombatant } from "../services/combat.js";
import { seedDefaultConditions } from "../services/conditions.js";
import { now, uid } from "../lib/runtime.js";
import { normalizeKey, parseLeadingInt } from "../lib/text.js";
import { normalizeHp } from "../services/compendium/normalizeHp.js";
import { createWsServer, sendWsEvent } from "./ws.js";
import type { ServerContext } from "./context.js";
import type { BroadcastFn } from "./events.js";
import { multerErrorMiddleware, zodErrorMiddleware } from "../shared/validate.js";

import {
  basicAuthCheck,
  getBasicAuthConfig,
  createInMemoryRateLimiter,
  getRateLimitConfig,
  corsMiddleware,
  getAllowedOriginHosts,
} from "./security.js";

import { registerHealthRoutes } from "../routes/health.js";
import { registerMetaRoutes } from "../routes/meta.js";
import { registerCompendiumRoutes } from "../routes/compendium.js";
import { registerCampaignRoutes } from "../routes/campaigns.js";
import { registerPlayerRoutes } from "../routes/players.js";
import { registerInpcRoutes } from "../routes/inpcs.js";
import { registerAdventureRoutes } from "../routes/adventures.js";
import { registerEncounterRoutes } from "../routes/encounters.js";
import { registerNoteRoutes } from "../routes/notes.js";
import { registerCombatRoutes } from "../routes/combat.js";
import { registerReorderRoutes } from "../routes/reorder.js";
import { registerTreasureRoutes } from "../routes/treasure.js";
import { registerExportImportRoutes } from "../routes/exportImport.js";
import { registerWebUiRoutes } from "../routes/webUi.js";

export function createServer() {
  const runtime = getRuntimeConfig();
  const paths = getPaths({ dataDir: runtime.dataDir, ...(runtime.dbPath != null ? { dbPath: runtime.dbPath } : {}) });

  // --- database -------------------------------------------------------------
  const db = openDb(paths.dbPath);

  // --- broadcast (filled in after WS server starts) -------------------------
  const noopBroadcast: BroadcastFn = (() => { /* noop */ }) as BroadcastFn;
  let broadcast: BroadcastFn = noopBroadcast;

  // --- app ------------------------------------------------------------------
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json({ limit: process.env.BEHOLDEN_JSON_LIMIT ?? "2mb" }));

  // CORS — must be before basic auth so preflight and 401s carry the header
  app.use(corsMiddleware(getAllowedOriginHosts()));

  // Basic auth
  const auth = getBasicAuthConfig();
  if (auth.enabled) {
    app.use((req, res, next) => {
      if (basicAuthCheck(req.headers.authorization, auth.user, auth.pass)) return next();
      res.setHeader("WWW-Authenticate", 'Basic realm="Beholden"');
      res.status(401).send("Unauthorized");
    });
  }

  // Rate limiting
  const rateLimit = getRateLimitConfig();
  if (rateLimit.enabled) {
    app.use(createInMemoryRateLimiter({ windowMs: rateLimit.windowMs, max: rateLimit.max }));
  }

  // --- context --------------------------------------------------------------
  const ctx: ServerContext = {
    runtime,
    paths,
    os,
    fs,
    path,
    db,
    broadcast,
    upload,
    helpers: {
      now,
      uid,
      normalizeKey,
      parseLeadingInt,
      normalizeHp,
      ensureCombat: (encounterId) => ensureCombat(db, encounterId),
      nextLabelNumber: (encounterId, baseName) => nextLabelNumber(db, encounterId, baseName),
      createPlayerCombatant,
      seedDefaultConditions: (campaignId) => seedDefaultConditions(db, campaignId),
      importCompendiumXml: ({ xml }) => importCompendiumXml({ xml, db }),
    },
  };

  // --- campaign images (static) --------------------------------------------
  const campaignImagesDir = path.join(paths.dataDir, "campaign-images");
  fs.mkdirSync(campaignImagesDir, { recursive: true });
  app.use("/campaign-images", express.static(campaignImagesDir));

  // --- player images (static) ----------------------------------------------
  const playerImagesDir = path.join(paths.dataDir, "player-images");
  fs.mkdirSync(playerImagesDir, { recursive: true });
  app.use("/player-images", express.static(playerImagesDir));

  // --- routes ---------------------------------------------------------------
  registerHealthRoutes(app, ctx);
  registerMetaRoutes(app, ctx);
  registerCompendiumRoutes(app, ctx);
  registerCampaignRoutes(app, ctx);
  registerPlayerRoutes(app, ctx);
  registerInpcRoutes(app, ctx);
  registerAdventureRoutes(app, ctx);
  registerEncounterRoutes(app, ctx);
  registerNoteRoutes(app, ctx);
  registerCombatRoutes(app, ctx);
  registerReorderRoutes(app, ctx);
  registerTreasureRoutes(app, ctx);
  registerExportImportRoutes(app, ctx);
  registerWebUiRoutes(app, ctx);

  // --- error handling -------------------------------------------------------
  app.use(multerErrorMiddleware);
  app.use(zodErrorMiddleware);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  });

  // --- start ----------------------------------------------------------------
  const httpServer = app.listen(runtime.port, runtime.host, () => {
    if (process.env.BEHOLDEN_DEBUG === "true") {
      console.log(`API listening on http://${runtime.host}:${runtime.port}`);
    }
  });

  const wss = createWsServer({
    httpServer,
    path: "/ws",
    onConnectionHello: (ws) => {
      sendWsEvent(ws, "hello", { ok: true, time: now() });
    },
    ...(auth.enabled && {
      authorize: (req) => basicAuthCheck(req.headers.authorization, auth.user, auth.pass),
    }),
  });

  broadcast = (event, data) => {
    for (const client of wss.clients) {
      sendWsEvent(client as any, event, data);
    }
  };
  ctx.broadcast = broadcast;

  return { app, httpServer, wss };
}
