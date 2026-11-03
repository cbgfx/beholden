import type { Express } from "express";
import {
  MAP_MAX_BYTES,
  MAP_MAX_EDGE_PX,
  MAP_INPUT_MAX_PIXELS,
} from "@beholden/shared/api/locationMaps";
import type { ServerContext } from "../../server/context.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  binderEditorOrAdmin,
  canAccessBinder,
} from "../../middleware/binderAuth.js";
import { requireParam } from "../../lib/routeHelpers.js";

/** One high-resolution attachment per location, with access checked on every image request. */
export function registerBinderMapRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const route = "/api/binders/:binderId/locations/:recordId/map";
  const editor = binderEditorOrAdmin(db);
  const locationExists = (binderId: string, recordId: string) =>
    db
      .prepare(
        "SELECT 1 FROM binder_locations l JOIN binder_records r ON r.id=l.id WHERE r.binder_id=? AND r.id=?",
      )
      .get(binderId, recordId);

  app.get(route, requireAuth, (req, res) => {
    // Never cache private maps across a visibility change or account/session change.
    res.setHeader("Cache-Control", "private, no-store");
    const binderId = requireParam(req, res, "binderId");
    const recordId = requireParam(req, res, "recordId");
    if (!binderId || !recordId) return;
    const user = req.user!;
    const canRead =
      user.isAdmin ||
      canAccessBinder(db, user.userId, binderId) ||
      db
        .prepare(
          `
      SELECT 1 FROM binder_records r
      WHERE r.binder_id=? AND r.id=? AND r.visibility='public' AND EXISTS (
        SELECT 1 FROM user_characters uc
        JOIN binder_player_characters pc ON pc.character_id=uc.id
        JOIN binder_records linked ON linked.id=pc.mortal_id
        WHERE uc.user_id=? AND linked.binder_id=r.binder_id
      )
    `,
        )
        .get(binderId, recordId, user.userId);
    if (!canRead || !locationExists(binderId, recordId))
      return res.status(404).json({ ok: false, message: "Map not found" });
    const map = db
      .prepare("SELECT image_base64 FROM binder_location_maps WHERE id=?")
      .get(recordId) as { image_base64: string } | undefined;
    if (!map)
      return res.status(404).json({ ok: false, message: "Map not found" });
    res.type("image/webp").send(Buffer.from(map.image_base64, "base64"));
  });

  app.post(
    route,
    requireAuth,
    editor,
    ctx.imageUpload.single("image"),
    async (req, res) => {
      const binderId = requireParam(req, res, "binderId");
      const recordId = requireParam(req, res, "recordId");
      if (!binderId || !recordId) return;
      if (!locationExists(binderId, recordId))
        return res
          .status(404)
          .json({ ok: false, message: "Location not found" });
      if (
        !req.file ||
        !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
          req.file.mimetype,
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message: "Choose a PNG, JPEG, WebP or GIF map image.",
          });
      }
      if (req.file.size > MAP_MAX_BYTES) {
        return res.status(413).json({ ok: false, message: "Choose a map smaller than 12 MB." });
      }
      try {
        const { default: sharp } = await import("sharp");
        const image = await sharp(req.file.buffer, {
          animated: false,
          limitInputPixels: MAP_INPUT_MAX_PIXELS,
        })
          .autoOrient()
          .resize({
            width: MAP_MAX_EDGE_PX,
            height: MAP_MAX_EDGE_PX,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 90 })
          .toBuffer();
        if (image.length > MAP_MAX_BYTES)
          return res
            .status(400)
            .json({
              ok: false,
              message: "Map exceeds the 12 MB storage limit.",
            });
        // Authorization and existence can change while the image engine is working.
        if (!locationExists(binderId, recordId))
          return res
            .status(404)
            .json({ ok: false, message: "Location not found" });
        return editor(req, res, () => {
          const now = Date.now();
          db.prepare(
            `INSERT INTO binder_location_maps(id,image_base64,updated_at) VALUES (?,?,?)
          ON CONFLICT(id) DO UPDATE SET image_base64=excluded.image_base64,updated_at=excluded.updated_at`,
          ).run(recordId, image.toString("base64"), now);
          res.json({ ok: true });
        });
      } catch {
        return res
          .status(400)
          .json({ ok: false, message: "Unable to read this map image." });
      }
    },
  );

  app.delete(route, requireAuth, editor, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const recordId = requireParam(req, res, "recordId");
    if (!binderId || !recordId) return;
    if (!locationExists(binderId, recordId))
      return res.status(404).json({ ok: false, message: "Location not found" });
    db.prepare("DELETE FROM binder_location_maps WHERE id=?").run(recordId);
    res.json({ ok: true });
  });
}
