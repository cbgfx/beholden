// server/src/routes/compendium/admin.ts
// Admin routes for the canonical Beholden compendium.

import type { Express } from "express";
import { ZipArchive } from "archiver";
import type { ServerContext } from "../../server/context.js";
import { requireAdmin } from "../../middleware/auth.js";
import {
  exportNativeCompendiumBundle,
  importNativeCompendiumDocument,
  isNativeCompendiumCategory,
  NATIVE_COMPENDIUM_CATEGORIES,
  previewNativeCompendiumDocument,
} from "../../services/compendium/nativeCompendium.js";
import { migrateLiveCompendiumReferences } from "../../services/compendium/liveReferenceMigration.js";

export function registerCompendiumAdminRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  app.delete("/api/compendium", requireAdmin, (_req, res) => {
    db.transaction(() => {
      db.prepare("DELETE FROM compendium_monsters").run();
      db.prepare("DELETE FROM compendium_items").run();
      db.prepare("DELETE FROM compendium_spells").run();
      db.prepare("DELETE FROM compendium_class_talents").run();
      db.prepare("DELETE FROM compendium_classes").run();
      db.prepare("DELETE FROM compendium_races").run();
      db.prepare("DELETE FROM compendium_backgrounds").run();
      db.prepare("DELETE FROM compendium_feats").run();
      db.prepare("DELETE FROM compendium_deck_cards").run();
      db.prepare("DELETE FROM compendium_bastion_spaces").run();
      db.prepare("DELETE FROM compendium_bastion_orders").run();
      db.prepare("DELETE FROM compendium_bastion_facilities").run();
    })();
    ctx.broadcast("compendium:changed", { cleared: true });
    res.json({ ok: true });
  });

  app.get("/api/compendium/live-reference-migration", requireAdmin, (_req, res) => {
    try {
      return res.json({ ok: true, ...migrateLiveCompendiumReferences(db, false) });
    } catch (error) {
      return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Migration preview failed." });
    }
  });

  app.post("/api/compendium/live-reference-migration", requireAdmin, (_req, res) => {
    try {
      const result = migrateLiveCompendiumReferences(db, true);
      ctx.broadcast("compendium:changed", { liveReferencesMigrated: true, changedRows: result.changedRows, changedReferences: result.changedReferences });
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Live reference migration failed." });
    }
  });

  app.get("/api/compendium/native/:category/export", requireAdmin, (req, res) => {
    const category = String(req.params.category ?? "");
    if (!isNativeCompendiumCategory(category)) {
      return res.status(400).json({ ok: false, message: "Unknown compendium category." });
    }
    const document = exportNativeCompendiumBundle(db, [category], { includeEmpty: true });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=beholden-compendium-${category}.json`,
    );
    res.send(JSON.stringify(document, null, 2));
  });

  app.get("/api/compendium/native/export-all.zip", requireAdmin, async (_req, res, next) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("error", next);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=beholden-compendium-all.zip",
    );
    archive.pipe(res);
    for (const category of NATIVE_COMPENDIUM_CATEGORIES) {
      const document = exportNativeCompendiumBundle(db, [category], { includeEmpty: true });
      archive.append(JSON.stringify(document, null, 2), {
        name: `beholden-compendium-${category}.json`,
      });
    }
    await archive.finalize();
  });

  function parseUploadedJson(file: Express.Multer.File): unknown {
    return JSON.parse(file.buffer.toString("utf-8").replace(/^\uFEFF/u, ""));
  }

  app.post("/api/compendium/native/import", requireAdmin, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });
    let document: unknown;
    try {
      document = parseUploadedJson(req.file);
    } catch {
      return res.status(400).json({ ok: false, message: "Invalid JSON." });
    }

    try {
      const out = importNativeCompendiumDocument(db, document);
      ctx.broadcast("compendium:changed", {
        nativeImported: true,
        category: out.batches.length === 1 ? out.batches[0]?.category ?? "unknown" : "bundle",
        imported: out.imported,
        total: out.total,
      });
      return res.json({ ok: true, ...out });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Native compendium import failed.";
      return res.status(400).json({ ok: false, message });
    }
  });

  app.post("/api/compendium/native/preview", requireAdmin, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });
    let document: unknown;
    try {
      document = parseUploadedJson(req.file);
    } catch {
      return res.status(400).json({ ok: false, message: "Invalid JSON." });
    }
    try {
      return res.json({ ok: true, ...previewNativeCompendiumDocument(db, document) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Native compendium preview failed.";
      return res.status(400).json({ ok: false, message });
    }
  });

}
