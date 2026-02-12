import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerNoteRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now, bySortThenUpdatedDesc, nextSort } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/notes", (req, res) => {
    const { campaignId } = req.params;
    const rows = Object.values(userData.notes)
      .filter((n) => n.campaignId === campaignId && !n.adventureId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.get("/api/adventures/:adventureId/notes", (req, res) => {
    const { adventureId } = req.params;
    const rows = Object.values(userData.notes)
      .filter((n) => n.adventureId === adventureId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.post("/api/campaigns/:campaignId/notes", (req, res) => {
    const { campaignId } = req.params;
    const title = (req.body?.title ?? "").toString().trim() || "Note";
    const text = (req.body?.text ?? "").toString();
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
    const { adventureId } = req.params;
    const adv = userData.adventures[adventureId];
    if (!adv) return res.status(404).json({ ok: false, message: "Adventure not found" });

    const title = (req.body?.title ?? "").toString().trim() || "Note";
    const text = (req.body?.text ?? "").toString();
    const id = uid();
    const t = now();
    userData.notes[id] = {
      id,
      campaignId: adv.campaignId,
      adventureId,
      title,
      text,
      createdAt: t,
      updatedAt: t,
    };
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { campaignId: adv.campaignId, adventureId });
    res.json(userData.notes[id]);
  });

  app.put("/api/notes/:noteId", (req, res) => {
    const { noteId } = req.params;
    const n = userData.notes[noteId];
    if (!n) return res.status(404).json({ ok: false, message: "Note not found" });

    const title = (req.body?.title ?? "").toString().trim() || n.title;
    const text = (req.body?.text ?? "").toString();
    const t = now();
    userData.notes[noteId] = { ...n, title, text, updatedAt: t };
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { noteId });
    res.json(userData.notes[noteId]);
  });

  app.delete("/api/notes/:noteId", (req, res) => {
    const { noteId } = req.params;
    const n = userData.notes[noteId];
    if (!n) return res.status(404).json({ ok: false, message: "Note not found" });
    delete userData.notes[noteId];
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { noteId });
    res.json({ ok: true });
  });
}
