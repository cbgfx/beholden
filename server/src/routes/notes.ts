import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../lib/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { rowToNote, nextSortFor, NOTE_COLS } from "../lib/db.js";
import { toNoteDto, toNoteSummaryDto } from "../lib/apiCollections.js";
import { dmOrAdmin } from "../middleware/campaignAuth.js";

// Long enough for any note anyone would actually write (the longest in the live database is 2KB),
// short enough that neither field can be used to push a row to the JSON body limit.
const NoteCreateBody = z.object({
  title: z.string().trim().max(500).optional(),
  text: z.string().max(200_000).optional(),
});

const NoteUpdateBody = z.object({
  title: z.string().trim().max(500).optional(),
  text: z.string().max(200_000).optional(),
});

/**
 * Every route here is DM-only, reads included.
 *
 * These are the DM's own campaign and adventure notes - the plot, what the villain is really up to,
 * what the party has not worked out yet. Neither player app has ever fetched them; they used to be
 * readable by any member of the campaign, which meant a player could read the DM's notes straight
 * from the API. Notes players are meant to see are a different thing entirely (`shared_notes` on
 * the campaign, the character and the player row).
 */
export function registerNoteRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const isListView = (value: unknown): boolean => {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "list" || raw === "summary" || raw === "compact";
  };
  const emitNoteChange = (args: {
    campaignId: string;
    adventureId?: string | null;
    action: "upsert" | "delete" | "refresh";
    noteId?: string;
    note?: ReturnType<typeof toNoteDto>;
  }) => {
    ctx.broadcast("notes:delta", {
      campaignId: args.campaignId,
      adventureId: args.adventureId ?? null,
      action: args.action,
      ...(args.noteId ? { noteId: args.noteId } : {}),
      ...(args.note ? { note: args.note } : {}),
    });
  };

  // MARK: - GET /api/campaigns/:campaignId/notes
  app.get("/api/campaigns/:campaignId/notes", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    if (isListView(req.query.view)) {
      const rows = db.prepare(`
        SELECT id, campaign_id, NULL AS adventure_id,
               note_display_title(title, text) AS title, title AS raw_title, sort, updated_at
        FROM notes
        WHERE campaign_id = ? AND adventure_id IS NULL
        ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC
      `).all(campaignId) as Array<Record<string, unknown>>;
      return res.json(rows.map(toNoteSummaryDto));
    }
    const rows = db
      .prepare(
        `SELECT ${NOTE_COLS} FROM notes WHERE campaign_id = ? AND adventure_id IS NULL ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(campaignId) as Record<string, unknown>[];
    const notes = rows.map(rowToNote);
    res.json(notes.map(toNoteDto));
  });

  // MARK: - GET /api/adventures/:adventureId/notes
  app.get("/api/adventures/:adventureId/notes", dmOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    if (isListView(req.query.view)) {
      const rows = db.prepare(`
        SELECT id, campaign_id, adventure_id,
               note_display_title(title, text) AS title, title AS raw_title, sort, updated_at
        FROM notes
        WHERE adventure_id = ?
        ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC
      `).all(adventureId) as Array<Record<string, unknown>>;
      return res.json(rows.map(toNoteSummaryDto));
    }
    const rows = db
      .prepare(
        `SELECT ${NOTE_COLS} FROM notes WHERE adventure_id = ? ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(adventureId) as Record<string, unknown>[];
    const notes = rows.map(rowToNote);
    res.json(notes.map(toNoteDto));
  });

  // MARK: - GET /api/notes/:noteId
  app.get("/api/notes/:noteId", dmOrAdmin(db), (req, res) => {
    const noteId = requireParam(req, res, "noteId");
    if (!noteId) return;
    const row = db
      .prepare(`SELECT ${NOTE_COLS} FROM notes WHERE id = ?`)
      .get(noteId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Note not found" });
    res.json(toNoteDto(rowToNote(row)));
  });

  // MARK: - POST /api/campaigns/:campaignId/notes
  app.post("/api/campaigns/:campaignId/notes", dmOrAdmin(db), (req, res) => {
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
    const row = db
      .prepare(`SELECT ${NOTE_COLS} FROM notes WHERE id = ?`)
      .get(id) as Record<string, unknown>;
    const dto = toNoteDto(rowToNote(row));
    emitNoteChange({ campaignId, adventureId: null, action: "upsert", noteId: id, note: dto });
    res.json(dto);
  });

  // MARK: - POST /api/adventures/:adventureId/notes
  app.post("/api/adventures/:adventureId/notes", dmOrAdmin(db), (req, res) => {
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
    const row = db
      .prepare(`SELECT ${NOTE_COLS} FROM notes WHERE id = ?`)
      .get(id) as Record<string, unknown>;
    const dto = toNoteDto(rowToNote(row));
    emitNoteChange({ campaignId: advRow.campaign_id, adventureId, action: "upsert", noteId: id, note: dto });
    res.json(dto);
  });

  // MARK: - PUT /api/notes/:noteId
  app.put("/api/notes/:noteId", dmOrAdmin(db), (req, res) => {
    const noteId = requireParam(req, res, "noteId");
    if (!noteId) return;
    const noteRow = db
      .prepare(`SELECT ${NOTE_COLS} FROM notes WHERE id = ?`)
      .get(noteId) as Record<string, unknown> | undefined;
    if (!noteRow)
      return res.status(404).json({ ok: false, message: "Note not found" });
    const n = rowToNote(noteRow);

    const body = parseBody(NoteUpdateBody, req);
    // `n.title` may have been worked out from the text; writing that back would freeze the title so
    // it stops following the note. When the request says nothing about the title, the stored one
    // stays exactly as it is.
    const title = body.title || (noteRow.title as string);
    const text = body.text ?? n.text;
    const t = now();
    db.prepare("UPDATE notes SET title=?, text=?, updated_at=? WHERE id=?").run(title, text, t, noteId);
    const row = db
      .prepare(`SELECT ${NOTE_COLS} FROM notes WHERE id = ?`)
      .get(noteId) as Record<string, unknown>;
    const dto = toNoteDto(rowToNote(row));
    emitNoteChange({ campaignId: n.campaignId, adventureId: n.adventureId ?? null, action: "upsert", noteId, note: dto });
    res.json(dto);
  });

  // MARK: - DELETE /api/notes/:noteId
  app.delete("/api/notes/:noteId", dmOrAdmin(db), (req, res) => {
    const noteId = requireParam(req, res, "noteId");
    if (!noteId) return;
    const noteRow = db
      .prepare(`SELECT ${NOTE_COLS} FROM notes WHERE id = ?`)
      .get(noteId) as Record<string, unknown> | undefined;
    if (!noteRow)
      return res.status(404).json({ ok: false, message: "Note not found" });
    const n = rowToNote(noteRow);
    db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
    emitNoteChange({ campaignId: n.campaignId, adventureId: n.adventureId ?? null, action: "delete", noteId });
    res.json({ ok: true });
  });
}
