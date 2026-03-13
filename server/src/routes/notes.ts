import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";

const NoteCreateBody = z.object({
  title: z.string().trim().optional(),
  text: z.string().optional(),
});

const NoteUpdateBody = z.object({
  title: z.string().trim().optional(),
  text: z.string().optional(),
});

export function registerNoteRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now, bySortThenUpdatedDesc, nextSort } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/notes", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = Object.values(userData.notes)
      .filter((n) => n.campaignId === campaignId && !n.adventureId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.get("/api/adventures/:adventureId/notes", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const rows = Object.values(userData.notes)
      .filter((n) => n.adventureId === adventureId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.post("/api/campaigns/:campaignId/notes", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const body = parseBody(NoteCreateBody, req);
    const title = body.title || "Note";
    const text = body.text ?? "";
    const id = uid();
    const t = now();
    const existing = Object.values(userData.notes).filter(
      (n) => n.campaignId === campaignId && n.adventureId == null
    );
    userData.notes[id] = {
      id,
      campaignId,
      adventureId: null,
      title,
      text,
      sort: nextSort(existing),
      createdAt: t,
      updatedAt: t,
    };
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { campaignId, adventureId: null });
    res.json(userData.notes[id]);
  });

  app.post("/api/adventures/:adventureId/notes", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const adv = userData.adventures[adventureId];
    if (!adv) return res.status(404).json({ ok: false, message: "Adventure not found" });

    const body = parseBody(NoteCreateBody, req);
    const title = body.title || "Note";
    const text = body.text ?? "";
    const id = uid();
    const t = now();
userData.notes[id] = {
  id,
  campaignId: adv.campaignId,
  adventureId,
  title,
  text,
  sort: nextSort(Object.values(userData.notes).filter((n) => n.adventureId === adventureId)),
  createdAt: t,
  updatedAt: t,
};
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { campaignId: adv.campaignId, adventureId });
    res.json(userData.notes[id]);
  });

  app.put("/api/notes/:noteId", (req, res) => {
    const noteId = requireParam(req, res, "noteId");
    if (!noteId) return;
    const n = userData.notes[noteId];
    if (!n) return res.status(404).json({ ok: false, message: "Note not found" });

    const body = parseBody(NoteUpdateBody, req);
    const title = body.title || n.title;
    const text = body.text ?? n.text;
    const t = now();
    userData.notes[noteId] = { ...n, title, text, updatedAt: t };
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { campaignId: n.campaignId, adventureId: n.adventureId });
    res.json(userData.notes[noteId]);
  });

  app.delete("/api/notes/:noteId", (req, res) => {
    const noteId = requireParam(req, res, "noteId");
    if (!noteId) return;
    const n = userData.notes[noteId];
    if (!n) return res.status(404).json({ ok: false, message: "Note not found" });
    delete userData.notes[noteId];
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { campaignId: n.campaignId, adventureId: n.adventureId });
    res.json({ ok: true });
  });
}
