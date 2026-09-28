/**
 * createServer.ts
 *
 * Orchestration only — wires dependencies together and starts the server.
 * Business logic lives in dedicated modules:
 *   - security.ts  → CORS, basic auth, rate limiting
 *   - routes/*     → API handlers
 */

import express from "express";
import compression from "compression";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { getRuntimeConfig } from "../config/runtime.js";
import { createCompendiumUpload, createDatabaseUpload, imageUpload, upload } from "../lib/upload.js";
import { getPaths } from "../config/paths.js";
import { openDb } from "../lib/db.js";
import { ensureCombat, nextLabelNumber, createPlayerCombatant } from "../services/combat.js";
import { seedDefaultConditions } from "../services/conditions.js";
import { now, uid } from "../lib/runtime.js";
import { normalizeKey, parseLeadingInt } from "../lib/text.js";
import { normalizeHp } from "../services/compendium/normalizeHp.js";
import { createBroadcaster, createWsServer, sendWsEvent, type WsUser } from "./ws.js";
import { createEgressLoggingMiddleware, egressLogMinBytes } from "./egressLogging.js";
import type { ServerContext } from "./context.js";
import type { BroadcastFn } from "./events.js";
import { multerErrorMiddleware, zodErrorMiddleware } from "../lib/validate.js";
import { seedDefaultSrdCompendium } from "../services/compendium/defaultSrdCompendium.js";
import { runStartupMaintenance } from "../services/maintenance/startupMaintenance.js";

import {
  createInMemoryRateLimiter,
  createDurableLoginRateLimiter,
  getRateLimitConfig,
  getUploadRateLimitConfig,
  isImageUploadRequest,
  corsMiddleware,
  getAllowedOriginHosts,
  getLoginRateLimitConfig,
  securityHeadersMiddleware,
  trustProxyHeadersEnabled,
} from "./security.js";

import { hashPassword, configureSigningSecret } from "../lib/jwtAuth.js";
import { currentSessionUser } from "../lib/sessionAuth.js";
import { recordAuthAudit } from "../lib/authAudit.js";
import { requireCurrentAccount } from "../middleware/auth.js";
import { canDeliverEvent } from "./eventVisibility.js";
import { registerAuthRoutes } from "../routes/authRoutes.js";
import { registerAdminRoutes } from "../routes/adminRoutes.js";
import { registerHealthRoutes } from "../routes/health.js";
import { registerMetaRoutes } from "../routes/meta.js";
import { registerCompendiumRoutes } from "../routes/compendium.js";
import { registerCampaignRoutes } from "../routes/campaigns/core.js";
import { registerCampaignBootstrapRoute } from "../routes/campaigns/bootstrap.js";
import { registerPlayerRoutes } from "../routes/players.js";
import { registerCharacterRoutes } from "../routes/characters/core.js";
import { registerInpcRoutes } from "../routes/inpcs.js";
import { registerAdventureRoutes } from "../routes/adventures.js";
import { registerEncounterRoutes } from "../routes/encounters.js";
import { registerNoteRoutes } from "../routes/notes.js";
import { registerCombatRoutes } from "../routes/combat/core.js";
import { registerReorderRoutes } from "../routes/reorder.js";
import { registerTreasureRoutes } from "../routes/treasure/core.js";
import { registerExportImportRoutes } from "../routes/exportImport/core.js";
import { registerUpdateCheckRoutes } from "../routes/updateCheck.js";
import { registerWebUiRoutes } from "../routes/webUi.js";
import { registerPartyInventoryRoutes } from "../routes/partyInventory.js";
import { registerSharedNotesRoutes } from "../routes/sharedNotes.js";
import { registerBastionRoutes } from "../routes/bastions.js";
import { registerBinderRoutes } from "../routes/binders/core.js";
import { registerBinderReferenceRoutes } from "../routes/binders/references.js";
import { registerBinderMortalRoutes } from "../routes/binders/mortals.js";
import { registerBinderLoreRoutes } from "../routes/binders/lore.js";

/** Image directories served straight out of the data directory. */
const IMAGE_MOUNTS = [
  "campaign-images",
  "player-images",
  "binder-mortal-images",
  "binder-deity-images",
  "character-images",
] as const;

