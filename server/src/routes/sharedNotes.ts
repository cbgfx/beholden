// server/src/routes/sharedNotes.ts
//
// Every route that touches shared notes, for all three owners: a campaign's notes (the DM's), a
// character's notes (the player's), and a player row, which is how the DM edits a player's note.
//
// They used to live in three files, each with its own idea of validation and of which rows to
// write, and each took the whole list at once - so a DM and a player editing at the same moment
// overwrote each other, whoever's request landed second. There is one request per change now, and
// the server applies it to whatever is stored rather than to what a client last read.

import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../lib/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import {
  applySharedNoteOperation,
  parseSharedNotes,
  serializeSharedNotes,
  type SharedNoteOperation,
} from "../lib/sharedNotes.js";
import { editableSharedNoteOwner, readSharedNotes, writeSharedNotes, type SharedNotesOwner, type SharedNotesWrite } from "../services/sharedNotes/store.js";
import { dmOrAdmin } from "../middleware/campaignAuth.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOwnedCharacter, makeEmitPlayerChange } from "./characters/helpers.js";

const NoteBody = z.object({
  title: z.string().max(500).optional(),
  text: z.string().max(200_000).optional(),
});

const ReorderBody = z.object({ ids: z.array(z.string()).max(1000) });

/** Where one family of routes lives, who may use it, and which row it writes. */
type OwnerRoutes = {
  /** e.g. "/api/campaigns/:campaignId/sharedNotes" */
  path: string;
  guard: (ctx: ServerContext) => RequestHandler;
  /** Null means the caller may not touch this owner; the guard has already answered. */
  owner: (req: import("express").Request, res: import("express").Response, ctx: ServerContext) => SharedNotesOwner | null;
};

export function registerSharedNotesRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now } = ctx.helpers;
  const emitPlayerChange = makeEmitPlayerChange(ctx);

  const announce = (write: SharedNotesWrite) => {
    if (write.campaignId) {
      ctx.broadcast("campaigns:changed", { campaignId: write.campaignId });
      // Player clients read campaign shared notes as part of their character.
      ctx.broadcast("players:delta", { campaignId: write.campaignId, action: "refresh" });
    }
    for (const player of write.players) {
      emitPlayerChange({
        campaignId: player.campaignId,
        action: "upsert",
        playerId: player.playerId,
        characterId: player.characterId,
      });
    }
  };

  const owners: OwnerRoutes[] = [
    {
      path: "/api/campaigns/:campaignId/sharedNotes",
      guard: () => dmOrAdmin(db),
      owner: (req, res) => {
        const campaignId = requireParam(req, res, "campaignId");
        return campaignId ? { kind: "campaign", campaignId } : null;
      },
    },
    {
      path: "/api/players/:playerId/sharedNotes",
      guard: () => dmOrAdmin(db),
      owner: (req, res) => {
        const playerId = requireParam(req, res, "playerId");
        return playerId ? { kind: "player", playerId } : null;
      },
    },
    {
      path: "/api/me/characters/:id/sharedNotes",
      guard: () => requireAuth,
      owner: (req, res) => {
        const characterId = requireParam(req, res, "id");
        if (!characterId) return null;
        if (!requireOwnedCharacter(db, characterId, req.user!.userId, res)) return null;
        return { kind: "character", characterId };
      },
    },
  ];

  for (const entry of owners) {
    const guard = entry.guard(ctx);

    /** Runs one operation against what is stored right now. */
    const runOperation = (
      req: import("express").Request,
      res: import("express").Response,
      build: (currentIds: string[]) => SharedNoteOperation | null,
      resolveOwner?: (owner: SharedNotesOwner) => SharedNotesOwner,
    ) => {
      const requestedOwner = entry.owner(req, res, ctx);
      if (!requestedOwner) return;
      const owner = resolveOwner?.(requestedOwner) ?? requestedOwner;
      const current = readSharedNotes(db, owner);
      if (current === null) return res.status(404).json({ ok: false, message: "Not found" });

      const list = parseSharedNotes(current);
      const operation = build(list.map((note) => note.id));
      if (!operation) return;

      const next = serializeSharedNotes(applySharedNoteOperation(list, operation));
      const write = writeSharedNotes(db, owner, next, now());
      announce(write);
      res.json({ ok: true, sharedNotes: next });
    };

    // MARK: - PUT <owner>/sharedNotes/:noteId  (create or edit one note)
    app.put(`${entry.path}/:noteId`, guard, (req, res) => {
      const noteId = requireParam(req, res, "noteId");
      if (!noteId) return;
      const body = parseBody(NoteBody, req);
      runOperation(req, res, () => ({
        type: "upsert",
        id: noteId,
        title: body.title ?? "",
        text: body.text ?? "",
      }), (owner) => owner.kind === "character" ? editableSharedNoteOwner(db, owner.characterId, noteId) : owner);
    });

    // MARK: - DELETE <owner>/sharedNotes/:noteId
    app.delete(`${entry.path}/:noteId`, guard, (req, res) => {
      const noteId = requireParam(req, res, "noteId");
      if (!noteId) return;
      runOperation(req, res, () => ({ type: "delete", id: noteId }));
    });

    // MARK: - POST <owner>/sharedNotes/reorder
    app.post(`${entry.path}/reorder`, guard, (req, res) => {
      const { ids } = parseBody(ReorderBody, req);
      runOperation(req, res, () => ({ type: "reorder", ids }));
    });

  }
}
