import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { rowToNote, nextSortFor, NOTE_COLS } from "../lib/db.js";

const NoteCreateBody = z.object({
  title: z.string().trim().optional(),
  text: z.string().optional(),
});

const NoteUpdateBody = z.object({
  title: z.string().trim().optional(),
  text: z.string().optional(),
});

export function registerNoteRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/notes", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db
      .prepare(
        `SELECT ${NOTE_COLS} FROM notes WHERE campaign_id = ? AND adventure_id IS NULL ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToNote));
  });

  app.get("/api/adventures/:adventureId/notes", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const rows = db
      .prepare(
        `SELECT ${NOTE_COLS} FROM notes WHERE adventure_id = ? ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(adventureId) as Record<string, unknown>[];
    res.json(rows.map(rowToNote));
  });

  app.post("/api/campaigns/:campaignId/notes", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const body = parseBody(NoteCreateBody, req);
    const title = body.title || "Note";
    const text = body.text ?? "";
    const id = uid();
    const t = now();
    const sort = nextSortFor(db, "notes", "campaign_id", campaignId);
    db.prepare(
      "INSERT INTO notes (id, campaign_id, adventure_id, title, text, sort, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)"
    ).run(id, campaignId, title, text, sort, t, t);
    ctx.broadcast("notes:changed", { campaignId, adventureId: null });
    res.json({ id, campaignId, adventureId: null, title, text, sort, createdAt: t, updatedAt: t });
  });

  app.post("/api/adventures/:adventureId/notes", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const advRow = db
      .prepare("SELECT campaign_id FROM adventures WHERE id = ?")
      .get(adventureId) as { campaign_id: string } | undefined;
    if (!advRow)
      return res.status(404).json({ ok: false, message: "Adventure not found" });

    const body = parseBody(NoteCreateBody, req);
    const title = body.title || "Note";
    const text = body.text ?? "";
    const id = uid();
    const t = now();
    const sort = nextSortFor(db, "notes", "adventure_id", adventureId);
    db.prepare(
      "INSERT INTO notes (id, campaign_id, adventure_id, title, text, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, advRow.campaign_id, adventureId, title, text, sort, t, t);
    ctx.broadcast("notes:changed", { campaignId: advRow.campaign_id, adventureId });
    res.json({ id, campaignId: advRow.campaign_id, adventureId, title, text, sort, createdAt: t, updatedAt: t });
  });

  app.put("/api/notes/:noteId", (req, res) => {
    const noteId = requireParam(req, res, "noteId");
    if (!noteId) return;
    const noteRow = db
      .prepare(`SELECT ${NOTE_COLS} FROM notes WHERE id = ?`)
      .get(noteId) as Record<string, unknown> | undefined;
    if (!noteRow)
      return res.status(404).json({ ok: false, message: "Note not found" });
    const n = rowToNote(noteRow);

    const body = parseBody(NoteUpdateBody, req);
    const title = body.title || n.title;
    const text = body.text ?? n.text;
    const t = now();
    db.prepare("UPDATE notes SET title=?, text=?, updated_at=? WHERE id=?").run(
      title, text, t, noteId
    );
    ctx.broadcast("notes:changed", { campaignId: n.campaignId, adventureId: n.adventureId });
    res.json({ ...n, title, text, updatedAt: t });
  });

  app.delete("/api/notes/:noteId", (req, res) => {
    const noteId = requireParam(req, res, "noteId");
    if (!noteId) return;
    const noteRow = db
      .prepare(`SELECT ${NOTE_COLS} FROM notes WHERE id = ?`)
      .get(noteId) as Record<string, unknown> | undefined;
    if (!noteRow)
      return res.status(404).json({ ok: false, message: "Note not found" });
    const n = rowToNote(noteRow);
    db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
    ctx.broadcast("notes:changed", { campaignId: n.campaignId, adventureId: n.adventureId });
    res.json({ ok: true });
  });
}
