import type { Express } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { ServerContext } from "../server/context.js";
import { requireAuth } from "../middleware/auth.js";
import { parseBody } from "../lib/validate.js";

const Appearance = z.object({
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  background: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  text: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});
const Id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const Preferences = z.object({
  activeId: Id,
  views: z
    .array(
      z.object({
        id: Id,
        name: z.string().trim().min(1).max(60),
        columns: z.array(z.array(Id).max(80)).min(1).max(4),
        colors: z
          .record(Id, Appearance)
          .refine((value) => Object.keys(value).length <= 80),
        appearance: Appearance,
      }),
    )
    .min(1)
    .max(12),
});
const PreferencesWrite = Preferences.extend({ expectedRevision: z.string().length(64).nullable() });
const revisionOf = (json: string) => createHash("sha256").update(json).digest("hex");

export function registerWorkspacePreferences(
  app: Express,
  { db }: ServerContext,
) {
  app.get("/api/me/workspaces/:workspace", requireAuth, (req, res) => {
    const workspace = Id.parse(req.params.workspace);
    const row = db
      .prepare(
        "SELECT data_json FROM user_workspace_preferences WHERE user_id = ? AND workspace = ?",
      )
      .get(req.user!.userId, workspace) as { data_json: string } | undefined;
    if (!row) return res.json(null);
    const parsed = Preferences.safeParse(JSON.parse(row.data_json));
    if (!parsed.success) return res.json(null);
    res.json({ ...parsed.data, revision: revisionOf(row.data_json) });
  });
  app.put("/api/me/workspaces/:workspace", requireAuth, (req, res) => {
    const workspace = Id.parse(req.params.workspace);
    const { expectedRevision, ...preferences } = parseBody(PreferencesWrite, req);
    const json = JSON.stringify(preferences);
    const result = db.transaction(() => {
      const current = db.prepare("SELECT data_json FROM user_workspace_preferences WHERE user_id = ? AND workspace = ?")
        .get(req.user!.userId, workspace) as { data_json: string } | undefined;
      const currentRevision = current ? revisionOf(current.data_json) : null;
      if (currentRevision !== expectedRevision) return false;
      db.prepare(
        "INSERT INTO user_workspace_preferences (user_id, workspace, data_json) VALUES (?, ?, ?) ON CONFLICT(user_id, workspace) DO UPDATE SET data_json = excluded.data_json",
      ).run(req.user!.userId, workspace, json);
      return true;
    }).immediate();
    if (!result) return res.status(409).json({ ok: false, code: "stale-workspace", message: "Layout changed in another tab; reload and try again." });
    res.json({ ok: true, revision: revisionOf(json) });
  });
}
