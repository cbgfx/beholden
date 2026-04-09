// server/src/routes/compendium/admin.ts
// Admin routes: wipe compendium, import XML.

import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireAdmin } from "../../middleware/auth.js";

export function registerCompendiumAdminRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  app.delete("/api/compendium", requireAdmin, (_req, res) => {
    db.transaction(() => {
      db.prepare("DELETE FROM compendium_monsters").run();
      db.prepare("DELETE FROM compendium_items").run();
      db.prepare("DELETE FROM compendium_spells").run();
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

  app.post("/api/compendium/import/xml", requireAdmin, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });
    const xml = req.file.buffer.toString("utf-8");
    const out = ctx.helpers.importCompendiumXml({ xml });
    ctx.broadcast("compendium:changed", { imported: out.imported, total: out.total });
    res.json({
      ok: true,
      imported: out.imported,
      total: out.total,
      items: out.items ?? 0,
      classes: out.classes ?? 0,
      races: out.races ?? 0,
      backgrounds: out.backgrounds ?? 0,
      feats: out.feats ?? 0,
      decks: out.decks ?? 0,
      bastions: out.bastions ?? 0,
    });
  });

  app.post("/api/compendium/import/sqlite", requireAdmin, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });
    const out = ctx.helpers.importCompendiumSqlite({ buffer: req.file.buffer });
    ctx.broadcast("compendium:changed", { imported: out.imported, total: out.total });
    res.json({
      ok: true,
      imported: out.imported,
      total: out.total,
      spells: out.spells,
      items: out.items,
      classes: out.classes,
      races: out.races,
      backgrounds: out.backgrounds,
      feats: out.feats,
      decks: out.decks,
      bastions: out.bastions ?? 0,
    });
  });
}
