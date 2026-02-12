import express from "express";
import cors from "cors";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

import { getRuntimeConfig } from "../config/runtime.js";
import { upload } from "../lib/upload.js";
import { getPaths } from "../config/paths.js";
import {
  ensureCampaignIndexExists,
  loadAllCampaignFiles,
  persistCampaignStorageFromUserData,
  campaignFilePath,
} from "../services/campaignStorage.js";
import { loadJson } from "../lib/jsonFile.js";
import { createCompendium } from "../services/compendium/compendium.js";
import { importCompendiumXml } from "../services/compendium/importXml.js";
import { seedDefaultConditions } from "../services/conditions.js";
import { ensureCombat, nextLabelNumber, createPlayerCombatant } from "../services/combat.js";
import { now, uid } from "../lib/runtime.js";
import { bySortThenUpdatedDesc, nextSort } from "../lib/sort.js";
import { normalizeKey, parseLeadingInt } from "../lib/text.js";
import { normalizeHp } from "../services/compendium/normalizeHp.js";
import { createWsServer, createBroadcaster } from "./ws.js";
import type { ServerContext } from "./context.js";
import { multerErrorMiddleware, zodErrorMiddleware } from "../shared/validate.js";

// This file owns orchestration (dependencies + wiring).
// Route handlers stay in dedicated routers.

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
  const paths = getPaths({ dataDir: runtime.dataDir });

  ensureCampaignIndexExists(paths);
  const userData = loadAllCampaignFiles(paths);

  // --- persistence ----------------------------------------------------------
  let saveTimer: NodeJS.Timeout | null = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistCampaignStorageFromUserData(paths, userData);
    }, 150);
  }

  // --- compendium -----------------------------------------------------------
  const compendium = createCompendium({ compendiumPath: paths.compendiumPath });

  // --- app -----------------------------------------------------------------
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "10mb" }));

  // websocket (created after http server)
  let broadcast: ServerContext["broadcast"] = () => {};

  const ctx: ServerContext = {
    runtime,
    paths,
    os,
    fs,
    path,
    userData,
    scheduleSave,
    broadcast: (type, payload) => broadcast(type, payload),
    compendium,
    upload,
    helpers: {
      now,
      uid,
      normalizeKey,
      parseLeadingInt,
      normalizeHp,
      bySortThenUpdatedDesc,
      nextSort,
      ensureCombat: (encounterId) => ensureCombat(userData, encounterId),
      nextLabelNumber: (encounterId, baseName) => nextLabelNumber(userData, encounterId, baseName),
      createPlayerCombatant,
      seedDefaultConditions: (campaignId) => seedDefaultConditions(userData, campaignId),
      campaignFilePath: (campaignId) => campaignFilePath(paths, campaignId),
      loadCampaignFile: (campaignId) => loadJson(campaignFilePath(paths, campaignId), null),
      importCompendiumXml: ({ xml }) => importCompendiumXml({ xml, compendium }),
    },
  };

  // zod + error handling (route handlers can throw schema errors)
  app.use(zodErrorMiddleware);

  // --- register routes (each file does one thing) ---------------------------
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
    console.log(`API listening on http://${runtime.host}:${runtime.port}`);
  });

  const wss = createWsServer({
    httpServer,
    path: "/ws",
    onConnectionHello: (ws) => {
      ws.send(JSON.stringify({ type: "hello", payload: { ok: true, time: now() } }));
    },
  });
  broadcast = createBroadcaster(wss);

  return { app, httpServer, wss, ctx };
}
