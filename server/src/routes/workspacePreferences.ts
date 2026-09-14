import type { Express } from "express";
import { z } from "zod";
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
    res.json(row ? JSON.parse(row.data_json) : null);
  });
  app.put("/api/me/workspaces/:workspace", requireAuth, (req, res) => {
    const workspace = Id.parse(req.params.workspace);
    const preferences = parseBody(Preferences, req);
    db.prepare(
      "INSERT INTO user_workspace_preferences (user_id, workspace, data_json) VALUES (?, ?, ?) ON CONFLICT(user_id, workspace) DO UPDATE SET data_json = excluded.data_json",
    ).run(req.user!.userId, workspace, JSON.stringify(preferences));
    res.json({ ok: true });
  });
}