export function createServer() {
  const runtime = getRuntimeConfig();
  configureSigningSecret(runtime.dataDir);
  const paths = getPaths({ dataDir: runtime.dataDir, ...(runtime.dbPath != null ? { dbPath: runtime.dbPath } : {}) });

  // --- database -------------------------------------------------------------
  const db = openDb(paths.dbPath);
  // Sweep orphaned images and compact the file while this is the only connection.
  runStartupMaintenance(db, paths.dataDir);
  const seededSrd = seedDefaultSrdCompendium(db);
  if (seededSrd.imported > 0) {
    console.log(`[beholden] Imported ${seededSrd.imported} default SRD compendium entries.`);
  }
  seedAdminUser(db, hashPassword, uid, now);

  // --- broadcast ------------------------------------------------------------
  // Stable closure so ctx.broadcast never needs to be reassigned and no
  // request in the startup window can capture the noop by value.
  let realBroadcast: BroadcastFn = (() => { /* noop until WS ready */ }) as BroadcastFn;
  const broadcast: BroadcastFn = ((type: never, payload: never) => realBroadcast(type, payload)) as BroadcastFn;

  // --- app ------------------------------------------------------------------
  const app = express();
  app.disable("x-powered-by");
  app.set("etag", "strong");
  app.set("trust proxy", trustProxyHeadersEnabled());

  const logEgress = String(process.env.BEHOLDEN_LOG_EGRESS ?? "").trim().toLowerCase();
  const shouldLogEgress = logEgress === "1" || logEgress === "true" || logEgress === "yes";
  if (shouldLogEgress) {
    // Register before compression so the bytes observed here are the compressed bytes
    // written to the HTTP response rather than the larger source JSON/body.
    app.use(createEgressLoggingMiddleware({
      minBytes: egressLogMinBytes(process.env.BEHOLDEN_LOG_EGRESS_MIN_BYTES),
    }));
  }

  // Compress API/static responses to cut egress for large JSON payloads.
  app.use(compression({ threshold: 1024 }));

  app.use(express.json({ limit: process.env.BEHOLDEN_JSON_LIMIT ?? "2mb" }));

  // CORS — must be before basic auth so preflight and 401s carry the header
  app.use(corsMiddleware(getAllowedOriginHosts()));
  app.use(securityHeadersMiddleware());

  const loginRateLimit = getLoginRateLimitConfig();
  if (loginRateLimit.enabled) {
    app.use(createDurableLoginRateLimiter(db, {
      ...loginRateLimit,
      onBlocked: (req) => recordAuthAudit(db, req, "login_throttled", {
        username: String((req.body as { username?: unknown } | undefined)?.username ?? "").trim().toLowerCase(),
      }),
    }));
  }

  // JWT auth — required for all API routes except health check and login.
  app.use("/api", (req, res, next) => {
    if (req.path === "/health") return next();
    if (req.path === "/auth/login" && req.method === "POST") return next();
    requireCurrentAccount(db)(req, res, next);
  });

  // Rate limiting
  const rateLimit = getRateLimitConfig();
  if (rateLimit.enabled) {
    app.use(createInMemoryRateLimiter({ windowMs: rateLimit.windowMs, max: rateLimit.max }));
  }

  // Image uploads cost far more than a JSON request, so they get their own tighter bucket
  // on top of the general limit.
  const uploadRateLimit = getUploadRateLimitConfig();
  if (uploadRateLimit.enabled) {
    app.use(createInMemoryRateLimiter({
      windowMs: uploadRateLimit.windowMs,
      max: uploadRateLimit.max,
      keyPrefix: "upload:",
      appliesTo: isImageUploadRequest,
    }));
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
    imageUpload,
    compendiumUpload: createCompendiumUpload(paths.dataDir),
    dbImportUpload: createDatabaseUpload(paths.dataDir),
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
    },
  };

  // --- images (static) ------------------------------------------------------
  // Every image directory is served the same way: revalidate after an hour, but a URL carrying the
  // ?v=<image_updated_at> the API hands out may be cached for ever, because replacing an image always
  // changes that value. Serving them immutable without that check (as the binder mounts used to)
  // meant a replaced portrait could stay stale in a browser for a year.
  for (const mount of IMAGE_MOUNTS) {
    const directory = path.join(paths.dataDir, mount);
    fs.mkdirSync(directory, { recursive: true });
    app.use(`/${mount}`, express.static(directory, {
      maxAge: "1h",
      etag: true,
      lastModified: true,
      setHeaders: (res) => {
        if (res.req.url?.includes("?v=")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }));
    // A missing image is a missing image. Without this it falls through to the web UI catch-all,
    // so every broken <img> downloads the whole single-page app and reports 200.
    app.use(`/${mount}`, (_req, res) => {
      res.status(404).json({ ok: false, message: "Image not found." });
    });
  }

  // --- routes ---------------------------------------------------------------
  registerAuthRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
  registerHealthRoutes(app, ctx);
  registerMetaRoutes(app, ctx);
  registerCompendiumRoutes(app, ctx);
  registerCampaignRoutes(app, ctx);
  registerCampaignBootstrapRoute(app, ctx);
  registerPlayerRoutes(app, ctx);
  registerCharacterRoutes(app, ctx);
  registerInpcRoutes(app, ctx);
  registerAdventureRoutes(app, ctx);
  registerEncounterRoutes(app, ctx);
  registerNoteRoutes(app, ctx);
  registerSharedNotesRoutes(app, ctx);
  registerCombatRoutes(app, ctx);
  registerReorderRoutes(app, ctx);
  registerTreasureRoutes(app, ctx);
  registerExportImportRoutes(app, ctx);
  registerUpdateCheckRoutes(app, ctx);
  registerBinderRoutes(app, ctx);
  registerBinderReferenceRoutes(app, ctx);
  registerBinderMortalRoutes(app, ctx);
  registerBinderLoreRoutes(app, ctx);
  registerWebUiRoutes(app, ctx);
  registerPartyInventoryRoutes(app, ctx);
  registerBastionRoutes(app, ctx);

  // --- error handling -------------------------------------------------------
  app.use(multerErrorMiddleware);
  app.use(zodErrorMiddleware);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  });

  // --- start ----------------------------------------------------------------
  const httpServer = app.listen(runtime.port, runtime.host, () => {
    console.log(`[beholden] API listening on http://${runtime.host}:${runtime.port}`);
  });
  let reportedServerError = false;
  const reportServerError = (error: Error & { code?: string }) => {
    if (reportedServerError) return;
    reportedServerError = true;
    if (error.code === "EADDRINUSE") {
      console.error(
        `[beholden] Cannot start: port ${runtime.port} is already in use. `
        + "Close the older Beholden window/process, then try again.",
      );
    } else {
      console.error("[beholden] Server failed:", error);
    }
    process.exitCode = 1;
  };
  httpServer.on("error", reportServerError);

  const wss = createWsServer({
    httpServer,
    path: "/ws",
    onConnectionHello: (ws) => {
      sendWsEvent(ws, "hello", { ok: true, time: now() });
    },
    authorize: (req) => {
      const sessionUser = currentSessionUser(db, req);
      if (sessionUser) return { userId: sessionUser.userId, isAdmin: sessionUser.isAdmin } satisfies WsUser;
      return null;
    },
  });
  // ws mirrors errors from the attached HTTP server. Handle that mirror so a
  // port collision produces one concise startup message instead of an
  // unhandled WebSocketServer error and stack trace.
  wss.on("error", reportServerError);

  realBroadcast = createBroadcaster(wss, {
    // Scope filtering only asks which campaign a socket is looking at; this also asks who is on it.
    canDeliver: (user, type, payload) => canDeliverEvent(db, user, type, payload),
  });

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;

    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });

    db.close();
  };

  return { app, httpServer, wss, close };
}

function seedAdminUser(
  db: ReturnType<typeof openDb>,
  hashPw: (pw: string) => string,
  genUid: () => string,
  genNow: () => number,
): void {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (count > 0) return;

  const username = process.env.BEHOLDEN_ADMIN_USER ?? "admin";
  const configuredPassword = process.env.BEHOLDEN_ADMIN_PASS?.trim();
  const password = configuredPassword || randomBytes(18).toString("base64url");
  const id = genUid();
  const t = genNow();
  db.prepare(
    "INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
  ).run(id, username, hashPw(password), "Administrator", t, t);
  console.log(`[beholden] Created initial admin account: ${username}`);
  if (!configuredPassword) console.log(`[beholden] One-time generated admin password: ${password}`);
}
